import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Express, Request, Response, NextFunction } from 'express';
import { sameOrigin } from './origin';
import { clientRateKey } from './clientAddress';

const COOKIE = 'mendez_os_owner';
const SESSION_MS = 12 * 60 * 60 * 1000;
const configuredPassword = process.env.MENDEZ_OS_OWNER_PASSWORD;
if (process.env.NODE_ENV === 'production' && !configuredPassword) {
  throw new Error('MENDEZ_OS_OWNER_PASSWORD is required in production before editor or Board moderation can start.');
}
const password = configuredPassword || randomBytes(24).toString('base64url');
const generated = !configuredPassword;
const sessions = new Map<string, { csrfToken: string; expires: number }>();
const attempts = new Map<string, { count: number; reset: number }>();
const rateSalt = randomBytes(24);

export function announceOwnerBootstrap() {
  if (generated) console.info(`[Mendez OS] Owner password for this server run: ${password}`);
  else console.info('[Mendez OS] Owner password loaded from MENDEZ_OS_OWNER_PASSWORD.');
}
function hash(value: string) { return createHash('sha256').update(value).digest(); }
function cookie(req: Request, name: string): string | undefined {
  const match = (req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}
function session(req: Request) {
  const token = cookie(req, COOKIE);
  if (!token) return undefined;
  const key = hash(token).toString('hex');
  const value = sessions.get(key);
  if (value && value.expires > Date.now()) return value;
  sessions.delete(key);
  return undefined;
}
function secureCookie(req: Request) { return req.secure || req.headers['x-forwarded-proto'] === 'https'; }
function setSessionCookie(req: Request, res: Response, token: string, age: number) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${age}${secureCookie(req) ? '; Secure' : ''}`);
}
export function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (!session(req)) { res.status(401).json({ error: 'Owner sign-in required.' }); return; }
  next();
}
export function requireOwnerCsrf(req: Request, res: Response, next: NextFunction) {
  const current = session(req);
  if (!current) { res.status(401).json({ error: 'Owner sign-in required.' }); return; }
  const supplied = req.header('x-mendez-csrf');
  if (!sameOrigin(req) || !supplied || supplied !== current.csrfToken) {
    res.status(403).json({ error: 'Invalid owner request token.' }); return;
  }
  next();
}
export function mountOwnerAuthRoutes(app: Express) {
  app.get('/api/owner/session', (req, res) => {
    const current = session(req);
    res.setHeader('Cache-Control', 'no-store');
    res.json(current ? { authenticated: true, csrfToken: current.csrfToken } : { authenticated: false });
  });
  app.post('/api/owner/login', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!sameOrigin(req)) { res.status(403).json({ error: 'Origin not allowed.' }); return; }
    const ip = clientRateKey(req, rateSalt);
    const now = Date.now();
    const entry = attempts.get(ip) || { count: 0, reset: now + 15 * 60 * 1000 };
    if (now > entry.reset) { entry.count = 0; entry.reset = now + 15 * 60 * 1000; }
    if (entry.count >= 8) { res.status(429).json({ error: 'Too many attempts. Try again later.' }); return; }
    const incoming = typeof req.body?.password === 'string' ? req.body.password : '';
    const valid = incoming.length > 0 && timingSafeEqual(hash(incoming), hash(password));
    if (!valid) {
      entry.count += 1; attempts.set(ip, entry);
      res.status(401).json({ error: 'Incorrect owner password.' }); return;
    }
    attempts.delete(ip);
    const token = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(24).toString('base64url');
    sessions.set(hash(token).toString('hex'), { csrfToken, expires: now + SESSION_MS });
    setSessionCookie(req, res, token, Math.floor(SESSION_MS / 1000));
    res.json({ authenticated: true, csrfToken });
  });
  app.post('/api/owner/logout', requireOwnerCsrf, (req, res) => {
    const token = cookie(req, COOKIE);
    if (token) sessions.delete(hash(token).toString('hex'));
    setSessionCookie(req, res, '', 0);
    res.json({ authenticated: false });
  });
}
