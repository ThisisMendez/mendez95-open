export type Direction = {x:number;y:number};
/** Queue against the last accepted direction, not the last rendered tick. */
export function queueTurn(queue:Direction[], current:Direction, next:Direction): Direction[] {
  const last=queue.at(-1)||current;
  if (Math.abs(next.x)+Math.abs(next.y)!==1||next.x===last.x&&next.y===last.y||next.x===-last.x&&next.y===-last.y||queue.length>=2)return queue;
  return [...queue,next];
}
export function swipeTurn(start:Direction,end:Direction,threshold=18):Direction|null{
 const dx=end.x-start.x,dy=end.y-start.y;if(Math.max(Math.abs(dx),Math.abs(dy))<threshold)return null;
 return Math.abs(dx)>Math.abs(dy)?{x:Math.sign(dx),y:0}:{x:0,y:Math.sign(dy)};
}
export function paddlePosition(clientX:number,left:number,width:number,fieldWidth:number,paddleWidth:number){return Math.max(0,Math.min(fieldWidth-paddleWidth,(clientX-left)*fieldWidth/width-paddleWidth/2));}
export function shouldPauseForRoute(detail:unknown,path:string):boolean{
 if(!detail||typeof detail!=='object')return true;
 const route=detail as {path?:unknown;blocked?:unknown};return route.blocked!==false||typeof route.path!=='string'||route.path.split(/[?#]/,1)[0]!==path;
}
