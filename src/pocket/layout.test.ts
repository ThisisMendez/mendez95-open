import {describe,it,expect} from 'vitest';
import {POCKET_BREAKPOINT,pathForLayout,pocketDockGroup,toolTabForRoute,toolTabPath,TOOL_TABS} from './layout';
import {resolveRoute} from '../desktop/router';
describe('Pocket navigation',()=>{
 it('assigns PIP its own dock key and keeps personal child routes in Tools',()=>{
  expect(pocketDockGroup('/guide')).toBe('PIP');
  for(const path of ['/tools?tab=utilities','/mendez-world','/photos/a-photo','/signal'])expect(pocketDockGroup(path)).toBe('Tools');
  expect(pocketDockGroup('/work/case?view=full')).toBe('Portfolio');
  expect(pocketDockGroup('/board')).toBe('Home');
 });
 it('maps each Tools selector to a compatible route and restores its selection',()=>{
  expect(TOOL_TABS[TOOL_TABS.indexOf('Utilities')+1]).toBe('Mendez World');
  for(const tab of TOOL_TABS){const path=toolTabPath(tab);expect(resolveRoute(path).unavailable).toBeUndefined();expect(toolTabForRoute(path)).toBe(tab);}
  for(const path of ['/mendez-world','/photos','/photos/a-photo','/signal'])expect(toolTabForRoute(path)).toBe('Mendez World');
  expect(toolTabForRoute('/tools?tab=unrecognized')).toBe('Explore & Create');
 });
 it('preserves the layout boundary and old command deep links',()=>{
  expect(POCKET_BREAKPOINT).toBe(768);
  expect(pathForLayout('/run?command=help#start',true)).toBe('/find?command=help#start');
  expect(pathForLayout('/board',true)).toBe('/board');
  expect(pathForLayout('/mendez-world',true)).toBe('/mendez-world');
 });
});
