import type { SiteContent, SiteContentView } from '../src/content/types';
import { parsePhotoMediaPath } from '../src/content/mediaPath';
import { toPublicContent, validateSiteContent } from '../src/content/validation';
import { body, fail, hash, json, randomToken, type Env } from './env';
import { owner } from './security';
import { Repository } from './storage';
export const collections = { stories: 'stories', 'field-notes': 'fieldNotes', photos: 'photos', resume: 'resume', about: 'about', elsewhere: 'elsewhere' } as const;
export type Collection = keyof typeof collections;
export async function readContent(env: Env, preview = false): Promise<SiteContent | SiteContentView> {
    const rows = await env.DB.prepare('SELECT collection,json FROM content').all<{
        collection: Collection;
        json: string;
    }>();
    if (rows.results.length !== 6)
        fail(503, 'Content has not been imported.');
    const content = Object.fromEntries(rows.results.map(r => [collections[r.collection], JSON.parse(r.json)])) as unknown as SiteContent;
    delete content.resume.downloadUrl;
    if (preview)
        return content;
    // Explicit approved snapshots are hash-bound, not a blanket review-mode switch.
    const approvals = (await env.DB.prepare('SELECT id,source_hash FROM publication').all<{
        id: string;
        source_hash: string;
    }>()).results;
    for (const approval of approvals) {
        const story = content.stories.find(s => s.id === approval.id);
        if (story && story.status !== 'hidden' && story.disclosureStatus !== 'restricted' && story.caseStage !== 'preview' && await hash(JSON.stringify(story)) === approval.source_hash) {
            story.status = 'published';
            story.disclosureStatus = 'cleared';
        }
    }
    return toPublicContent(content);
}
export async function versions(env: Env) { return Object.fromEntries((await env.DB.prepare('SELECT collection,version FROM content').all<{
    collection: string;
    version: number;
}>()).results.map(v => [v.collection, v.version])); }
async function save(env: Env, name: Collection, value: unknown, expected: number) {
    if (!Number.isInteger(expected))
        fail(428, 'Reload content before saving; a revision is required.');
    const previous = await readContent(env, true) as SiteContent;
    const next = structuredClone(previous);
    (next as unknown as Record<string, unknown>)[collections[name]] = value;
    if (name === 'photos') {
        for (const photo of next.photos) {
            if (photo.status === 'published' && photo.src.startsWith('/api/editor/media/')) {
                const path = photo.src.slice('/api/editor/media/'.length), stored = await env.DB.prepare('SELECT ready FROM media WHERE path=?').bind(`editor/${path}`).first<{
                    ready: number;
                }>();
                if (!stored?.ready)
                    fail(422, 'The private upload is incomplete.');
                photo.src = `/media/editor/${path}`;
            }
        }
    }
    const issues = validateSiteContent(next);
    if (issues.length)
        return json({ issues }, 422);
    const now = new Date().toISOString(), statements = [env.DB.prepare('UPDATE content SET json=?,version=version+1,updated_at=? WHERE collection=? AND version=?').bind(JSON.stringify(next[collections[name]]), now, name, expected)];
    if (name === 'stories') {
        for (const old of previous.stories) {
            const updated = next.stories.find(s => s.id === old.id);
            if (updated && old.slug !== updated.slug) {
                const base = (kind: string) => kind === 'side-project' ? '/side-projects' : kind === 'ai-lab' ? '/ai-lab' : '/work';
                statements.push(env.DB.prepare('INSERT INTO redirects(path,target) SELECT ?,? WHERE EXISTS(SELECT 1 FROM content WHERE collection=? AND version=? AND updated_at=?) ON CONFLICT(path) DO UPDATE SET target=excluded.target').bind(`${base(old.kind)}/${old.slug}`, `${base(updated.kind)}/${updated.slug}`, name, expected + 1, now));
            }
        }
    }
    const result = await env.DB.batch(statements);
    if (!result[0].meta.changes)
        fail(409, 'Content changed in another session. Reload before saving.');
    return json({ value: next[collections[name]], version: expected + 1 });
}
export function imageType(data: Uint8Array) { if (data.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => data[i] === v))
    return 'png'; if (data[0] === 255 && data[1] === 216 && data[2] === 255)
    return 'jpg'; if (new TextDecoder().decode(data.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(data.slice(8, 12)) === 'WEBP')
    return 'webp'; return null; }
