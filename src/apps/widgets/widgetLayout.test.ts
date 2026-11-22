import{describe,it,expect}from'vitest';
import{fitWidgetColumns}from'./widgetLayout';
const names=['Weather','World Clock','Music','Visitor Count','Signal Window','Around the World'];
function height(chosen:string[],heights:number[]){return chosen.reduce((sum,name)=>sum+heights[names.indexOf(name)]!,0)+Math.max(0,chosen.length-1)*8;}
describe('content-height widget placement',()=>{
 it('keeps all cards within available height and Count below Music when that combination fits',()=>{
  const heights=[234,148,153,193,136,214],left=fitWidgetColumns(names,heights,686),right=names.filter(name=>!left.includes(name));
  expect(height(left,heights)).toBeLessThanOrEqual(686);expect(height(right,heights)).toBeLessThanOrEqual(686);expect(left).toContain('Music');expect(left).toContain('Visitor Count');expect([...left,...right].sort()).toEqual([...names].sort());
 });
 it('rebalances when a genuine post with media makes the original stack too tall',()=>{
  const heights=[234,148,153,193,350,194],left=fitWidgetColumns(names,heights,686),right=names.filter(name=>!left.includes(name));
  expect(height(left,heights)).toBeLessThanOrEqual(686);expect(height(right,heights)).toBeLessThanOrEqual(686);
 });
 it('does not attempt a layout from unmeasured cards',()=>expect(fitWidgetColumns(names,[0,1,2,3,4,5],600)).toEqual([]));
});
