import nodemailer from 'nodemailer';

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
};

function getSmtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const secureRaw = process.env.SMTP_SECURE;

  if (!host || !portRaw) {
    throw new Error('SMTP is not configured. Set SMTP_HOST and SMTP_PORT in environment.');
  }

  const port = Number(portRaw);
  if (!Number.isFinite(port)) {
    throw new Error('Invalid SMTP_PORT. Must be a number.');
  }

  const secure = (secureRaw ?? '').toLowerCase() === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return { host, port, secure, user, pass };
}

export async function sendSupportEmail(params: { to: string; subject: string; text: string }) {
  const cfg = getSmtpConfig();

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass ?? '' } : undefined,
  });

  const from = process.env.SMTP_FROM || 'myresume_team@myresume.ai';

  await transporter.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    text: params.text,
  });
}
