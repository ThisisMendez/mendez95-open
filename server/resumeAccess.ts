import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import { requireOwner, requireOwnerCsrf } from './auth';
import { CONTACT_RECIPIENT, createMailTransport, textField, validEmail, visitorFormGuard, type MailTransport } from './mail';

type Delivery = 'pending' | 'sent' | 'failed' | 'unconfigured';
type InboxStatus = 'pending' | 'handled' | 'archived';
type RequestRecord = { id: string; name: string; email: string; company: string; reason: string; requestedAt: string; status: string; manualStatus?: InboxStatus; notification: Delivery; events: { at: string; action: string }[]; [key: string]: unknown };
type Options = { dataDir?: string; mail?: MailTransport; origin?: string; now?: () => number };
const deliveries = ['pending', 'sent', 'failed', 'unconfigured'];
function isRequest(value: unknown): value is RequestRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && typeof item.name === 'string' && validEmail(item.email) && typeof item.company === 'string' && typeof item.reason === 'string' && typeof item.requestedAt === 'string' && typeof item.status === 'string' && deliveries.includes(String(item.notification)) && (item.manualStatus === undefined || ['pending', 'handled', 'archived'].includes(String(item.manualStatus))) && Array.isArray(item.events) && item.events.every(entry => entry && typeof entry.at === 'string' && typeof entry.action === 'string');
}

/** One server process owns the private inbox. Legacy metadata stays on disk, never grants access. */
export function mountResumeAccessRoutes(app: Express, options: Options = {}) {
  const dir = join(options.dataDir || process.env.MENDEZ_OS_DATA_DIR || fileURLToPath(new URL('../.local', import.meta.url)), 'resume-access');
  const requestsFile = join(dir, 'requests.json');
  const mail = options.mail || createMailTransport(), now = options.now || Date.now;
  let pending: Promise<unknown> = Promise.resolve();
  const queue = <T,>(task: () => Promise<T>) => { const run = pending.then(task, task); pending = run.catch(() => undefined); return run; };
  async function load(): Promise<RequestRecord[]> {
    try {
      const value: unknown = JSON.parse(await readFile(requestsFile, 'utf8'));
      if (!Array.isArray(value) || value.length > 10_000 || !value.every(isRequest)) throw new Error('Invalid request store.');
      return value;
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
  async function save(items: RequestRecord[]) {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const temporary = `${requestsFile}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(items), { mode: 0o600 }); await rename(temporary, requestsFile);
  }
  const event = (item: RequestRecord, action: string) => { item.events.push({ at: new Date(now()).toISOString(), action }); };
  // Explicit projection prevents old tokens, expiry, and any future private fields reaching clients.
  const ownerRecord = (item: RequestRecord) => ({ id: item.id, name: item.name, email: item.email, company: item.company, reason: item.reason, requestedAt: item.requestedAt, status: item.manualStatus ?? (['handled', 'archived'].includes(item.status) ? item.status : 'pending'), notification: item.notification, events: item.events.map(({ at, action }) => ({ at, action })), ...(item.status !== 'pending' && !['handled', 'archived'].includes(item.status) ? { legacyStatus: item.status } : {}) });
  async function notify(item: RequestRecord) {
    if (!mail.configured) item.notification = 'unconfigured';
    else try {
      await mail.send({ to: CONTACT_RECIPIENT, replyTo: item.email, subject: 'Mendez 95: Resume request', text: `A visitor requested your full resume. Reply manually by email with the appropriate document.\n\nName: ${item.name}\nCompany: ${item.company}\nEmail: ${item.email}\nReason: ${item.reason || '(not provided)'}\nRequested (UTC): ${item.requestedAt}\nRequest ID: ${item.id}\n\nThis notification sends nothing to the requester. The private request inbox is available after sign-in at /editor.` });
      item.notification = 'sent';
    } catch { item.notification = 'failed'; }
    event(item, `notification-${item.notification}`);
    return item.notification;
  }
  app.use(['/api/resume', '/api/owner/resume'], (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive'); next(); });
  // Terminal guards also cover HEAD, alternate verbs, nested paths and query strings.
  app.use(['/api/resume/access', '/api/resume/download.pdf', '/api/owner/resume/document'], (_req, res) => { res.status(404).json({ error: 'Not found.' }); });
  app.get('/api/resume/status', (_req, res) => res.json({ emailAvailable: mail.configured }));
  app.post('/api/resume/requests', visitorFormGuard(), async (req, res) => {
    const name = textField(req.body?.name, 100), email = textField(req.body?.email, 254), company = textField(req.body?.company, 150), reason = textField(req.body?.reason ?? '', 2000);
    if (!name || !validEmail(email) || !company || reason === null || /[\r\n]/.test(name + company)) { res.status(400).json({ error: 'Enter your name, a valid work email, and company. Keep the reason under 2,000 characters.' }); return; }
    try {
      const result = await queue(async () => {
        const items = await load();
        if (items.length >= 10_000) return null;
        const item: RequestRecord = { id: randomUUID(), name, email, company, reason, requestedAt: new Date(now()).toISOString(), status: 'pending', notification: 'pending', events: [] };
        event(item, 'requested'); items.push(item); await save(items);
        await notify(item); await save(items); return item;
      });
      if (!result) { res.status(503).json({ error: 'Requests are temporarily unavailable. Please contact Jordan by email.' }); return; }
      res.status(201).json({ message: result.notification === 'sent' ? 'Your request is saved and the notification was accepted for email delivery. Jordan can follow up with you directly by email.' : 'Your request is saved in the private inbox, but the email notification could not be sent. Jordan can review it there and follow up directly by email.', notificationSent: result.notification === 'sent', notification: result.notification });
    } catch { res.status(500).json({ error: 'The request could not be confirmed. Please try again later.' }); }
  });
  app.get('/api/owner/resume/requests', requireOwner, async (_req, res) => {
    try { res.json({ requests: (await load()).map(ownerRecord).reverse(), emailAvailable: mail.configured }); }
    catch { res.status(500).json({ error: 'Unable to read the request inbox.' }); }
  });
  app.post('/api/owner/resume/requests/:id/:action', (req, res, next) => {
    if (!['notify', 'handled', 'archive', 'reopen'].includes(String(req.params.action))) { res.status(404).json({ error: 'Not found.' }); return; } next();
  }, requireOwnerCsrf, async (req, res) => {
    const action = String(req.params.action);
    try {
      const result = await queue(async () => {
        const items = await load(), item = items.find(value => value.id === req.params.id);
        if (!item) return { code: 404, error: 'Request not found.' };
        if (action === 'notify') {
          if (item.notification === 'sent') return { code: 409, error: 'The owner notification was already accepted for delivery.' };
          const notification = await notify(item); await save(items);
          if (notification !== 'sent') return { code: item.notification === 'unconfigured' ? 503 : 502, error: item.notification === 'unconfigured' ? 'Email is not configured. The request remains saved.' : 'Owner notification failed. The request remains saved.' };
        } else {
          item.manualStatus = action === 'handled' ? 'handled' : action === 'archive' ? 'archived' : 'pending'; event(item, `manually-marked-${item.manualStatus}`); await save(items);
        }
        return { code: 200, request: ownerRecord(item) };
      });
      res.status(result.code).json(result);
    } catch { res.status(500).json({ error: 'Unable to save this request action.' }); }
  });
}
