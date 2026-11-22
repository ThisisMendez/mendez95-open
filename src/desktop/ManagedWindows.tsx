import {createContext,useContext,useReducer,useCallback,useEffect,useLayoutEffect,useRef,type ReactNode,type RefObject,type CSSProperties,type PointerEvent as ReactPointerEvent} from 'react';
import {initialWindows,windowLifecycle,clampWindow,type WindowPoint,type WindowAction,type WindowLifecycle} from './windowLifecycle';
import './managedWindows.css';
type Entry={restore?:()=>void;close?:()=>void;escape?:boolean};
type Manager=WindowLifecycle&{dispatch:(action:WindowAction)=>void;register:(id:string,entry:Entry)=>()=>void;restore:(id:string)=>void};
const Context=createContext<Manager|null>(null);
export function ManagedWindowsProvider({children}:{children:ReactNode}){
 const [state,dispatch]=useReducer(windowLifecycle,initialWindows),entries=useRef(new Map<string,Entry>());
 const register=useCallback((id:string,entry:Entry)=>{entries.current.set(id,entry);return()=>{entries.current.delete(id);dispatch({type:'close',id});};},[]);
 const restore=useCallback((id:string)=>{dispatch({type:'focus',id});entries.current.get(id)?.restore?.();},[]);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{
  if(event.key!=='Escape'||event.defaultPrevented||!state.active||document.querySelector('dialog[open], [aria-modal="true"], .os-start-menu, .os-menu-popover'))return;
  if(event.target instanceof Element&&event.target.closest('input,textarea,[contenteditable]'))return;
  const entry=entries.current.get(state.active);if(entry?.escape===false||!entry?.close)return;event.preventDefault();entry.close();
 };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[state.active]);
 return <Context.Provider value={{...state,dispatch,register,restore}}>{children}</Context.Provider>;
}
export function useWindowManager(){const value=useContext(Context);if(!value)throw new Error('Managed window provider missing');return value;}
export function useManagedSurface({id,title,open=true,ref,onRestore,onClose,escape=true}:{id:string;title:string;open?:boolean;ref:RefObject<HTMLElement|null>;onRestore?:()=>void;onClose?:()=>void;escape?:boolean}){
 const manager=useWindowManager(),latest=useRef({onRestore,onClose,escape});latest.current={onRestore,onClose,escape};
 const {dispatch,register}=manager;
 useLayoutEffect(()=>{if(!open)return;dispatch({type:'open',id,title});return register(id,{restore:()=>latest.current.onRestore?.(),close:()=>latest.current.onClose?.(),get escape(){return latest.current.escape;}});},[id,open,dispatch,register]);
 useEffect(()=>{if(open)dispatch({type:'open',id,title});},[id,open,title,dispatch]);
 const surface=manager.surfaces.find(s=>s.id===id),position=surface?.position;
 const drag=useRef<{id:number;start:WindowPoint;origin:WindowPoint}|null>(null);
 const viewport=()=>({width:innerWidth,height:innerHeight,top:document.querySelector('.os-menubar')?.getBoundingClientRect().bottom||43,bottom:document.querySelector('.os-taskbar')?.getBoundingClientRect().height||40});
 useEffect(()=>{if(!position)return;const resize=()=>{const p=clampWindow(position,ref.current?.getBoundingClientRect().width||300,viewport());if(p.x!==position.x||p.y!==position.y)dispatch({type:'move',id,position:p});};resize();window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[position,id,dispatch,ref]);
 const focus=()=>dispatch({type:'focus',id});
 const minimize=()=>{dispatch({type:'minimize',id});requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>(`[data-task-window="${CSS.escape(id)}"]`)?.focus());};
 const onPointerDown=(event:ReactPointerEvent<HTMLElement>)=>{if(event.button!==0||innerWidth<768||!(event.target instanceof Element)||event.target.closest('button,a,input,textarea,select,[contenteditable]'))return;const rect=ref.current?.getBoundingClientRect();if(!rect)return;event.preventDefault();focus();drag.current={id:event.pointerId,start:{x:event.clientX,y:event.clientY},origin:{x:rect.left,y:rect.top}};event.currentTarget.setPointerCapture(event.pointerId);};
 const onPointerMove=(event:ReactPointerEvent<HTMLElement>)=>{const d=drag.current;if(!d||d.id!==event.pointerId)return;dispatch({type:'move',id,position:clampWindow({x:d.origin.x+event.clientX-d.start.x,y:d.origin.y+event.clientY-d.start.y},ref.current?.getBoundingClientRect().width||300,viewport())});};
 const end=(event:ReactPointerEvent<HTMLElement>)=>{drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);};
 const minimized=surface?.minimized??false,active=manager.active===id&&!minimized;
 useEffect(()=>{if(open&&active&&ref.current&&!ref.current.contains(document.activeElement))ref.current.focus({preventScroll:true});},[active,open,ref]);
 const style:CSSProperties={zIndex:surface?.z??30,...(position&&innerWidth>=768?{position:'fixed',left:position.x,top:position.y,right:'auto',bottom:'auto',margin:0,transform:'none'}:{})};
 return {manager,surface,active,minimized,style,focus,minimize,titlebar:{onPointerDown,onPointerMove,onPointerUp:end,onPointerCancel:end,onLostPointerCapture:()=>{drag.current=null;},onDoubleClick:(event:React.MouseEvent)=>event.preventDefault()}};
}
export function WindowControls({title,minimize,close}:{title:string;minimize:()=>void;close:()=>void}){
 return <div className="os-title-actions"><button type="button" className="os-close os-minimize" onClick={minimize} aria-label={`Minimize ${title}`}>_</button><button type="button" className="os-close os-maximize" disabled aria-label={`Maximize ${title} unavailable`} title="Maximize unavailable">□</button><button type="button" className="os-close" onClick={close} aria-label={`Close ${title}`}>×</button></div>;
}
