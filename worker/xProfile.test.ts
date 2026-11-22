import {beforeAll,beforeEach,it,expect,vi} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {cachedXPost,parseXProfileHTML,refreshXPost} from './xProfile';
import type {Env} from './env';
const fixture=env as unknown as Env & {TEST_MIGRATIONS:any[];TEST_X_PROFILE:string};
let testEnv:Env;
beforeAll(async()=>{await applyD1Migrations(fixture.DB,fixture.TEST_MIGRATIONS);});
beforeEach(async()=>{
 await fixture.DB.batch(['DELETE FROM settings','DELETE FROM quotas'].map(q=>fixture.DB.prepare(q)));
 testEnv={...fixture,EXTERNAL_FETCH_ENABLED:'true',X_BROWSER_ENABLED:'true'};
});
it('separates owner commentary from a nested quote and extracts video posters, not blob URLs',async()=>{
 const post=await parseXProfileHTML(fixture.TEST_X_PROFILE);
 expect(post).toMatchObject({text:expect.stringContaining('This fictional example demonstrates'),url:'https://x.com/exampleowner/status/2000000000000000000',media:[],quote:{author:'examplequote',url:'https://x.com/examplequote/status/1999990000000000000',media:[{kind:'video',url:expect.stringContaining('https://pbs.twimg.com/amplify_video_thumb/')}]}});
 expect(post?.text).not.toContain('Sample Person');
 expect(post?.quote?.text).not.toContain('mediocrity');
 expect(JSON.stringify(post)).not.toContain('blob:');expect(post?.quote?.media[0]?.url).toContain('&name=medium');
 expect(post?.createdAt).toBe('2025-12-14T00:28:52.860Z');
});
it('does not confuse a profile total/login wall or a foreign post with readable owner content',async()=>{
 expect(await parseXProfileHTML('<meta name="twitter:data1" content="88"><h2>Log in</h2>')).toBeNull();
 expect(await parseXProfileHTML('<article><a href="/elsewhere/status/2000000000000000000">today</a><div dir="auto">Other author</div></article>')).toBeNull();
});
it('orders by post date rather than pin position and excludes avatars and unsafe media',async()=>{
 const html='<article><a href="/exampleowner/status/173295791455223808">Pinned</a><div dir="auto">Old</div></article>'+fixture.TEST_X_PROFILE.replace('<video','<img src="https://evil.test/track"><img src="https://pbs.twimg.com/profile_images/avatar.jpg"><video');
 const post=await parseXProfileHTML(html);expect(post?.text).toContain('This fictional');expect(post?.quote?.media).toHaveLength(1);
});
it('limits concurrent scheduled calls to one browser attempt per UTC day and serves shared cached data',async()=>{
 const run=vi.fn(async()=>Response.json({success:true,result:fixture.TEST_X_PROFILE}));
 testEnv.X_BROWSER={quickAction:run} as unknown as BrowserRun;
 await Promise.all([refreshXPost(testEnv),refreshXPost(testEnv)]);
 expect(run).toHaveBeenCalledTimes(1);expect((await cachedXPost(testEnv))?.quote?.author).toBe('examplequote');
 await cachedXPost(testEnv);await cachedXPost(testEnv);expect(run).toHaveBeenCalledTimes(1);
});
it('retains the last good post through a login wall and a provider failure on following days',async()=>{
 const now=Date.now(),run=vi.fn().mockResolvedValueOnce(Response.json({success:true,result:fixture.TEST_X_PROFILE})).mockResolvedValueOnce(Response.json({success:true,result:'<h2>Log in</h2>'})).mockResolvedValueOnce(new Response('Quota exhausted',{status:429}));
 testEnv.X_BROWSER={quickAction:run} as unknown as BrowserRun;
 await refreshXPost(testEnv,now);const previous=await cachedXPost(testEnv);
 await refreshXPost(testEnv,now+86400000);expect(await cachedXPost(testEnv)).toEqual(previous);
 await refreshXPost(testEnv,now+2*86400000);expect(await cachedXPost(testEnv)).toEqual(previous);
});
it('does not start a browser when disabled',async()=>{
 const run=vi.fn();testEnv.X_BROWSER={quickAction:run} as unknown as BrowserRun;testEnv.X_BROWSER_ENABLED='false';
 await refreshXPost(testEnv);expect(run).not.toHaveBeenCalled();
});
