/** Choose two content-height stacks without hiding cards or reducing their type. */
export function fitWidgetColumns(names:readonly string[],heights:readonly number[],available:number,gap=8):string[]{
  if(names.length!==heights.length||names.length<2||names.length>10||heights.some(value=>!Number.isFinite(value)||value<=0))return [];
  let best:number[]=[],score=Infinity;
  for(let mask=1;mask<(1<<names.length)-1;mask++){
    const left=names.map((_,i)=>i).filter(i=>mask&(1<<i)),right=names.map((_,i)=>i).filter(i=>!(mask&(1<<i)));
    const height=(indices:number[])=>indices.reduce((sum,i)=>sum+heights[i]!,0)+Math.max(0,indices.length-1)*gap;
    const overflow=Math.max(0,Math.max(height(left),height(right))-available);
    const preferred=left.some(i=>names[i]==='Music')&&left.some(i=>names[i]==='Visitor Count');
    const candidate=overflow*10000+(preferred?0:1000)+Math.abs(height(left)-height(right));
    if(candidate<score){best=left;score=candidate;}
  }
  return best.map(i=>names[i]!);
}
