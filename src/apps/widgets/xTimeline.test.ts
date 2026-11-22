import {afterEach,beforeEach,expect,it,vi} from 'vitest';
let tags:any[],browser:any;
beforeEach(()=>{vi.resetModules();vi.useFakeTimers();tags=[];browser={};vi.stubGlobal('window',browser);vi.stubGlobal('document',{createElement:()=>({remove:vi.fn()}),head:{append:(tag:unknown)=>tags.push(tag)}});});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('shares a single pending SDK request and reuses an existing official renderer',async()=>{
 const {loadXWidgets,X_WIDGET_SCRIPT}=await import('./xTimeline');const first=loadXWidgets(),second=loadXWidgets();expect(first).toBe(second);expect(tags).toHaveLength(1);expect(tags[0].src).toBe(X_WIDGET_SCRIPT);const api={widgets:{load:vi.fn()}};browser.twttr=api;tags[0].onload();expect(await first).toBe(api);expect(await loadXWidgets()).toBe(api);expect(tags).toHaveLength(1);
});
it('fails honestly when the script is blocked, then permits an explicit retry',async()=>{
 const {loadXWidgets}=await import('./xTimeline');const first=loadXWidgets();const rejected=expect(first).rejects.toThrow('X timeline unavailable');tags[0].onerror();await rejected;expect(tags[0].remove).toHaveBeenCalledOnce();const retry=loadXWidgets();expect(tags).toHaveLength(2);browser.twttr={widgets:{load:vi.fn()}};tags[1].onload();await expect(retry).resolves.toBe(browser.twttr);
});
it('bounds loading and rejects a script that never supplies the renderer',async()=>{
 const {loadXWidgets}=await import('./xTimeline');const first=loadXWidgets();const rejected=expect(first).rejects.toThrow('X timeline unavailable');await vi.advanceTimersByTimeAsync(12000);await rejected;const retry=loadXWidgets();const invalid=expect(retry).rejects.toThrow('X timeline unavailable');tags[1].onload();await invalid;
});
