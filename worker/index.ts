import { HttpError, json, type Env } from './env';
import { Repository } from './storage';
import { authRoute } from './security';
import { contentRoute } from './content';
import { boardRoute, scoresRoute } from './interactive';
import { guideRoute } from './guide';
import { mailRoute } from './mail';
import { widgetsRoute } from './widgets';
import {refreshXPost} from './xProfile';
import {videoResponse} from './video';
const forbidden = /^\/(?:\.env(?:\.|\/|$)|\.local(?:\/|$)|\.git(?:\/|$)|content(?:\/|$)|content-media(?:\/|$)|server(?:\/|$)|server-assets(?:\/|$)|planning(?:\/|$)|node_modules(?:\/|$)|src(?:\/|$)|@fs(?:\/|$))/;
const handler = {
    async fetch(r: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        try {
            const u = new URL(r.url);
            let p: string;
            try {
                p = decodeURIComponent(u.pathname);
            }
            catch {
                return json({ error: 'Not found.' }, 404);
            }
            if (forbidden.test(p) || p.includes('..') || p.includes('\\') || p.includes('\0') || /^\/api\/(?:resume\/(?:access|download\.pdf)|owner\/resume\/(?:document|approve|upload))(?=\/|$)/.test(p))
                return json({ error: 'Not found.' }, 404);
            if (env.CANONICAL_HOST && u.hostname === `www.${env.CANONICAL_HOST}`) {
                u.hostname = env.CANONICAL_HOST;
                u.protocol = 'https:';
                return Response.redirect(u.href, 308);
            }
            const repo = new Repository(env.DB);
            if (p === '/api/health' && r.method === 'GET')
                return json({ ok: true, app: 'Mendez 95', runtime: 'cloudflare', schema: 4 });
            if (p === '/api/review-session' && r.method === 'GET')
                return json({ localReview: false });
            if (p === '/api/resolve-route' && r.method === 'GET') {
                const path = u.searchParams.get('path') || '';
                if (!/^\/[a-z0-9\-/]+$/.test(path))
                    return json({ target: null });
                const row = await env.DB.prepare('SELECT target FROM redirects WHERE path=?').bind(path).first<{
                    target: string;
                }>();
                return json({ target: row?.target || null });
            }
            for (const handler of [authRoute, contentRoute, boardRoute, scoresRoute, guideRoute, mailRoute, widgetsRoute]) {
                const result = await handler(r, env, repo);
                if (result)
                    return result;
            }
            if (p.startsWith('/api/') || p.startsWith('/media/'))
                return json({ error: 'Unknown API route.' }, 404);
            if (!['GET', 'HEAD'].includes(r.method))
                return json({ error: 'Not found.' }, 404);
            const redirect = await env.DB.prepare('SELECT target FROM redirects WHERE path=?').bind(p).first<{
                target: string;
            }>();
            if (redirect && /^\/(?!\/)[a-z0-9/-]+$/.test(redirect.target)) {
                const target = new URL(redirect.target, u);
                target.search = u.search;
                return Response.redirect(target.href, 308);
            }
            let assetRequest = r;
            if (/^\/videos\/[a-z0-9-]+\.mp4$/.test(p)) {
                const headers = new Headers(r.headers);
                headers.set('Accept-Encoding', 'identity');
                headers.delete('Range');
                headers.delete('If-Range');
                assetRequest = new Request(r, {headers});
            }
            const response = await env.ASSETS.fetch(assetRequest);
            if (response.status !== 404)
                return await videoResponse(r, response);
            // SPA only for application routes, never arbitrary private/filesystem paths.
            if (/^\/(?:work|about|resume|contact|field-notes|ai-lab|side-projects|photos|guide|games|board|settings|accessories|system-about|system-update|find|help|run|shutdown|paint|tools|weather|world-time|pocket-radio|visitor-log|signal|mendez-world|editor|safe-mode)(?:\/[A-Za-z0-9_-]+)?\/?$/.test(p) || p === '/') {
                const index = new URL('/index.html', u);
                return env.ASSETS.fetch(new Request(index, { method: r.method }));
            }
            return json({ error: 'Not found.' }, 404);
        }
        catch (error) {
            if (error instanceof HttpError)
                return json({ error: error.message }, error.status);
            return json({ error: 'This service is temporarily unavailable. Please retry later.' }, 503);
        }
    },
    async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        ctx.waitUntil(Promise.all([new Repository(env.DB).prune(), refreshXPost(env)]));
    }
};
export default {
    async fetch(r: Request, env: Env, ctx: ExecutionContext) {
        if (r.method !== 'HEAD')
            return handler.fetch(r, env, ctx);
        const response = await handler.fetch(new Request(r, { method: 'GET' }), env, ctx);
        await response.body?.cancel();
        return new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers });
    },
    scheduled: handler.scheduled
};
