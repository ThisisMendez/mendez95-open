import { illustrativeDaysThrough, visitorDisplayFromAggregates, SNAPSHOT_CUTOFF, type VisitAggregate, type IllustrativeDay } from '../server/visitorDisplay';
import { body, fail, json, type Env } from './env';
import { Repository } from './storage';
import { owner } from './security';
import {cachedXPost} from './xProfile';
type Location = {
    city: string;
    country: string;
    countryCode: string;
    latitude: number;
    longitude: number;
    timezone: string;
    approximate: boolean;
};
const EXAMPLE_CITY: Location = { city: 'London', country: 'United Kingdom', countryCode: 'GB', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London', approximate: false };
const MUSIC_LINK = 'https://on.soundcloud.com/1PrLXX8NYwUe5P5fdE', MUSIC_CANONICAL = 'https://soundcloud.com/coolioofficial/gangstas-paradise-feat-l-v';
async function fetchJSON(url: string, headers?: HeadersInit) { const r = await fetch(url, { headers, signal: AbortSignal.timeout(4000) }); if (!r.ok)
    throw Error('Provider unavailable'); return body(r, 262144); }
function location(data: any, approximate: boolean): Location | null { const city = data.city || data.name, timezone = typeof data.timezone === 'string' ? data.timezone : data.timezone?.id; if (typeof city !== 'string' || !city.trim() || typeof data.latitude !== 'number' || typeof data.longitude !== 'number' || !Number.isFinite(data.latitude) || !Number.isFinite(data.longitude) || Math.abs(data.latitude) > 90 || Math.abs(data.longitude) > 180 || typeof timezone !== 'string' || timezone.length > 80)
    return null; try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
}
catch {
    return null;
} return { city: city.trim().slice(0, 100), country: typeof data.country === 'string' ? data.country.slice(0, 100) : '', countryCode: /^[a-z]{2}$/i.test(data.country_code) ? data.country_code.toUpperCase() : 'ZZ', latitude: data.latitude, longitude: data.longitude, timezone, approximate }; }
async function weather(env: Env, repo: Repository, l: Location) { if (env.EXTERNAL_FETCH_ENABLED !== 'true')
    return null; return repo.cache(`weather:${l.latitude.toFixed(2)}:${l.longitude.toFixed(2)}:${l.timezone}`, 600000, async () => { const params = new URLSearchParams({ latitude: String(l.latitude), longitude: String(l.longitude), current: 'temperature_2m,weather_code,is_day', timezone: l.timezone, daily: 'weather_code,temperature_2m_max,temperature_2m_min', forecast_days: '5' }); const d = await fetchJSON(`https://api.open-meteo.com/v1/forecast?${params}`), c = d.current; if (!c || !Number.isFinite(c.temperature_2m) || !Number.isFinite(c.weather_code) || typeof c.time !== 'string')
    throw Error(); const daily = d.daily; return { temperatureC: c.temperature_2m, code: c.weather_code, isDay: Boolean(c.is_day), observedAt: c.time, source: 'Open-Meteo', forecast: Array.isArray(daily?.time) ? daily.time.slice(0, 5).flatMap((date: unknown, i: number) => typeof date === 'string' && Number.isFinite(daily.weather_code?.[i]) && Number.isFinite(daily.temperature_2m_max?.[i]) && Number.isFinite(daily.temperature_2m_min?.[i]) ? [{ date, code: daily.weather_code[i], highC: daily.temperature_2m_max[i], lowC: daily.temperature_2m_min[i] }] : []) : [] }; }, 'weather', 9000); }
