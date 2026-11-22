import { latestXPost } from './xFeed';
import { createHmac, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Express } from 'express';
import { requireOwner } from './auth';
import { visitorDisplay, illustrativeDaysThrough, type IllustrativeDay, type Visit } from './visitorDisplay';
import { clientAddress } from './clientAddress';

type Location = { city: string; country: string; countryCode: string; latitude: number; longitude: number; timezone: string; approximate: boolean };
type Weather = { temperatureC: number; code: number; isDay: boolean; observedAt: string; source: string; forecast?: { date: string; code: number; highC: number; lowC: number }[] } | null;
type Visitor = Visit;
const EXAMPLE_CITY: Location = { city: 'London', country: 'United Kingdom', countryCode: 'GB', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London', approximate: false };
const MUSIC_LINK = 'https://on.soundcloud.com/1PrLXX8NYwUe5P5fdE';
const MUSIC_CANONICAL = 'https://soundcloud.com/coolioofficial/gangstas-paradise-feat-l-v';
const DATA_DIR = resolve(process.env.MENDEZ_OS_DATA_DIR || join(process.cwd(), '.local'));
const VISITORS_FILE = join(DATA_DIR, 'visitors.json');
const SALT_FILE = join(DATA_DIR, 'visitor-salt');
const ILLUSTRATIVE_FILE = join(DATA_DIR, 'illustrative-days.json');
let illustrativeQueue:Promise<unknown>=Promise.resolve();
async function displayActivity(visits:Visit[]){
 const operation=illustrativeQueue.then(async()=>{
  let ledger:IllustrativeDay[]=[];
  try{ledger=JSON.parse(await readFile(ILLUSTRATIVE_FILE,'utf8'));if(!Array.isArray(ledger)||ledger.some(d=>typeof d.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d.day)||!Number.isInteger(d.allocation)||d.allocation<5||d.allocation>11)||new Set(ledger.map(d=>d.day)).size!==ledger.length)throw Error('Malformed illustrative ledger');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const now=new Date(),known=new Set(ledger.map(d=>d.day));let changed=false;
  for(const day of illustrativeDaysThrough(now))if(!known.has(day)){const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);ledger.push({day,allocation:5+bytes[0]!%7,origin:'illustrative'});changed=true;}
  if(changed){await mkdir(DATA_DIR,{recursive:true,mode:0o700});const temp=ILLUSTRATIVE_FILE+'.tmp';await writeFile(temp,JSON.stringify(ledger),{mode:0o600});await rename(temp,ILLUSTRATIVE_FILE);}
  return visitorDisplay(visits,now,ledger);
 });
 illustrativeQueue=operation.catch(()=>undefined);return operation;
}
const geos = new Map<string, { location: Location | null; expires: number }>();
const weathers = new Map<string, { weather: Weather; expires: number }>();
const cities = new Map<string, { matches: Location[]; expires: number }>();
let musicCache: { title: string; embedUrl: string | null; checkedAt: number } | null = null;
let visitorsQueue: Promise<unknown> = Promise.resolve();
let saltCache: string | null = null;
const transientSalt = randomBytes(24);
const externalCalls = new Map<string, { day: string; count: number }>();

