export type WindowPoint={x:number;y:number};
export type SurfaceState={id:string;title:string;z:number;minimized:boolean;position?:WindowPoint};
export type WindowAction={type:'open';id:string;title:string}|{type:'focus'|'minimize'|'close';id:string}|{type:'move';id:string;position:WindowPoint}|{type:'desktop'};
export type WindowLifecycle={surfaces:SurfaceState[];active:string|null;nextZ:number};
export const initialWindows:WindowLifecycle={surfaces:[],active:null,nextZ:30};
export function windowLifecycle(state:WindowLifecycle,action:WindowAction):WindowLifecycle{
 if(action.type==='desktop')return {...state,active:null,surfaces:state.surfaces.map(s=>({...s,minimized:true}))};
 if(action.type==='open'){
  const existing=state.surfaces.find(s=>s.id===action.id);
  if(existing)return {...state,surfaces:state.surfaces.map(s=>s.id===action.id?{...s,title:action.title}:s)};
  return {...state,active:action.id,nextZ:state.nextZ+1,surfaces:[...state.surfaces,{id:action.id,title:action.title,z:state.nextZ,minimized:false}]};
 }
 const target=state.surfaces.find(s=>s.id===action.id);if(!target)return state;
 if(action.type==='move')return {...state,surfaces:state.surfaces.map(s=>s.id===action.id?{...s,position:action.position}:s)};
 if(action.type==='focus')return {...state,active:action.id,nextZ:state.nextZ+1,surfaces:state.surfaces.map(s=>s.id===action.id?{...s,minimized:false,z:state.nextZ}:s)};
 const surfaces=action.type==='close'?state.surfaces.filter(s=>s.id!==action.id):state.surfaces.map(s=>s.id===action.id?{...s,minimized:true}:s);
 return {...state,surfaces,active:state.active===action.id?[...surfaces].filter(s=>!s.minimized).sort((a,b)=>b.z-a.z)[0]?.id??null:state.active};
}
/** Leave at least 96px of titlebar reachable, including after a viewport shrink. */
export function clampWindow(point:WindowPoint,width:number,viewport:{width:number;height:number;top:number;bottom:number}):WindowPoint{
 return {x:Math.min(Math.max(point.x,Math.min(8,96-width)),Math.max(8,viewport.width-96)),y:Math.min(Math.max(point.y,viewport.top),Math.max(viewport.top,viewport.height-viewport.bottom-32))};
}
