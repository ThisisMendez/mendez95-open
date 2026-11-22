import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import express from 'express';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';

let server: Server, base = '', dataDir = '';
const realFetch = globalThis.fetch;
beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'mendez-widgets-test-'));
  process.env.MENDEZ_OS_DATA_DIR = dataDir;
  process.env.MENDEZ_OS_OWNER_PASSWORD = 'test-only-analytics-owner';
  process.env.FLY_APP_NAME = 'test-mendez';
  process.env.MENDEZ_OS_TRUST_FLY_PROXY = 'true';
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.startsWith('http://127.0.0.1:')) return realFetch(input, init);
    let value: unknown;
    if (url.startsWith('https://ipwho.is/')) value = { success: true, city: 'Santo Domingo', country: 'Dominican Republic', country_code: 'DO', latitude: 18.5, longitude: -69.9, timezone: { id: 'America/Santo_Domingo' } };
    else if (url.startsWith('https://api.open-meteo.com/')) value = { current: { temperature_2m: 23, weather_code: 1, is_day: 1, time: '2026-10-20T12:00' }, daily: { time:['2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-24'], weather_code:[1,3,61,0,2], temperature_2m_max:[25,26,22,24,25], temperature_2m_min:[15,16,14,13,15] } };
    else if (url.startsWith('https://geocoding-api.open-meteo.com/')) value = { results: [{ name: 'Paris', country: 'France', country_code: 'FR', latitude: 48.86, longitude: 2.35, timezone: 'Europe/Paris' }] };
    else if (url.startsWith('https://soundcloud.com/oembed')) value = { provider_name: 'SoundCloud', title: 'Gangsta’s Paradise by Coolio', html: '<iframe src="https://w.soundcloud.com/player/?url=track"></iframe>' };
    else throw new Error(`Unexpected URL ${url}`);
    return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const { mountWidgetRoutes } = await import('./widgets');
  const app = express();
  app.use(express.json());
  const {mountOwnerAuthRoutes}=await import('./auth'); mountOwnerAuthRoutes(app);
  app.use((req, _res, next) => { Object.defineProperty(req.socket, 'remoteAddress', { value: '10.0.0.2', configurable: true }); next(); });
  mountWidgetRoutes(app);
  server = await new Promise<Server>(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port');
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  vi.restoreAllMocks();
  delete process.env.MENDEZ_OS_OWNER_PASSWORD; delete process.env.FLY_APP_NAME; delete process.env.MENDEZ_OS_TRUST_FLY_PROXY;
  await new Promise<void>(resolve => server.close(() => resolve()));
  await rm(dataDir, { recursive: true, force: true });
});
it('shares approximate city across weather and clock, counts a daily visitor once, and stores only hash/country', async () => {
  const first = await fetch(`${base}/api/widgets`, { headers: { 'Fly-Client-IP': '8.8.8.8' } });
  expect(first.status).toBe(200);
  expect(first.headers.get('set-cookie')).toBeNull();
  const data = await first.json();
  expect(data.local.location).toMatchObject({ city: 'Santo Domingo', timezone: 'America/Santo_Domingo', approximate: true });
  expect(data.local.weather.temperatureC).toBe(23);
  expect(data.exampleCity.weather.temperatureC).toBe(23);
  expect(data.exampleCity.weather.forecast).toHaveLength(5);
  expect(data.local.weather.forecast[2]).toEqual({date:'2026-10-22',code:61,highC:22,lowC:14});
  expect(data.visitors.total).toBeGreaterThanOrEqual(649);
  expect(data.visitors).toEqual({total:data.activity.total,countries:data.activity.countries});
  expect(data).not.toHaveProperty('actual');
  expect(JSON.stringify(data)).not.toContain('dayHash');
  expect(data.music.embedUrl).toContain('auto_play=false');
  const again = await (await fetch(`${base}/api/widgets`, { headers: { 'Fly-Client-IP': '8.8.8.8' } })).json();
  expect(again.activity).toEqual(data.activity);
  expect((await fetch(`${base}/api/owner/analytics`)).status).toBe(401);
  const login=await fetch(`${base}/api/owner/login`,{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({password:'test-only-analytics-owner'})});
  const cookie=login.headers.get('set-cookie')?.split(';')[0]||'';
  const owner=await(await fetch(`${base}/api/owner/analytics`,{headers:{cookie}})).json();
  expect(owner.actual.total).toBe(1);expect(owner.actual.countries).toEqual([{code:'DO',count:1}]);
  expect(owner.display.total).toBe(data.activity.total);expect(JSON.stringify(owner)).not.toContain('dayHash');
  const stored = JSON.parse(await readFile(join(dataDir, 'visitors.json'), 'utf8'));
  expect(stored).toHaveLength(1);
  expect(Object.keys(stored[0]).sort()).toEqual(['city','country','day','dayHash','recordedAt']);
  expect(stored[0].dayHash).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(stored)).not.toContain('8.8.8.8');
});
it('resolves a manual city and obtains matching weather without a browser location permission', async () => {
  const city = await (await fetch(`${base}/api/widgets/city?q=Paris`)).json();
  expect(city.matches[0]).toMatchObject({ city: 'Paris', timezone: 'Europe/Paris' });
  const searches=()=>vi.mocked(globalThis.fetch).mock.calls.filter(([input])=>String(input).startsWith('https://geocoding-api.open-meteo.com/')).length;
  const before=searches();
  expect(await (await fetch(`${base}/api/widgets/city?q=paris`)).json()).toEqual(city);
  expect(searches()).toBe(before);
  const weather = await (await fetch(`${base}/api/widgets/weather?lat=48.86&lon=2.35&timezone=Europe%2FParis`)).json();
  expect(weather.weather.temperatureC).toBe(23);
});
it('refreshes an automatic city after its bounded cache, reacts to a changed public address, and reports provider failure as fallback',async()=>{
 const spy=vi.mocked(globalThis.fetch),original=spy.getMockImplementation()!;let city='Madrid',lookups=0,unavailable=false;
 spy.mockImplementation(async(input,init)=>{if(String(input).startsWith('https://ipwho.is/')){lookups++;if(unavailable)throw new Error('provider unavailable');return new Response(JSON.stringify({success:true,city,country:'Spain',country_code:'ES',latitude:40.4,longitude:-3.7,timezone:{id:'Europe/Madrid'}}),{headers:{'content-type':'application/json'}});}return original(input,init);});
 vi.useFakeTimers({toFake:['Date']});const now=Date.now();
 try{const get=async(ip:string)=>(await(await fetch(`${base}/api/widgets`,{headers:{'Fly-Client-IP':ip}})).json());
 expect((await get('9.9.9.9')).local.location.city).toBe('Madrid');city='Barcelona';expect((await get('9.9.9.9')).local.location.city).toBe('Madrid');expect(lookups).toBe(1);
 expect((await get('1.1.1.1')).local.location.city).toBe('Barcelona');expect(lookups).toBe(2);
 vi.setSystemTime(now+16*60_000);expect((await get('9.9.9.9')).local.location.city).toBe('Barcelona');expect(lookups).toBe(3);
 unavailable=true;const failed=await get('8.8.4.4');expect(failed.local.fallback).toBe(true);expect(failed.local.location.city).toBe('London');expect(failed.local.location.approximate).toBe(false);
 }finally{vi.useRealTimers();spy.mockImplementation(original);}
});
it('keeps forecast cache entries separate by timezone and rejects blank coordinates',async()=>{
 const calls=()=>vi.mocked(globalThis.fetch).mock.calls.filter(([url])=>String(url).startsWith('https://api.open-meteo.com/')&&String(url).includes('latitude=47.01')).length;
 const get=(zone:string)=>fetch(`${base}/api/widgets/weather?lat=47.01&lon=2.02&timezone=${encodeURIComponent(zone)}`);
 const before=calls();expect((await get('Europe/Paris')).status).toBe(200);expect(calls()).toBe(before+1);
 expect((await get('UTC')).status).toBe(200);expect(calls()).toBe(before+2);
 expect((await get('Europe/Paris')).status).toBe(200);expect(calls()).toBe(before+2);
 for(const params of ['lat=&lon=2&timezone=UTC','lat=2&lon=&timezone=UTC','lat=91&lon=2&timezone=UTC','lat=2&lon=2&timezone=Invalid%2FZone'])expect((await fetch(`${base}/api/widgets/weather?${params}`)).status).toBe(400);
});
it('treats partial IP location results as unavailable instead of inventing a detected city',async()=>{
 const spy=vi.mocked(globalThis.fetch),original=spy.getMockImplementation()!;
 spy.mockImplementation(async(input,init)=>String(input).startsWith('https://ipwho.is/')?new Response(JSON.stringify({success:true,city:'  ',country:'France',country_code:'FR',latitude:48,longitude:2,timezone:{id:'Europe/Paris'}}),{headers:{'content-type':'application/json'}}):original(input,init));
 try{const data=await(await fetch(`${base}/api/widgets`,{headers:{'Fly-Client-IP':'4.2.2.2'}})).json();expect(data.local.fallback).toBe(true);expect(data.local.location).toMatchObject({city:'London',timezone:'Europe/London',approximate:false});}finally{spy.mockImplementation(original);}
});
