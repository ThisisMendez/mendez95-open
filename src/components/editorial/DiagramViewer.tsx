import {useEffect,useId,useRef,useState,type KeyboardEvent} from 'react';
import {inline} from './inline';

/** A modal viewer keeps the case mounted, preserving its tab and scroll state. */
export function DiagramViewer({photo,close}:{photo:{src:string;alt:string;caption?:string};close:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null),viewport=useRef<HTMLDivElement>(null),id=useId();
 const [zoom,setZoom]=useState(1);
 useEffect(()=>{dialog.current?.showModal();},[]);
 const keepFocus=(event:KeyboardEvent<HTMLDialogElement>)=>{
  if(event.key!=='Tab')return;
  const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]')).filter(el=>el.getClientRects().length>0);
  if(!controls.length)return;
  const index=controls.indexOf(document.activeElement as HTMLElement);
  event.preventDefault();controls[(index+(event.shiftKey?-1:1)+controls.length)%controls.length]?.focus();
 };
 const resize=(value:number)=>{
  setZoom(Math.max(1,Math.min(4,value)));
  if(value===1)viewport.current?.scrollTo({top:0,left:0});
 };
 return <dialog ref={dialog} className="os-editorial-viewer" aria-labelledby={`${id}-title`} aria-describedby={`${id}-caption`} onKeyDown={keepFocus} onCancel={event=>{event.preventDefault();close();}}>
  <header className="os-diagram-titlebar"><h2 id={`${id}-title`}>Diagram Viewer</h2><button autoFocus className="os-button" onClick={close}>Close / Back to case ×</button></header>
  <div className="os-diagram-tools" role="group" aria-label="Diagram zoom">
   <button className="os-button" onClick={()=>resize(zoom-.5)} disabled={zoom===1} aria-label="Zoom out">−</button>
   <output aria-live="polite" aria-label="Diagram zoom level">{Math.round(zoom*100)}%</output>
   <button className="os-button" onClick={()=>resize(zoom+.5)} disabled={zoom===4} aria-label="Zoom in">+</button>
   <button className="os-button" onClick={()=>resize(1)}>Fit diagram</button>
   <a href={photo.src} target="_blank" rel="noopener noreferrer">Original image ↗</a>
  </div>
  <div ref={viewport} className="os-editorial-viewer-image" tabIndex={0} role="region" aria-label="Scrollable diagram; use arrow keys to pan when zoomed"><img src={photo.src} alt={photo.alt} style={{width:`${zoom*100}%`}}/></div>
  <div id={`${id}-caption`} className="os-diagram-caption"><p>{inline(photo.caption||photo.alt)}</p>{photo.caption&&photo.caption!==photo.alt&&<p>{photo.alt}</p>}</div>
 </dialog>;
}