export async function serveMedia(r: Request, env: Env, path: string, privateRoute = false) {
    let allowed = false;
    try {
        await owner(r, env);
        allowed = true;
    }
    catch { /* anonymous public references only */ }
    if (!allowed && !privateRoute) {
        const publicView = await readContent(env) as SiteContentView;
        const src = `/media/${path}`;
        allowed = publicView.photos.some(p => p.src === src && p.rightsCleared) || publicView.stories.some(s => s.caseMedia?.some(m => m.src === src && m.rightsCleared)) || publicView.fieldNotes.some(n => n.coverSrc === src);
    }
    if (!allowed)
        return json({ error: 'Not found.' }, 404);
    const meta = await env.DB.prepare('SELECT * FROM media WHERE path=? AND ready=1').bind(path).first<{
        mime: string;
        size: number;
        sha256: string;
        chunks: number;
    }>();
    if (!meta)
        return json({ error: 'Not found.' }, 404);
    if (r.method === 'HEAD')
        return new Response(null, { headers: { 'Content-Type': meta.mime, 'Content-Length': String(meta.size), 'Cache-Control': 'private, no-store' } });
    if (r.method !== 'GET')
        return json({ error: 'Not found.' }, 404);
    let part = 0;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if(part>=meta.chunks){controller.close();return;}
        const rows=(await env.DB.prepare('SELECT part,bytes FROM media_chunks WHERE path=? AND part>=? AND part<? ORDER BY part').bind(path,part,Math.min(part+8,meta.chunks)).all<{part:number;bytes:ArrayBuffer}>()).results;
        if(rows.length!==Math.min(8,meta.chunks-part)){controller.error(new Error('Incomplete media'));return;}
        for(const row of rows){if(row.part!==part++){controller.error(new Error('Invalid media order'));return;}controller.enqueue(new Uint8Array(row.bytes));}
      }
    });
    return new Response(stream, { headers: { 'Content-Type': meta.mime, 'Content-Length': String(meta.size), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" } });
}
export async function contentRoute(r: Request, env: Env, repo: Repository): Promise<Response | null> {
    const u = new URL(r.url), p = u.pathname;
    if (p === '/api/content' && r.method === 'GET') {
        if (u.searchParams.get('review') === '1')
            fail(401, 'Local review is not available on the Worker.');
        const preview = u.searchParams.get('preview') === '1';
        if (preview)
            await owner(r, env);
        return json(await readContent(env, preview));
    }
    if (p === '/api/editor/content' && r.method === 'GET') {
        await owner(r, env);
        return json(await readContent(env, true), 200, { 'X-Mendez-Revisions': JSON.stringify(await versions(env)) });
    }
    let m = p.match(/^\/api\/editor\/(content|restore|backups)\/([a-z-]+)$/);
    if (m && m[2] in collections) {
        const name = m[2] as Collection;
        await owner(r, env, r.method !== 'GET');
        if (m[1] === 'backups' && r.method === 'GET')
            return json({ backups: (await env.DB.prepare('SELECT id,saved_at AS savedAt FROM revisions WHERE collection=? ORDER BY saved_at DESC,id DESC LIMIT 30').bind(name).all()).results });
        if (m[1] === 'content' && r.method === 'PUT')
            return save(env, name, await body(r, 1900000), Number(r.headers.get('if-match')?.replace(/"/g, '')));
        if (m[1] === 'restore' && r.method === 'POST') {
            const b = await body(r);
            const row = await env.DB.prepare('SELECT json FROM revisions WHERE collection=? AND id=?').bind(name, typeof b.backup === 'string' ? b.backup : '').first<{
                json: string;
            }>();
            if (!row)
                fail(404, 'Backup not found.');
            return save(env, name, JSON.parse(row.json), Number(r.headers.get('if-match')?.replace(/"/g, '')));
        }
    }
    if (p.startsWith('/media/')) {
        if (!parsePhotoMediaPath(p))
            return json({ error: 'Not found.' }, 404);
        return serveMedia(r, env, p.slice(7));
    }
    m = p.match(/^\/api\/editor\/media\/([a-f0-9-]+\.(png|jpg|webp))$/);
    if (m)
        return serveMedia(r, env, `editor/${m[1]}`, true);
    // Bounded upload sessions avoid decoding a 6.7MB JSON string in a Free Worker request.
    if (p === '/api/editor/uploads' && r.method === 'POST') {
        const session = await owner(r, env, true);
        await repo.limit(r, 'uploads', 20, 3600000);
        const b = await body(r), size = b.size, ext = b.type === 'image/png' ? 'png' : b.type === 'image/jpeg' ? 'jpg' : b.type === 'image/webp' ? 'webp' : null;
        if (!ext || !Number.isInteger(size) || size < 1 || size > 5000000 || typeof b.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(b.sha256))
            fail(400, 'Choose a PNG, JPEG or WebP image up to 5 MB.');
        const id = crypto.randomUUID(), path = `editor/${id}.${ext}`;
        await env.DB.prepare('INSERT INTO media VALUES(?,?,?,?,?,0,?,?)').bind(path, b.type, size, b.sha256, Math.ceil(size / 262144), Date.now(), session.token_hash).run();
        return json({ id: `${id}.${ext}`, chunkSize: 262144 }, 201);
    }
    m = p.match(/^\/api\/editor\/uploads\/([a-f0-9-]+\.(png|jpg|webp))(?:\/(\d+|complete))?$/);
    if (m) {
        const session = await owner(r, env, true), path = `editor/${m[1]}`, part = m[3];
        const meta = await env.DB.prepare('SELECT * FROM media WHERE path=? AND owner=? AND ready=0 AND created_at>?').bind(path, session.token_hash, Date.now() - 3600000).first<{
            size: number;
            chunks: number;
            sha256: string;
            mime: string;
        }>();
        if (!meta)
            fail(404, 'Upload not found or expired.');
        if (r.method === 'DELETE') {
            await env.DB.prepare('DELETE FROM media WHERE path=? AND ready=0 AND owner=?').bind(path, session.token_hash).run();
            return json({ removed: true });
        }
        if (r.method === 'PUT' && part && /^\d+$/.test(part)) {
            const index = Number(part);
            if (index < 0 || index >= meta.chunks)
                fail(400, 'Invalid image part.');
            if (Number(r.headers.get('content-length')) > 262144)
                fail(413, 'Image part too large.');
            const reader = r.body?.getReader();
            if (!reader)
                fail(400, 'Image part is empty.');
            let size = 0;
            const pieces: Uint8Array[] = [];
            while (true) {
                const c = await reader.read();
                if (c.done)
                    break;
                size += c.value.length;
                if (size > 262144) {
                    await reader.cancel();
                    fail(413, 'Image part too large.');
                }
                pieces.push(c.value);
            }
            const data = new Uint8Array(size);
            let offset = 0;
            for (const c of pieces) {
                data.set(c, offset);
                offset += c.length;
            }
            if (size !== Math.min(262144, meta.size - index * 262144))
                fail(400, 'Wrong image part length.');
            if (index === 0 && imageType(data) !== m[2])
                fail(400, 'Image content does not match its type.');
            const changed = await env.DB.prepare('INSERT INTO media_chunks SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM media WHERE path=? AND ready=0 AND owner=?) ON CONFLICT(path,part) DO UPDATE SET bytes=excluded.bytes WHERE EXISTS(SELECT 1 FROM media WHERE path=? AND ready=0 AND owner=?) RETURNING part').bind(path, index, data, path, session.token_hash, path, session.token_hash).first();
            if (!changed)
                fail(409, 'The image is being finalized.');
            return json({ saved: true });
        }
        if (r.method === 'POST' && part === 'complete') {
            const claim = await env.DB.prepare('UPDATE media SET ready=2 WHERE path=? AND owner=? AND ready=0 RETURNING path').bind(path, session.token_hash).first();
            if (!claim)
                fail(409, 'The image is already being finalized.');
            try {
                const rows = (await env.DB.prepare('SELECT part,bytes FROM media_chunks WHERE path=? ORDER BY part').bind(path).all<{
                    part: number;
                    bytes: ArrayBuffer;
                }>()).results;
                const bytes = new Uint8Array(meta.size);
                let offset = 0;
                for (const [i, row] of rows.entries()) {
                    if (row.part !== i)
                        fail(409, 'Upload is incomplete.');
                    const chunk = new Uint8Array(row.bytes);
                    bytes.set(chunk, offset);
                    offset += chunk.length;
                }
                if (rows.length !== meta.chunks || offset !== meta.size || await hash(bytes) !== meta.sha256)
                    fail(409, 'Upload is incomplete or its checksum differs.');
                await env.DB.prepare('UPDATE media SET ready=1 WHERE path=? AND owner=? AND ready=2').bind(path, session.token_hash).run();
                return json({ src: `/api/editor/media/${m[1]}` }, 201);
            }
            catch (error) {
                await env.DB.prepare('UPDATE media SET ready=0 WHERE path=? AND owner=? AND ready=2').bind(path, session.token_hash).run();
                throw error;
            }
        }
    }
    if (p === '/api/editor/media' && r.method === 'POST') {
        await owner(r, env, true);
        return json({ error: 'Use the chunked image upload supported by this editor.', uploadProtocol: 'chunks-v1' }, 426);
    }
    return null;
}
