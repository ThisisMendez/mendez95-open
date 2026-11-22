import {env,applyD1Migrations} from 'cloudflare:test';
import {beforeAll,beforeEach,expect,it} from 'vitest';
import {ensureIllustrativeDays,display} from './widgets';
import type {Env} from './env';
const fixture=env as unknown as Env & {TEST_MIGRATIONS:any};
beforeAll(async()=>{await applyD1Migrations(fixture.DB,fixture.TEST_MIGRATIONS);});
beforeEach(async()=>{await fixture.DB.batch([fixture.DB.prepare('DELETE FROM illustrative_days'),fixture.DB.prepare('DELETE FROM visits')]);});
it('persists one allocation under simultaneous backfills and retains prior allocations',async()=>{
 await fixture.DB.prepare("INSERT INTO illustrative_days VALUES('2026-10-30',9,'illustrative','fixture')").run();
 const now=new Date('2026-11-04T12:00:00Z');await Promise.all(Array.from({length:5},()=>ensureIllustrativeDays(fixture,now)));
 const first=await ensureIllustrativeDays(fixture,now);expect(first).toHaveLength(6);expect(first[0]?.allocation).toBe(9);expect(first.every(d=>d.allocation>=5&&d.allocation<=11&&d.origin==='illustrative')).toBe(true);
 expect(await ensureIllustrativeDays(fixture,now)).toEqual(first);expect(await fixture.DB.prepare('SELECT COUNT(*) AS n FROM visits').first('n')).toBe(0);
});
it('keeps measured aggregates and unknown geography independent of illustrative allocations',async()=>{
 const now=new Date(),day=now.toISOString().slice(0,10);
 await fixture.DB.prepare('INSERT INTO visits VALUES(?,?,?,?,?,?)').bind('fixture-only',day,'ZZ',null,now.toISOString(),'{}').run();
 const d=await display(fixture);expect(d.countries.reduce((n,c)=>n+c.count,0)).toBe(d.total);expect(d.countries.find(c=>c.code==='ZZ')?.count).toBe(1);expect(await fixture.DB.prepare('SELECT COUNT(*) AS n FROM visits').first('n')).toBe(1);expect(d.illustrative.daily.every(d=>d.origin==='illustrative')).toBe(true);
});

it('records the additive ledger schema version',async()=>{expect(await fixture.DB.prepare('SELECT max(version) AS version FROM schema_info').first('version')).toBe(4);});
