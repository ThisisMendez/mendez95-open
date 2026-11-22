import type { Request } from 'express';

/** Read-only review mode can never be enabled on a production or remote request. */
export function isLocalReview(req: Request): boolean {
  const address = req.socket.remoteAddress;
  return process.env.NODE_ENV !== 'production'
    && process.env.MENDEZ_OS_LOCAL_REVIEW === '1'
    && (address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1');
}
