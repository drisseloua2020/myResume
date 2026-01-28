import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, findUserById } from '../auth';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getGeminiClient, getModelName } from '../services/gemini';
import { RESUME_FORGE_SYSTEM_PROMPT } from '../prompts';

const router = Router();

const generateSchema = z.object({
  templateId: z.string().min(1).optional(),
  title: z.string().min(1).max(200).optional(),
  jobDescription: z.string().min(20).max(20000),
  // Optional: pass the latest resume JSON to let the model ground achievements
  resumeJson: z.any().optional(),
});

function extract(rawText: string, startMarker: string, endMarker: string | null): string | undefined {
  const startIndex = rawText.indexOf(startMarker);
  if (startIndex === -1) return undefined;
  const start = startIndex + startMarker.length;
  const end = endMarker ? rawText.indexOf(endMarker, start) : rawText.length;
  if (end === -1) return rawText.slice(start).trim();
  return rawText.slice(start, end).trim();
}

router.post('/generate', authMiddleware, async (req: any, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const userId = req.user.userId as string;
  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { templateId, jobDescription, resumeJson } = parsed.data;
  const title = (parsed.data.title ?? 'Cover Letter').slice(0, 200);

  const ai = getGeminiClient();
  const model = getModelName();

  const userPrompt = `You are generating ONLY cover letter outputs.

Return EXACTLY these sections (no resume sections):
COVER_LETTER_FULL:
<text>

COVER_LETTER_SHORT:
<text>

COLD_EMAIL:
<text>

USER_CONTEXT_JSON:
${JSON.stringify(
    {
      name: user.name,
      email: user.email,
      templateId: templateId ?? null,
      jobDescription,
      resumeJson: resumeJson ?? null,
    },
    null,
    2
  )}`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: RESUME_FORGE_SYSTEM_PROMPT,
        temperature: Number(process.env.GEMINI_TEMPERATURE ?? 0.4),
      },
    } as any);

    const raw = (response as any)?.text ?? (response as any)?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '';

    const coverLetterFull = extract(raw, 'COVER_LETTER_FULL:', 'COVER_LETTER_SHORT:') ?? raw.trim();
    const coverLetterShort = extract(raw, 'COVER_LETTER_SHORT:', 'COLD_EMAIL:') ?? '';
    const coldEmail = extract(raw, 'COLD_EMAIL:', null) ?? '';

    const id = `cl-${uuidv4()}`;

    await query(
      `INSERT INTO cover_letters (id, user_id, template_id, title, job_description, content, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())`,
      [
        id,
        userId,
        templateId ?? null,
        title,
        jobDescription,
        JSON.stringify({ coverLetterFull, coverLetterShort, coldEmail, raw }),
      ]
    );

    await query(
      `INSERT INTO activity_logs (id, user_id, user_name, action, details, timestamp)
       VALUES ($1, $2, $3, 'COVERLETTER_GENERATE', $4, now())`,
      [`log-${uuidv4()}`, userId, user.name, `Template: ${templateId ?? 'n/a'}`]
    );

    return res.status(201).json({
      coverLetter: {
        id,
        templateId: templateId ?? null,
        title,
        jobDescription,
        content: { coverLetterFull, coverLetterShort, coldEmail },
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('Cover letter generation error', err);
    return res.status(502).json({ error: 'AI generation failed' });
  }
});

router.get('/', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId as string;
  const rows = await query(
    `SELECT id, template_id AS "templateId", title, job_description AS "jobDescription", created_at AS "createdAt"
     FROM cover_letters
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return res.json({ coverLetters: rows });
});

router.get('/:id', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId as string;
  const id = req.params.id as string;

  const rows = await query(
    `SELECT id, template_id AS "templateId", title, job_description AS "jobDescription", content, created_at AS "createdAt"
     FROM cover_letters
     WHERE user_id = $1 AND id = $2`,
    [userId, id]
  );
  const row = rows[0];
  if (!row) return res.status(404).json({ error: 'Not found' });

  return res.json({ coverLetter: row });
});

router.delete('/:id', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId as string;
  const id = req.params.id as string;
  await query(`DELETE FROM cover_letters WHERE user_id = $1 AND id = $2`, [userId, id]);
  return res.json({ ok: true });
});

export default router;
