import {describe,expect,it} from 'vitest';
import {queueTurn,swipeTurn,paddlePosition,shouldPauseForRoute} from './input';
import {moveCards,newSolitaire,sourceCards,type CardSource,type CardTarget} from './classic/solitaire';
const right={x:1,y:0},up={x:0,y:-1},left={x:-1,y:0},down={x:0,y:1};
describe('phone steering',()=>{
 it('keeps two rapid perpendicular turns in order and rejects reversal against the queued turn',()=>{
  let queue=queueTurn([],right,up);queue=queueTurn(queue,right,left);expect(queue).toEqual([up,left]);
  expect(queueTurn(queue,right,down)).toBe(queue); // bounded; consumed once per engine tick
  expect(queue.shift()).toEqual(up);expect(queue.shift()).toEqual(left);
  expect(queueTurn([],right,left)).toEqual([]);expect(queueTurn([up],right,down)).toEqual([up]);
 });
 it('ignores repeated pointer/keyboard directions and incomplete or diagonal invalid values',()=>{
  const queue=[up];expect(queueTurn(queue,right,up)).toBe(queue);expect(queueTurn([],right,right)).toEqual([]);expect(queueTurn([],right,{x:1,y:1})).toEqual([]);
  expect(swipeTurn({x:80,y:80},{x:83,y:90})).toBeNull();expect(swipeTurn({x:80,y:80},{x:80,y:30})).toEqual(up);expect(swipeTurn({x:80,y:80},{x:20,y:85})).toEqual(left);
 });
 it('maps finger coordinates into the actual scaled paddle field and clamps both ends',()=>{
  expect(paddlePosition(170,20,300,480,76)).toBe(202);expect(paddlePosition(-99,20,300,480,76)).toBe(0);expect(paddlePosition(999,20,300,480,76)).toBe(404);
 });
});
it('suspends for inactive routes, blocking overlays and malformed lifecycle messages',()=>{
 expect(shouldPauseForRoute({path:'/games/snake',blocked:false},'/games/snake')).toBe(false);expect(shouldPauseForRoute({path:'/games/snake?public=1#round',blocked:false},'/games/snake')).toBe(false);expect(shouldPauseForRoute({path:'/games/bounce',blocked:false},'/games/snake')).toBe(true);expect(shouldPauseForRoute({path:'/games/snake',blocked:true},'/games/snake')).toBe(true);for(const detail of [null,{},'snake',{path:'/games/snake'}])expect(shouldPauseForRoute(detail,'/games/snake')).toBe(true);
});
it('touch destination feedback uses the same move contract; invalid drops preserve every card and snapshot',()=>{
 const state=newSolitaire(()=>.5);const before=JSON.stringify(state);const sources:CardSource[]=state.tableau.map((pile,index)=>({kind:'tableau',pile:index,index:pile.length-1}));const targets:CardTarget[]=[...state.tableau.map((_,pile)=>({kind:'tableau' as const,pile})),...state.foundations.map((_,pile)=>({kind:'foundation' as const,pile}))];
 for(const source of sources)for(const target of targets){const result=moveCards(state,source,target);if(result){expect(sourceCards(state,source).length).toBeGreaterThan(0);expect([...result.stock,...result.waste,...result.tableau.flat(),...result.foundations.flat()]).toHaveLength(52);}expect(JSON.stringify(state)).toBe(before);}
});
