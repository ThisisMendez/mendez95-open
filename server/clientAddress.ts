import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request } from 'express';

type AddressRequest = Pick<Request, 'socket' | 'headers' | 'header'>;
function normalized(value: string): string { return value.startsWith('::ffff:') ? value.slice(7) : value; }
function isPrivate(value: string): boolean {
  const ip = normalized(value);
  if (isIP(ip) === 4) {
    const parts = ip.split('.').map(Number);
    const a = parts[0]!, b = parts[1]!;
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 168 || b === 0))
      || (a === 198 && (b === 18 || b === 19 || (b === 51 && parts[2] === 100)))
      || (a === 203 && b === 0 && parts[2] === 113);
  }
  if (isIP(ip) === 6) return ip === '::' || ip === '::1' || /^(?:fc|fd|fe[89ab]|ff|2001:db8:)/i.test(ip);
  return true;
}
function trustedFlySocket(value: string): boolean {
  const ip = normalized(value);
  if (!isPrivate(ip) || ip === '::1' || ip.startsWith('127.')) return false;
  if (isIP(ip) === 4) return /^(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)/.test(ip);
  return isIP(ip) === 6 && /^fdaa:/i.test(ip);
}
/** A public client IP only. Never trusts X-Forwarded-For or req.ip. */
export function clientAddress(req: AddressRequest): string | null {
  const socket = normalized(req.socket.remoteAddress || '');
  if (process.env.FLY_APP_NAME && process.env.MENDEZ_OS_TRUST_FLY_PROXY === 'true' && trustedFlySocket(socket)) {
    const candidate = normalized(req.header('Fly-Client-IP') || '');
    if (isIP(candidate) && !isPrivate(candidate)) return candidate;
  }
  return isIP(socket) && !isPrivate(socket) ? socket : null;
}
/** Ephemeral rate identity. Only the caller's random salt and hash are retained. */
export function clientRateKey(req: AddressRequest, salt: Uint8Array): string {
  const value = clientAddress(req) || normalized(req.socket.remoteAddress || '') || 'unknown';
  return createHmac('sha256', salt).update(value).digest('hex');
}
