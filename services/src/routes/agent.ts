import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../auth';
import { query, withTransaction } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getGeminiClient, getModelName, ResumeMode } from '../services/gemini';
import { RESUME_FORGE_SYSTEM_PROMPT } from '../prompts';
import pdfParse from 'pdf-parse';

const router = Router();

type DataSourceRow = {
  id: string;
  name: string;
  icon: string;
  is_connected: boolean;
  last_sync: string | null;
};

type AgentUpdateRow = {
  id: string;
  source: string;
  type: string;
  title: string;
  description: string;
  date_found: string;
  status: 'pending' | 'accepted' | 'rejected';
};

function toSourceDto(r: DataSourceRow) {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    isConnected: r.is_connected,
    lastSync: r.last_sync ? new Date(r.last_sync).toISOString() : null,
  };
}

function toUpdateDto(r: AgentUpdateRow) {
  return {
    id: r.id,
    source: r.source,
    type: r.type,
    title: r.title,
    description: r.description,
    dateFound: new Date(r.date_found).toISOString(),
    status: r.status,
  };
}

async function ensureDefaultSources(userId: string) {
  const existing = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM data_sources WHERE user_id = $1`,
    [userId]
  );
  if ((existing[0]?.count ?? 0) > 0) return;

  const defaults = [
    { name: 'LinkedIn', icon: 'linkedin', is_connected: true },
    { name: 'GitHub', icon: 'github', is_connected: true },
    { name: 'University Portal', icon: 'school', is_connected: false },
  ];

  await withTransaction(async (client) => {
    for (const s of defaults) {
      await client.query(
        `INSERT INTO data_sources (id, user_id, name, icon, is_connected, last_sync)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          `src-${uuidv4()}`,
          userId,
          s.name,
          s.icon,
          s.is_connected,
          s.is_connected ? new Date().toISOString() : null,
        ]
      );
    }
  });
}

// GET sources
router.get('/sources', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId as string;
  await ensureDefaultSources(userId);

  const rows = await query<DataSourceRow>(
    `SELECT id, name, icon, is_connected, last_sync
     FROM data_sources
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );

  return res.json({ sources: rows.map(toSourceDto) });
});

// Toggle a source
router.post('/sources/:id/toggle', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId as string;
  const sourceId = req.params.id as string;

  const rows = await query<DataSourceRow>(
    `SELECT id, name, icon, is_connected, last_sync
     FROM data_sources
     WHERE user_id = $1 AND id = $2`,
    [userId, sourceId]
  );
  const source = rows[0];
  if (!source) return res.status(404).json({ error: 'Source not found' });

  const next = !source.is_connected;

  await query(
    `UPDATE data_sources
     SET is_connected = $1,
         last_sync = CASE WHEN $1 THEN now() ELSE last_sync END
     WHERE user_id = $2 AND id = $3`,
    [next, userId, sourceId]
  );

  const updated = await query<DataSourceRow>(
    `SELECT id, name, icon, is_connected, last_sync
     FROM data_sources
     WHERE user_id = $1 AND id = $2`,
    [userId, sourceId]
  );

  return res.json({ source: toSourceDto(updated[0]) });
});

// Simulated check: creates mock updates depending on connected sources
router.post('/check', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId as string;

  const sources = await query<DataSourceRow>(
    `SELECT id, name, icon, is_connected, last_sync
     FROM data_sources
     WHERE user_id = $1`,
    [userId]
  );

  const connected = sources.filter((s) => s.is_connected);
  if (connected.length === 0) return res.json({ updates: [] });

  // Mock updates
  const nowIso = new Date().toISOString();
  const mock = [
    {
      source: 'GitHub',
      type: 'Project',
      title: 'New Repository: "AI-Finance-Tracker"',
      description:
        'Found a new public repository with Python and React code. Suggest adding to "Projects" section.',
      date_found: nowIso,
    },
    {
      source: 'LinkedIn',
      type: 'Certification',
      title: 'AWS Certified Solutions Architect',
      description: 'Detected a new license/certification added to your LinkedIn profile.',
      date_found: nowIso,
    },
  ].filter((u) => connected.some((s) => s.name === u.source));

  // Persist as pending updates
  await withTransaction(async (client) => {
    for (const u of mock) {
      await client.query(
        `INSERT INTO agent_updates (id, user_id, source, type, title, description, date_found, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
        [`upd-${uuidv4()}`, userId, u.source, u.type, u.title, u.description, u.date_found]
      );
    }
  });

  // Return the newly created updates (latest ones)
  const rows = await query<AgentUpdateRow>(
    `SELECT id, source, type, title, description, date_found, status
     FROM agent_updates
     WHERE user_id = $1
     ORDER BY date_found DESC
     LIMIT 20`,
    [userId]
  );

  return res.json({ updates: rows.map(toUpdateDto) });
});