async function json(url: string, timeout = 3500): Promise<unknown> {
  const host = new URL(url).hostname;
  const day = new Date().toISOString().slice(0, 10);
  const cap = host === 'ipwho.is' ? 900 : host.endsWith('open-meteo.com') ? 9000 : 1000;
  const quota = externalCalls.get(host) || { day, count: 0 };
  if (quota.day !== day) { quota.day = day; quota.count = 0; }
  if (quota.count >= cap) throw new Error('Free service request budget reached');
  quota.count++; externalCalls.set(host, quota);
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Remote service returned ${response.status}`);
  return response.json();
}
function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {}; }
function parseLocation(value: unknown, approximate: boolean): Location | null {
  const data = object(value), zone = object(data.timezone);
  const rawCity = typeof data.city === 'string' ? data.city : typeof data.name === 'string' ? data.name : '';
  const city=rawCity.trim();
  const country = typeof data.country === 'string' ? data.country.trim() : '';
  const countryCode = typeof data.country_code === 'string' ? data.country_code.toUpperCase() : '';
  const latitude = data.latitude, longitude = data.longitude;
  const timezone = typeof data.timezone === 'string' ? data.timezone : typeof zone.id === 'string' ? zone.id : '';
  if (!city || !country || !/^[A-Z]{2}$/.test(countryCode) || typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180 || !timezone) return null;
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { return null; }
  return { city: city.slice(0, 70), country: country.slice(0, 70), countryCode, latitude, longitude, timezone, approximate };
}
async function ipLocation(ip: string): Promise<Location | null> {
  const key = createHmac('sha256', transientSalt).update(ip).digest('hex');
  const now = Date.now(), cached = geos.get(key);
  if (cached && cached.expires > now) return cached.location;
  let location: Location | null = null;
  try {
    const value = object(await json(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,country,country_code,latitude,longitude,timezone`));
    if (value.success === true) location = parseLocation(value, true);
  } catch { /* London fallback */ }
  geos.set(key, { location, expires: now + (location ? 900_000 : 60_000) });
  if (geos.size > 2500) for (const [key, value] of geos) if (value.expires < now) geos.delete(key);
  return location;
}
async function weatherFor(location: Location): Promise<Weather> {
  const key = `${location.latitude.toFixed(2)}:${location.longitude.toFixed(2)}:${location.timezone}`, now = Date.now();
  const cached = weathers.get(key);
  if (cached && cached.expires > now) return cached.weather;
  let weather: Weather = null;
  try {
    const params = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), current: 'temperature_2m,weather_code,is_day', timezone: location.timezone, daily: 'weather_code,temperature_2m_max,temperature_2m_min', forecast_days: '5' });
    const data = object(await json(`https://api.open-meteo.com/v1/forecast?${params}`));
    const current = object(data.current);
    if (typeof current.temperature_2m === 'number' && typeof current.weather_code === 'number' && Number.isFinite(current.temperature_2m) && Number.isFinite(current.weather_code) && typeof current.time === 'string')
      weather = { temperatureC: current.temperature_2m, code: current.weather_code, isDay: Boolean(current.is_day), observedAt: current.time, source: 'Open-Meteo' };
    const daily = object(data.daily);
    if (weather && Array.isArray(daily.time) && Array.isArray(daily.weather_code) && Array.isArray(daily.temperature_2m_max) && Array.isArray(daily.temperature_2m_min)) {
      const codes=daily.weather_code, highs=daily.temperature_2m_max, lows=daily.temperature_2m_min;
      weather.forecast = daily.time.slice(0,5).flatMap((date,index) => typeof date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && typeof codes[index]==='number' && Number.isFinite(codes[index]) && typeof highs[index]==='number' && Number.isFinite(highs[index]) && typeof lows[index]==='number' && Number.isFinite(lows[index]) ? [{date,code:codes[index],highC:highs[index],lowC:lows[index]}] : []);
    }
  } catch { /* honest unavailable state */ }
  weathers.set(key, { weather, expires: now + (weather ? 10 * 60_000 : 60_000) });
  return weather;
}
async function salt() {
  if (saltCache) return saltCache;
  await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  try { saltCache = (await readFile(SALT_FILE, 'utf8')).trim(); if (saltCache.length >= 32) return saltCache; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  // A separate private salt preserves daily uniqueness across restarts.
  const created = randomBytes(32).toString('hex');
  await writeFile(SALT_FILE, created, { encoding: 'utf8', flag: 'wx', mode: 0o600 }).catch(async error => {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  });
  saltCache = (await readFile(SALT_FILE, 'utf8')).trim();
  return saltCache;
}
async function readVisitors(): Promise<Visitor[]> {
  try {
    const value: unknown = JSON.parse(await readFile(VISITORS_FILE, 'utf8'));
    if (!Array.isArray(value) || !value.every(item => item && typeof item.dayHash === 'string' && /^[a-f0-9]{64}$/.test(item.dayHash) && typeof item.country === 'string' && /^[A-Z]{2}$|^ZZ$/.test(item.country))) throw new Error('Malformed visitor data');
    return value as Visitor[];
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}
async function countVisitor(ip: string | null, country: string | null, city?: string) {
  const operation = visitorsQueue.then(async () => {
    const list = await readVisitors();
    if (ip) {
      const day = new Date().toISOString().slice(0, 10);
      const dayHash = createHmac('sha256', await salt()).update(`${day}:${ip}`).digest('hex');
      if (!list.some(item => item.dayHash === dayHash)) {
        const next = [...list, { dayHash, recordedAt:new Date().toISOString(), country: country && /^[A-Z]{2}$/.test(country) ? country : 'ZZ', day, ...(city?{city}:{}) }];
        await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
        const temp = `${VISITORS_FILE}.${randomBytes(8).toString('hex')}.tmp`;
        await writeFile(temp, JSON.stringify(next), { encoding: 'utf8', mode: 0o600 });
        await rename(temp, VISITORS_FILE);
        return next;
      }
    }
    return list;
  });
  visitorsQueue = operation.catch(() => undefined);
  const list = await operation;
  return list;
}
async function music() {
  if (musicCache && Date.now() - musicCache.checkedAt < 86_400_000) return musicCache;
  let embedUrl: string | null = null, title = 'SoundCloud selection';
  try {
    const endpoint = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(MUSIC_CANONICAL)}&auto_play=false`;
    const response = object(await json(endpoint, 4500));
    if (response.provider_name === 'SoundCloud' && typeof response.html === 'string') {
      const match = response.html.match(/\bsrc="([^"]+)"/);
      if (match) {
        const url = new URL(match[1]!.replace(/&amp;/g, '&'));
        if (url.protocol === 'https:' && url.hostname === 'w.soundcloud.com' && url.pathname === '/player/') {
          url.searchParams.set('auto_play', 'false');
          embedUrl = url.toString();
        }
      }
      if (typeof response.title === 'string') title = response.title.slice(0, 100);
    }
  } catch { /* use verified linked fallback */ }
  musicCache = { title, embedUrl, checkedAt: Date.now() };
  return musicCache;
}
export function mountWidgetRoutes(app: Express) {
  app.get('/api/owner/analytics', requireOwner, async (_req,res)=>{
    try {
      const visits=await readVisitors();
      const countries=[...new Set(visits.map(v=>v.country))].map(code=>({code,count:visits.filter(v=>v.country===code).length})).sort((a,b)=>b.count-a.count||a.code.localeCompare(b.code));
      const daily=visits.reduce<Record<string,number>>((out,v)=>{const day=v.day||'Earlier';out[day]=(out[day]||0)+1;return out;},{});
      res.setHeader('Cache-Control','no-store');
      res.json({actual:{total:visits.length,countries,daily,definition:'Measured daily unique public visits; loopback excluded.'},display:{...await displayActivity(visits),definition:'Combined approved snapshot, tagged illustrative daily activity and later measured visits; measured reporting remains separate.'}});
    }catch{res.status(503).json({error:'Analytics unavailable.'});}
  });
  app.get('/api/widgets', async (req, res) => {
    const ip = clientAddress(req);
    try {
      const local = ip ? await ipLocation(ip) : null;
      const [exampleCityWeather, localWeather, actual, track, xPost] = await Promise.all([
        weatherFor(EXAMPLE_CITY), local ? weatherFor(local) : weatherFor(EXAMPLE_CITY),
        countVisitor(ip, local?.countryCode || null, local?.city), music(), latestXPost(),
      ]);
      const activity=await displayActivity(actual);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ exampleCity: { location: EXAMPLE_CITY, weather: exampleCityWeather }, local: { location: local || EXAMPLE_CITY, weather: localWeather, fallback: !local }, visitors: {total:activity.total,countries:activity.countries}, activity, xPost, xUrl: 'https://x.com/exampleowner', music: { url: MUSIC_LINK, canonicalUrl: MUSIC_CANONICAL, ...track } });
    } catch { res.status(503).json({ error: 'Widgets are temporarily unavailable.' }); }
  });
  app.get('/api/widgets/city', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!/^[\p{L}\p{M}\p{N} .,'-]{2,70}$/u.test(query)) { res.status(400).json({ error: 'Enter a city name.' }); return; }
    const key=query.toLocaleLowerCase('en-US'), cached=cities.get(key);
    if(cached && cached.expires>Date.now()) { res.setHeader('Cache-Control','no-store'); res.json({matches:cached.matches}); return; }
    try {
      const data = object(await json(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: query, count: '5', language: 'en', format: 'json' })}`, 6000));
      const matches = Array.isArray(data.results) ? data.results.map(item => parseLocation(item, false)).filter((item): item is Location => Boolean(item)) : [];
      if(cities.size>=256) cities.delete(cities.keys().next().value!);
      cities.set(key,{matches,expires:Date.now()+3_600_000});
      res.setHeader('Cache-Control', 'no-store'); res.json({ matches });
    } catch { res.status(503).json({ error: 'City search is unavailable.' }); }
  });
  app.get('/api/widgets/weather', async (req, res) => {
    const lat = Number(req.query.lat), lon = Number(req.query.lon), zone = typeof req.query.timezone === 'string' ? req.query.timezone : '';
    if (typeof req.query.lat!=='string'||!req.query.lat.trim()||typeof req.query.lon!=='string'||!req.query.lon.trim()||!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180 || zone.length > 80) { res.status(400).json({ error: 'Invalid location.' }); return; }
    try { new Intl.DateTimeFormat('en', { timeZone: zone }); }
    catch { res.status(400).json({ error: 'Invalid timezone.' }); return; }
    try { const weather = await weatherFor({ ...EXAMPLE_CITY, latitude: lat, longitude: lon, timezone: zone }); res.setHeader('Cache-Control', 'no-store'); res.json({ weather }); }
    catch { res.status(503).json({ error: 'Weather is unavailable.' }); }
  });
}
