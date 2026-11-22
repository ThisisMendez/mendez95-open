import { fail, hash, randomToken, type Env } from './env';
/** All mutable authority is in D1; this repository has no process-local queue. */
export class Repository {
    constructor(public db: D1Database) { }
    async salt() { await this.db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').bind('visitor-salt', randomToken()).run(); return (await this.db.prepare('SELECT value FROM settings WHERE key=?').bind('visitor-salt').first<{
        value: string;
    }>())!.value; }
    async identity(r: Request) { const cf = (r as Request & {
        cf?: IncomingRequestCfProperties;
    }).cf; const u = new URL(r.url); const edge = cf && typeof cf.colo === 'string' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname); const ip = edge ? r.headers.get('CF-Connecting-IP') : null; return { key: await this.hmac(ip || 'local-shared'), ip, cf: edge ? cf : null }; }
    async hmac(value: string) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(await this.salt()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join(''); }
    async take(key: string, max: number, windowMs: number, now = Date.now()) {
        const result = await this.db.prepare('INSERT INTO quotas(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END WHERE expires_at<=? OR count<? RETURNING count').bind(key, now + windowMs, now, now, now, max).first();
        return Boolean(result);
    }
    async limit(r: Request, scope: string, max: number, ms: number) { const { key } = await this.identity(r); if (!await this.take(`${scope}:${key}`, max, ms))
        fail(429, 'Too many requests. Please try again later.'); return key; }
    async cache<T>(key: string, ttl: number, load: () => Promise<T>, budget: string, max: number): Promise<T | null> {
        const now = Date.now();
        const cached = await this.db.prepare('SELECT json,expires_at FROM cache WHERE key=?').bind(key).first<{
            json: string;
            expires_at: number;
        }>();
        if (cached && cached.expires_at > now)
            return JSON.parse(cached.json) as T;
        // A conditional lease prevents two isolates multiplying a provider request.
        const lease = await this.db.prepare("INSERT INTO cache(key,json,expires_at,lease_until) VALUES(?,'null',0,?) ON CONFLICT(key) DO UPDATE SET lease_until=excluded.lease_until WHERE cache.lease_until<=? AND cache.expires_at<=? RETURNING key").bind(key, now + 15000, now, now).first();
        if (!lease)
            return null;
        let value: T | null = null;
        try {
            if (await this.take(`provider:${budget}:${new Date(now).toISOString().slice(0, 10)}`, max, 86400000))
                value = await load();
        }
        catch { /* never store provider errors/secrets */ }
        await this.db.prepare('UPDATE cache SET json=?,expires_at=?,lease_until=0 WHERE key=?').bind(JSON.stringify(value), now + (value === null ? 60000 : ttl), key).run();
        return value;
    }
    async prune() { const now = Date.now(); await this.db.batch([this.db.prepare('DELETE FROM quotas WHERE expires_at<?').bind(now - 86400000), this.db.prepare('DELETE FROM rounds WHERE expires_at<?').bind(now), this.db.prepare('DELETE FROM sessions WHERE expires_at<? OR revoked=1').bind(now),this.db.prepare('DELETE FROM auth_grants WHERE expires_at<? OR used_at IS NOT NULL').bind(now), this.db.prepare('DELETE FROM cache WHERE expires_at<?').bind(now - 86400000), this.db.prepare('DELETE FROM media WHERE ready!=1 AND created_at<?').bind(now - 3600000)]); }
}
