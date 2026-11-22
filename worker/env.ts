export interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    RUNTIME_ENV: string;
    AUTH_EPOCH: string;
    CANONICAL_HOST?: string;
    ANALYTICS_ENABLED?: string;
    OWNER_AUTH_MODE?: string;
    OWNER_ORIGIN?: string;
    MAIL_FROM?: string;
    MAIL_VERIFIED?: string;
    EMAIL?: {
        send(message: {
            to: string;
            from: string;
            replyTo?: string;
            subject: string;
            text: string;
        }): Promise<unknown>;
    };
    MODEL_ENABLED?: string;
    MODEL_FREE_TIER_CONFIRMED?: string;
    GEMINI_API_KEY?: string;
    MODEL_NAME?: string;
    X_ENABLED?: string;
    X_FREE_ENTITLEMENT_CONFIRMED?: string;
    X_BEARER_TOKEN?: string;
    X_BROWSER_ENABLED?: string;
    X_BROWSER?: BrowserRun;
    EXTERNAL_FETCH_ENABLED?: string;
}
export const json = (value: unknown, status = 200, headers: HeadersInit = {}) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...headers } });
export class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export function fail(status: number, message: string): never { throw new HttpError(status, message); }
export const sameOrigin = (r: Request) => r.headers.get('origin') === new URL(r.url).origin;
export const requireOrigin = (r: Request) => { if (!sameOrigin(r))
    fail(403, 'Origin not allowed.'); };
export async function body(r: Pick<Request, 'headers' | 'body'>, max = 32768): Promise<Record<string, any>> {
    if (Number(r.headers.get('content-length') || 0) > max)
        fail(413, 'Request too large.');
    const reader = r.body?.getReader();
    if (!reader)
        return {};
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
        const result = await reader.read();
        if (result.done)
            break;
        size += result.value.byteLength;
        if (size > max) {
            await reader.cancel();
            fail(413, 'Request too large.');
        }
        chunks.push(result.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.length;
    }
    try {
        const value = JSON.parse(new TextDecoder().decode(bytes));
        if (!value || typeof value !== 'object')
            return fail(400, 'Invalid JSON.');
        return value;
    }
    catch {
        return fail(400, 'Invalid JSON.');
    }
}
export const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
export async function hash(value: string | Uint8Array) { const result = await crypto.subtle.digest('SHA-256', typeof value === 'string' ? new TextEncoder().encode(value) : value as BufferSource); return Array.from(new Uint8Array(result), b => b.toString(16).padStart(2, '0')).join(''); }
export const textField = (v: unknown, max: number) => typeof v === 'string' && v.trim().length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v) ? v.trim() : null;
export const validEmail = (v: unknown): v is string => typeof v === 'string' && v.length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(v);