async function music(env: Env, repo: Repository) { const fallback = { title: 'SoundCloud selection', embedUrl: null, checkedAt: Date.now() }; if (env.EXTERNAL_FETCH_ENABLED !== 'true')
    return fallback; return await repo.cache('music', 86400000, async () => { const data = await fetchJSON(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(MUSIC_CANONICAL)}&auto_play=false`); const match = typeof data.html === 'string' ? data.html.match(/\bsrc="([^"]+)"/) : null; if (data.provider_name !== 'SoundCloud' || !match)
    throw Error(); const u = new URL(match[1].replace(/&amp;/g, '&')); if (u.protocol !== 'https:' || u.hostname !== 'w.soundcloud.com' || u.pathname !== '/player/')
    throw Error(); u.searchParams.set('auto_play', 'false'); return { title: typeof data.title === 'string' ? data.title.slice(0, 100) : fallback.title, embedUrl: u.toString(), checkedAt: Date.now() }; }, 'soundcloud', 100) || fallback; }
export async function widgetsRoute(r: Request, env: Env, repo: Repository): Promise<Response | null> {
    const u = new URL(r.url), p = u.pathname;
    if (!p.startsWith('/api/widgets') && p !== '/api/owner/analytics')
        return null;
    if (r.method !== 'GET')
        return null;
    if (p === '/api/widgets/city') {
        const q = u.searchParams.get('q')?.trim() || '';
        if (!/^[\p{L}\p{M}\p{N} .,'-]{2,70}$/u.test(q))
            fail(400, 'Enter a city name.');
        await repo.limit(r, 'city-search', 30, 60000);
        if (env.EXTERNAL_FETCH_ENABLED !== 'true')
            fail(503, 'City search is unavailable.');
        const matches = await repo.cache(`city:${q.toLowerCase()}`, 3600000, async () => { const d = await fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: q, count: '5', language: 'en', format: 'json' })}`); return Array.isArray(d.results) ? d.results.map((v: any) => location(v, false)).filter(Boolean) : []; }, 'weather', 9000);
        if (matches === null)
            fail(503, 'City search is unavailable.');
        return json({ matches });
    }
    if (p === '/api/widgets/weather') {
        const latitude = Number(u.searchParams.get('lat')), longitude = Number(u.searchParams.get('lon')), timezone = u.searchParams.get('timezone') || '';
        if (!u.searchParams.get('lat')?.trim() || !u.searchParams.get('lon')?.trim())
            fail(400, 'Invalid location.');
        const l = location({ name: 'Manual city', latitude, longitude, timezone }, false);
        if (!l)
            fail(400, 'Invalid location or timezone.');
        await repo.limit(r, 'weather', 60, 60000);
        return json({ weather: await weather(env, repo, l) });
    }
    if (p === '/api/owner/analytics') {
        await owner(r, env);
        const total = await env.DB.prepare('SELECT count(*) AS total FROM visits').first<{
            total: number;
        }>();
        const countries = (await env.DB.prepare('SELECT country AS code,count(*) AS count FROM visits GROUP BY country ORDER BY count DESC LIMIT 250').all()).results;
        const days = (await env.DB.prepare("SELECT COALESCE(day,'Earlier') AS day,count(*) AS count FROM visits GROUP BY day ORDER BY day LIMIT 4000").all<{
            day: string;
            count: number;
        }>()).results;
        return json({ actual: { total: total!.total, countries, daily: Object.fromEntries(days.map(v => [v.day, v.count])), definition: 'Measured daily unique public visits; local preview excluded.' }, display: { ...await display(env), definition: 'Combined public display: approved snapshot, tagged illustrative daily activity and later measured visits. Actual analytics above exclude all illustrative activity.' } });
    }
    if (p !== '/api/widgets')
        return null;
    await repo.limit(r, 'widgets', 120, 60000);
    const identity = await repo.identity(r);
    let local: Location | null = null;
    if (identity.cf) {
        const cf = identity.cf;
        local = location({ city: cf.city, country: cf.country, country_code: cf.country, latitude: Number(cf.latitude), longitude: Number(cf.longitude), timezone: cf.timezone }, true);
    }
    // The native edge metadata needs no third-party IP lookup; no raw IP is stored.
    if (env.ANALYTICS_ENABLED !== 'false' && identity.ip && env.RUNTIME_ENV === 'production' && new URL(r.url).hostname === env.CANONICAL_HOST) {
        const day = new Date().toISOString().slice(0, 10), dayHash = await repo.hmac(`${day}:${identity.ip}`), visit = { dayHash, day, country: local?.countryCode || 'ZZ', ...(local ? { city: local.city } : {}), recordedAt: new Date().toISOString() };
        await env.DB.prepare('INSERT OR IGNORE INTO visits VALUES(?,?,?,?,?,?)').bind(dayHash, day, visit.country, local?.city || null, visit.recordedAt, JSON.stringify(visit)).run();
    }
    const [exampleCityWeather, localWeather, track, post] = await Promise.all([weather(env, repo, EXAMPLE_CITY), local ? weather(env, repo, local) : Promise.resolve(null), music(env, repo), cachedXPost(env)]);
    // Read the lightweight aggregates after recording this visit; a cached display must not hide new arrivals.
    const activity = await display(env);
    if (!activity)
        fail(503, 'Visitor totals are temporarily unavailable.');
    return json({ exampleCity: { location: EXAMPLE_CITY, weather: exampleCityWeather }, local: { location: local || EXAMPLE_CITY, weather: local ? localWeather : exampleCityWeather, fallback: !local }, visitors: { total: activity.total, countries: activity.countries }, activity, xPost: post, xUrl: 'https://x.com/exampleowner', music: { url: MUSIC_LINK, canonicalUrl: MUSIC_CANONICAL, ...track } });
}
export async function ensureIllustrativeDays(env:Env,now=new Date()):Promise<IllustrativeDay[]>{
    const existing=(await env.DB.prepare('SELECT day FROM illustrative_days').all<{day:string}>()).results;
    const known=new Set(existing.map(row=>row.day)),days=illustrativeDaysThrough(now).filter(day=>!known.has(day));
    if(days.length)await env.DB.batch(days.map(day=>env.DB.prepare("INSERT OR IGNORE INTO illustrative_days(day,allocation,origin,created_at) VALUES(?,5+(abs(random()%7)),'illustrative',?)").bind(day,now.toISOString())));
    return (await env.DB.prepare('SELECT day,allocation,origin FROM illustrative_days WHERE day<=? ORDER BY day').bind(now.toISOString().slice(0,10)).all<IllustrativeDay>()).results;
}
export async function display(env: Env) { const now = new Date(), today = now.toISOString().slice(0, 10); const rows = (await env.DB.prepare("SELECT day,COALESCE(city,'Unspecified city') AS city,country,count(*) AS count FROM visits WHERE day<=? AND ((recorded_at>? AND recorded_at<=?) OR (recorded_at IS NULL AND day>?)) GROUP BY day,country,city ORDER BY day,country,city LIMIT 10001").bind(today, SNAPSHOT_CUTOFF, now.toISOString(), SNAPSHOT_CUTOFF.slice(0, 10)).all<VisitAggregate>()).results; if (rows.length > 10000)
    throw Error('Visitor aggregation capacity reached'); return visitorDisplayFromAggregates(rows, now,await ensureIllustrativeDays(env,now)); }
