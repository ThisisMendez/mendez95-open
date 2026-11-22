import{useEffect,useRef,useState}from'react';
import{clampCompanion,parseCompanionPosition,movedCompanion,COMPANION_POSITION_KEY,RESET_COMPANION,COMPANION_BOUNDS,placeCompanion,type Point}from'./companionPosition';
import './desktopCompanion.css';
function initialPosition(preferred?:Point):Point{
 const widget=document.querySelector('[data-widget="Visitor Count"]')?.getBoundingClientRect(),column=document.querySelector('.os-widgets')?.getBoundingClientRect(),footer=document.querySelector('.os-desktop-footer')?.getBoundingClientRect();
 const obstacles=[...document.querySelectorAll('.os-widget,.os-icon,.os-desktop-footer')].map(node=>node.getBoundingClientRect()).filter(rect=>rect.width&&rect.height);
 const {width,height}=COMPANION_BOUNDS;
 return placeCompanion([...(preferred?[preferred]:[]),...(widget?[{x:widget.right-width,y:widget.bottom+8}]:[]),...(column?[{x:column.left-width-12,y:footer?footer.top-height-12:innerHeight-height-52}]:[]),{x:8,y:innerHeight-height-52},{x:innerWidth-width-8,y:innerHeight-height-52},{x:innerWidth/2,y:innerHeight-height-52}],innerWidth,innerHeight,obstacles);
}
function savedPosition(){try{return parseCompanionPosition(localStorage.getItem(COMPANION_POSITION_KEY));}catch{return null;}}
export function DesktopCompanion({navigate,blocked}:{navigate:(path:string)=>void;blocked:boolean}){
 const [position,setPosition]=useState(()=>clampCompanion(savedPosition()||initialPosition(),innerWidth,innerHeight));
 const drag=useRef<{pointer:number;start:Point;origin:Point;moved:boolean;type:string}|null>(null),suppressed=useRef(false),button=useRef<HTMLButtonElement>(null);
 const persist=(p:Point)=>{try{localStorage.setItem(COMPANION_POSITION_KEY,JSON.stringify(p));}catch{}};
 useEffect(()=>{
  setPosition(initialPosition(savedPosition()||undefined));
  let frame=0;
  const reflow=()=>{if(drag.current)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>setPosition(previous=>{
   const next=initialPosition(previous);if(next.x===previous.x&&next.y===previous.y)return previous;
   persist(next);return next;
  }));};
  const reset=()=>{const next=initialPosition();setPosition(next);persist(next);};
  // Widget data, wrapping and fonts can settle after the viewport resize event.
  // Observe the geometry owner rather than retaining a point measured too early.
  const observer=new ResizeObserver(reflow);
  for(const node of document.querySelectorAll('.os-widgets,.os-desktop-footer,.os-icon-grid'))observer.observe(node);
  const column=document.querySelector('.os-widget-column');
  const mounts=new MutationObserver(()=>{const widgets=column?.querySelector('.os-widgets');if(widgets)observer.observe(widgets);reflow();});
  if(column)mounts.observe(column,{childList:true});
  column?.addEventListener('scroll',reflow,{passive:true});
  window.addEventListener('resize',reflow);window.addEventListener(RESET_COMPANION,reset);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();mounts.disconnect();column?.removeEventListener('scroll',reflow);window.removeEventListener('resize',reflow);window.removeEventListener(RESET_COMPANION,reset);};
 },[]);
 const open=()=>{if(!blocked&&!document.querySelector('dialog[open], [aria-modal="true"]'))navigate('/guide');};
 return <button ref={button} className="desktop-companion" style={{left:position.x,top:position.y}} hidden={blocked} aria-label="SNIP-E companion. Double-click or press Enter to chat. Drag to move." title="SNIP-E · double-click to chat · drag to move" onDoubleClick={()=>{if(!suppressed.current)open();}} onClick={event=>{if(event.detail===0&&!suppressed.current)open();}}
 onPointerDown={event=>{if(event.button!==0)return;suppressed.current=false;drag.current={pointer:event.pointerId,start:{x:event.clientX,y:event.clientY},origin:position,moved:false,type:event.pointerType};event.currentTarget.setPointerCapture(event.pointerId);}}
 onPointerMove={event=>{const d=drag.current;if(!d||d.pointer!==event.pointerId)return;const next={x:event.clientX,y:event.clientY};if(!d.moved&&!movedCompanion(d.start,next))return;d.moved=true;suppressed.current=true;setPosition(clampCompanion({x:d.origin.x+next.x-d.start.x,y:d.origin.y+next.y-d.start.y},innerWidth,innerHeight));}}
 onPointerUp={event=>{const d=drag.current;if(!d||d.pointer!==event.pointerId)return;drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);if(d.moved){persist(clampCompanion({x:d.origin.x+event.clientX-d.start.x,y:d.origin.y+event.clientY-d.start.y},innerWidth,innerHeight));}else if(d.type==='touch')open();}}
 onPointerCancel={()=>{drag.current=null;suppressed.current=false;}} onLostPointerCapture={()=>{drag.current=null;}} onKeyDown={()=>{suppressed.current=false;}}>
 <img src="/brand/pocket/companion-example.svg" alt="" draggable={false}/><span>SNIP-E</span>
 </button>;
}