// Optional: list updates
router.get('/updates', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId as string;

  const status = z.enum(['pending','accepted','rejected']).optional().safeParse(req.query.status);
  const where = status.success && status.data ? `AND status = '${status.data}'` : '';

  const rows = await query<AgentUpdateRow>(
    `SELECT id, source, type, title, description, date_found, status
     FROM agent_updates
     WHERE user_id = $1 ${where}
     ORDER BY date_found DESC
     LIMIT 200`,
    [userId]
  );

  return res.json({ updates: rows.map(toUpdateDto) });
});


// --------- AI: Resume generation (server-side Gemini proxy) ----------

const generateSchema = z.object({
  mode: z.enum(['MODE_A', 'MODE_B']),
  input: z.any(), // validated client-side; keep server flexible to avoid breaking changes
});

router.post('/generate-resume', authMiddleware, async (req: any, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const { mode, input } = parsed.data as { mode: ResumeMode; input: any };

  const ai = getGeminiClient();
  const model = getModelName();

  // Mirror the client prompt format to keep outputs compatible with the existing parser.
  const parts: any[] = [];

  // Optional resume file (base64)
  // For PDFs we extract text server-side for better reliability on long/multi-page files,
  // then feed the extracted text to the model.
  if (input?.fileData?.data && input?.fileData?.mimeType) {
    const mime = String(input.fileData.mimeType);
    const b64 = String(input.fileData.data);

    if (mime.includes('pdf')) {
      try {
        const buf = Buffer.from(b64, 'base64');
        const parsedPdf = await pdfParse(buf);
        const text = (parsedPdf.text ?? '').replace(/\s+\n/g, '\n').trim();
        const clipped = text.length > 60000 ? text.slice(0, 60000) : text;
        // Provide extracted text as a separate part to avoid model file limitations.
        parts.push({ text: `EXTRACTED_RESUME_TEXT_FROM_PDF:\n${clipped}` });
        // Also stash in input for transparency/debug
        input.currentResumeText = clipped;
      } catch (e) {
        // Fallback to inline PDF if parsing fails
        parts.push({
          inlineData: {
            mimeType: mime,
            data: b64,
          },
        });
      }
    } else {
      parts.push({
        inlineData: {
          mimeType: mime,
          data: b64,
        },
      });
    }
  }

  // Optional profile photo
  if (input?.profileImageData?.data && input?.profileImageData?.mimeType) {
    parts.push({
      inlineData: {
        mimeType: String(input.profileImageData.mimeType),
        data: String(input.profileImageData.data),
      },
    });
  }

  // Minimal user prompt (the system prompt already explains the full contract).
  const userPrompt = `MODE: ${mode}\n\nUSER_INPUT_JSON:\n${JSON.stringify(input ?? {}, null, 2)}`;

  parts.push({ text: userPrompt });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      config: {
        systemInstruction: RESUME_FORGE_SYSTEM_PROMPT,
        temperature: Number(process.env.GEMINI_TEMPERATURE ?? 0.4),
      },
    } as any);

    const text = (response as any)?.text ?? (response as any)?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '';
    return res.json({ text });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('Gemini proxy error', err);
    return res.status(502).json({ error: 'AI generation failed' });
  }
});

export default router;
