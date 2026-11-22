import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createTransport } from 'nodemailer';
import type { Request, Response, NextFunction } from 'express';
import { clientRateKey } from './clientAddress';
import { sameOrigin } from './origin';

export const CONTACT_RECIPIENT = 'owner@example.invalid';
export type MailMessage = { to: string; subject: string; text: string; replyTo?: string };
export interface MailTransport { configured: boolean; send(message: MailMessage): Promise<void> }
export const validEmail = (value: unknown): value is string => typeof value === 'string' && value.length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(value);
export const textField = (value: unknown, maximum: number): string | null => typeof value === 'string' && value.trim().length <= maximum && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) ? value.trim() : null;

/** Configuration is inert: no network connection until a validated form calls send. */
export function createMailTransport(env: NodeJS.ProcessEnv = process.env): MailTransport {
  const executable = env.MENDEZ_OS_SENDMAIL_PATH || '/usr/sbin/sendmail';
  const from = env.MENDEZ_OS_MAIL_FROM || '';
  const user = env.MENDEZ_OS_GMAIL_USER || '';
  const appPassword = (env.MENDEZ_OS_GMAIL_APP_PASSWORD || '').replace(/ /g, '');
  const oauth = env.MENDEZ_OS_GMAIL_AUTH === 'oauth2' && env.MENDEZ_OS_GMAIL_CLIENT_ID && env.MENDEZ_OS_GMAIL_CLIENT_SECRET && env.MENDEZ_OS_GMAIL_REFRESH_TOKEN;
  const password = env.MENDEZ_OS_GMAIL_AUTH === 'app-password' && /^[a-z]{16}$/i.test(appPassword);
  // Require the authenticated mailbox as sender; arbitrary visitor addresses are Reply-To only.
  const gmail = env.MENDEZ_OS_MAIL_TRANSPORT === 'gmail' && validEmail(user) && from.toLowerCase() === user.toLowerCase() && Boolean(oauth || password);
  const sendmail = env.MENDEZ_OS_MAIL_TRANSPORT === 'sendmail' && executable.startsWith('/') && validEmail(from);
  const configured = gmail || sendmail;
  const smtp = gmail ? createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000, dnsTimeout: 10_000,
    disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false,
    auth: oauth ? { type: 'OAuth2', user, clientId: env.MENDEZ_OS_GMAIL_CLIENT_ID, clientSecret: env.MENDEZ_OS_GMAIL_CLIENT_SECRET, refreshToken: env.MENDEZ_OS_GMAIL_REFRESH_TOKEN } : { user, pass: appPassword },
  }) : null;
  return { configured, async send(message) {
    if (!configured) throw new Error('Email is not configured.');
    if (!validEmail(message.to) || (message.replyTo !== undefined && !validEmail(message.replyTo)) || /[\r\n]/.test(message.subject)) throw new Error('Invalid email envelope.');
    if (smtp) {
      try {
        const result = await smtp.sendMail({ from, to: message.to, subject: message.subject, text: message.text, replyTo: message.replyTo, envelope: { from, to: [message.to] } });
        if (!result.accepted?.some(address => String(address).toLowerCase() === message.to.toLowerCase()) || result.rejected?.length) throw new Error('Recipient rejected.');
      } catch { throw new Error('Email delivery could not be confirmed.'); }
      return;
    }
    const headers = [`From: ${from}`, `To: ${message.to}`, `Subject: ${message.subject}`, ...(message.replyTo ? [`Reply-To: ${message.replyTo}`] : []), 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: 8bit'];
    await new Promise<void>((resolve, reject) => {
      const child = spawn(executable, ['-i', '-t', '-f', from], { stdio: ['pipe', 'ignore', 'ignore'] });
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Email transport timed out.')); }, 10_000);
      child.once('error', () => { clearTimeout(timer); reject(new Error('Email transport unavailable.')); });
      child.once('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('Email transport rejected the message.')); });
      child.stdin.on('error', () => { /* close/error reports transport failure */ });
      child.stdin.end(`${headers.join('\r\n')}\r\n\r\n${message.text}`);
    });
  } };
}

/** Bounded, ephemeral abuse controls shared by both visitor forms. No raw IP persistence. */
export function visitorFormGuard(limit = 5) {
  const salt = randomBytes(24), attempts = new Map<string, { count: number; reset: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!sameOrigin(req)) { res.status(403).json({ error: 'Origin not allowed.' }); return; }
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.reset <= now) attempts.delete(key);
    const key = clientRateKey(req, salt), entry = attempts.get(key) || { count: 0, reset: now + 15 * 60_000 };
    if (entry.count >= limit || (attempts.size >= 10_000 && !attempts.has(key))) { res.status(429).json({ error: 'Too many submissions. Please try again later.' }); return; }
    entry.count++; attempts.set(key, entry);
    if (req.body?.website) { res.status(400).json({ error: 'Unable to accept this submission.' }); return; }
    next();
  };
}
