export type Point={x:number;y:number};
export const COMPANION_POSITION_KEY='mendez-95-snip-position-v1';
export const RESET_COMPANION='mendez-95-reset-companion';
export const COMPANION_BOUNDS={width:144,height:168};
export function clampCompanion(point:Point,width:number,height:number):Point{
 return {x:Math.max(8,Math.min(point.x,Math.max(8,width-COMPANION_BOUNDS.width-8))),y:Math.max(55,Math.min(point.y,Math.max(55,height-COMPANION_BOUNDS.height-52)))};
}
export function parseCompanionPosition(value:string|null):Point|null{
 try{const p=JSON.parse(value||'null');return p&&typeof p.x==='number'&&typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y)?{x:p.x,y:p.y}:null;}catch{return null;}
}
export const movedCompanion=(start:Point,end:Point)=>Math.hypot(end.x-start.x,end.y-start.y)>=6;

export type CompanionObstacle={x:number;y:number;width:number;height:number};
/** Used for initial/reset placement only; intentional visitor positions stay put. */
export function placeCompanion(candidates:Point[],width:number,height:number,obstacles:CompanionObstacle[]):Point{
 const overlap=(p:Point)=>obstacles.reduce((area,r)=>area+Math.max(0,Math.min(p.x+COMPANION_BOUNDS.width,r.x+r.width)-Math.max(p.x,r.x))*Math.max(0,Math.min(p.y+COMPANION_BOUNDS.height,r.y+r.height)-Math.max(p.y,r.y)),0);
 return candidates.map(p=>clampCompanion(p,width,height)).sort((a,b)=>overlap(a)-overlap(b))[0]||clampCompanion({x:8,y:55},width,height);
}
