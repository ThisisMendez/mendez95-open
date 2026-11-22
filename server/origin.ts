import type { Request } from 'express';

/** Browser write boundary shared by owner and visitor POST endpoints. */
export function sameOrigin(req: Request): boolean {
  const header = req.headers.origin;
  if (!header) return true; // Non-browser clients still face owner auth/CSRF where required.
  try {
    const origin = new URL(header);
    if (origin.host === req.headers.host) return true;
    // The local Vite proxy forwards the browser Origin (5173) while the API
    // sees its own Host (3334). Accept only this exact loopback development pair.
    return process.env.NODE_ENV !== 'production'
      && origin.protocol === 'http:'
      && ['127.0.0.1', 'localhost'].includes(origin.hostname)
      && origin.port === '5173'
      && ['127.0.0.1:3334', 'localhost:3334'].includes(req.headers.host || '');
  } catch { return false; }
}
