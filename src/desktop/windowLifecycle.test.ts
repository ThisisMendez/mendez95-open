import {describe,it,expect} from 'vitest';
import {windowLifecycle,initialWindows,clampWindow} from './windowLifecycle';
describe('managed window lifecycle',()=>{
 it('minimizes/restores the same surface and geometry without closing records',()=>{
  let s=windowLifecycle(initialWindows,{type:'open',id:'contact',title:'Contact'});
  s=windowLifecycle(s,{type:'move',id:'contact',position:{x:240,y:130}});
  s=windowLifecycle(s,{type:'minimize',id:'contact'});expect(s.surfaces[0]).toMatchObject({id:'contact',minimized:true,position:{x:240,y:130}});
  s=windowLifecycle(s,{type:'focus',id:'contact'});expect(s.surfaces).toHaveLength(1);expect(s.active).toBe('contact');expect(s.surfaces[0]?.minimized).toBe(false);
 });
 it('keeps distinct windows on Show Desktop and focuses the next visible window after close',()=>{
  let s=windowLifecycle(initialWindows,{type:'open',id:'welcome',title:'Welcome'});s=windowLifecycle(s,{type:'open',id:'clock',title:'World Clock'});
  s=windowLifecycle(s,{type:'close',id:'clock'});expect(s.active).toBe('welcome');s=windowLifecycle(s,{type:'desktop'});expect(s.surfaces).toHaveLength(1);expect(s.active).toBeNull();expect(s.surfaces[0]?.minimized).toBe(true);
 });
 it('retains a reachable titlebar after a viewport shrink',()=>{expect(clampWindow({x:2000,y:2000},700,{width:1024,height:600,top:43,bottom:40})).toEqual({x:928,y:528});});
});
