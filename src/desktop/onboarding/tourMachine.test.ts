import { describe, expect, it } from 'vitest';
import { initialTourState, placeTourDialog, tourReducer, TOUR_STEPS, type TourRect } from './tourMachine';
const initial = () => initialTourState({ version: 1, completed: false, resumeStep: null });
const overlap = (a: TourRect, b: TourRect) => Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
describe('optional desktop tour', () => {
  it('starts only on request, bounds Back and completes after all five steps', () => {
    let state=initial();expect(state.phase).toBe('idle');state=tourReducer(state,{type:'NEXT'});expect(state).toEqual(initial());
    state=tourReducer(state,{type:'START'});state=tourReducer(state,{type:'BACK'});expect(state.step).toBe(0);
    for(let step=1;step<TOUR_STEPS.length;step++){state=tourReducer(state,{type:'NEXT'});expect(state.step).toBe(step);expect(state.phase).toBe('running');}
    state=tourReducer(state,{type:'NEXT'});expect(state).toMatchObject({phase:'idle',completed:true,resumeStep:null});
  });
  it('destination ends the tour with the next step resumable; restart starts at zero', () => {
    let state=tourReducer(initial(),{type:'START'});expect(tourReducer(state,{type:'DESTINATION'})).toEqual(state);
    state=tourReducer(state,{type:'NEXT'});state=tourReducer(state,{type:'DESTINATION'});expect(state).toMatchObject({phase:'idle',resumeStep:2});
    state=tourReducer(state,{type:'RESUME'});expect(state).toMatchObject({phase:'running',step:2,resumeStep:null});
    state=tourReducer(state,{type:'BACK'});expect(state.step).toBe(1);state=tourReducer(state,{type:'START'});expect(state.step).toBe(0);
  });
  it('skip clears resumable progress without completing or reopening Welcome', () => {
    let state=tourReducer(initial(),{type:'START'});state=tourReducer(state,{type:'NEXT'});state=tourReducer(state,{type:'SKIP'});
    expect(state).toMatchObject({phase:'idle',completed:false,resumeStep:null});
    state=tourReducer({...state,completed:true},{type:'START'});state=tourReducer(tourReducer(state,{type:'NEXT'}),{type:'DESTINATION'});expect(state.completed).toBe(false);expect(state.resumeStep).toBe(2);
  });
  it('keeps the dialog within desktop bars and avoids live targets at desktop/mobile sizes', () => {
    const cases=[{viewport:{width:1280,height:720},targets:[{x:300,y:90,width:380,height:500}]},{viewport:{width:1731,height:949},targets:[{x:430,y:150,width:480,height:620}]},{viewport:{width:390,height:844},targets:[{x:142,y:56,width:112,height:145}]},{viewport:{width:320,height:568},targets:[{x:0,y:503,width:80,height:65}]},{viewport:{width:320,height:568},targets:[{x:0,y:0,width:120,height:43}]}];
    for(const {viewport,targets}of cases){const r=placeTourDialog(viewport,{width:350,height:250},targets);expect(r.x).toBeGreaterThanOrEqual(10);expect(r.y).toBeGreaterThanOrEqual(53);expect(r.x+r.width).toBeLessThanOrEqual(viewport.width-10);expect(r.y+r.height).toBeLessThanOrEqual(viewport.height-(viewport.width<768?75:50));for(const target of targets)expect(overlap(r,target)).toBe(0);}
    expect(placeTourDialog({width:320,height:568},{width:350,height:250},[])).toMatchObject({x:10,width:300});
  });
});

it('suspends every desktop step on a Pocket transition without declaring completion',()=>{for(let step=0;step<5;step++){const state={phase:'running' as const,step,completed:false,resumeStep:null};expect(tourReducer(state,{type:'SUSPEND'})).toEqual({...state,phase:'idle',resumeStep:step});}});
