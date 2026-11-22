import { sources, rank, localAnswer, playfulAnswer, tokens, SPECIFIC_FACT_TERMS, parseGuideRequest, retrievalQuestion, guideTopic, currentFactLimitation, privacyRefusal, socialQuestion, fallbackAnswer, type Source, type Answer } from '../server/guideCore';
import { body, fail, hash, json, requireOrigin, type Env } from './env';
import { readContent, versions } from './content';
import type { SiteContentView } from '../src/content/types';
import { Repository } from './storage';
import { generatedAnswer } from '../server/guideGeneration';
export { generatedAnswer } from '../server/guideGeneration';
export const MODEL_DAILY_LIMIT = 20;
export async function guideRoute(r: Request, env: Env, repo: Repository): Promise<Response | null> {
    const p = new URL(r.url).pathname;
    if (p === '/api/guide/suggestions' && r.method === 'GET')
        return json({ suggestions: ['Who is Jordan?', 'Tell me a joke.', 'What can you do?', 'Are you an AI?'] });
    if (p !== '/api/guide' || r.method !== 'POST')
        return null;
    requireOrigin(r);
    const request = parseGuideRequest(await body(r));
    if (!request) fail(400, 'Write up to 300 characters with a valid persona and completed conversation context.');
    const { question } = request;
    await repo.limit(r, 'guide-local', 30, 60000);
    if (privacyRefusal(question)) return json(localAnswer([], false));
    const revision = await versions(env), approvals = (await env.DB.prepare('SELECT id,source_hash FROM publication ORDER BY id').all()).results;
    const indexKey = 'guide-index:v2:' + await hash(JSON.stringify({ revision, approvals }));
    const pool = await repo.cache<Source[]>(indexKey, 3600000, async () => sources(await readContent(env) as SiteContentView), 'guide-index', 1000) || sources(await readContent(env) as SiteContentView);
    if(guideTopic(request,pool)==='current')return json(currentFactLimitation(request.persona));
    const resolved = retrievalQuestion(request, pool);
    const facts = tokens(question).filter(w => SPECIFIC_FACT_TERMS.has(w));
    const introduction = /^(?:who is|tell me about) jordan(?: mendez)?[?.! ]*$/i.test(question) ? pool.filter(s => s.id === 'introduction:journey') : [];
    const candidates = playfulAnswer(question) ? [] : (introduction.length ? introduction : rank(resolved, pool).map(v => v.source)).filter(s => facts.every(w => tokens(s.search).includes(w))).slice(0, 4);
    const local = !candidates.length && socialQuestion(question) ? fallbackAnswer(question, request.persona) : localAnswer(candidates, /\b(link|links|source|sources|where|find|open|navigate|download|contact|read|visit)\b/i.test(question));
    if (env.MODEL_ENABLED !== 'true' || env.MODEL_FREE_TIER_CONFIRMED !== 'true' || !env.GEMINI_API_KEY || env.MODEL_NAME !== 'gemini-3.5-flash-lite')
        return json(local);
    const { key } = await repo.identity(r), minute = Math.floor(Date.now() / 60000), day = providerDay();
    // Both counters claimed in a single transaction; model quota is never isolate-local.
    const claim = crypto.randomUUID();
    const visitorKey = `model-visitor:${key}:${minute}`, dailyKey = `model-global:${day}`, minuteKey = `model-minute:${minute}`;
    const results = await env.DB.batch([
        env.DB.prepare("INSERT OR IGNORE INTO quotas VALUES(?,0,?)").bind(visitorKey, Date.now() + 120000),
        env.DB.prepare("INSERT OR IGNORE INTO quotas VALUES(?,0,?)").bind(minuteKey, Date.now() + 120000),
        env.DB.prepare("INSERT OR IGNORE INTO quotas VALUES(?,0,?)").bind(`model-global:${day}`, Date.now() + 172800000),
        env.DB.prepare("INSERT INTO quotas(key,count,expires_at) SELECT ?,1,? WHERE (SELECT count FROM quotas WHERE key=?)<10 AND (SELECT count FROM quotas WHERE key=?)<? AND (SELECT count FROM quotas WHERE key=?)<10").bind(`model-claim:${claim}`, Date.now() + 60000, visitorKey, dailyKey, MODEL_DAILY_LIMIT, minuteKey),
        env.DB.prepare('UPDATE quotas SET count=count+1 WHERE key IN (?,?,?) AND EXISTS(SELECT 1 FROM quotas WHERE key=?)').bind(visitorKey, dailyKey, minuteKey, `model-claim:${claim}`)
    ]);
    if (!results[3].meta.changes)
        return json({ ...local, fallbackReason: 'quota' });
    let diagnostic:{stage:string;status?:number;reason?:string}|undefined;
    const generated = await generatedAnswer(question, candidates, env, value=>{diagnostic=value;}, request);
    return json(generated || { ...local, fallbackReason: 'provider-unavailable',...(env.RUNTIME_ENV==='staging'?{providerDiagnostic:diagnostic}:{}) });
}

// Gemini daily quotas reset at midnight America/Los_Angeles, including DST.
export function providerDay(now = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
