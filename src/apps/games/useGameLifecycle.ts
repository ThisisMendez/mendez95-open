import {useEffect,useRef,type RefObject} from 'react';
import {shouldPauseForRoute} from './input';
/** Shared suspension only. Never silently resume a run or change its scoring clock. */
export function useGameLifecycle(root:RefObject<HTMLElement|null>,path:string,pause:()=>void,onActivity?:(active:boolean)=>void){
 const latest=useRef(pause);latest.current=pause;
 const notify=useRef(onActivity);notify.current=onActivity;
 const routeBlocked=useRef(false),windowInactive=useRef(false);
 const allowed=()=>!routeBlocked.current&&!windowInactive.current&&!document.hidden;
 useEffect(()=>{
  const windowElement=root.current?.closest('.os-window');
  const suspend=()=>latest.current();
  const activity=()=>notify.current?.(allowed());
  const visibility=()=>{if(document.hidden)suspend();activity();};
  const active=()=>{if(windowElement?.getAttribute('data-active')!=='true'){windowInactive.current=true;suspend();}else windowInactive.current=false;activity();};
  const route=(event:Event)=>{routeBlocked.current=shouldPauseForRoute((event as CustomEvent).detail,path);if(routeBlocked.current)suspend();activity();};
  const observer=windowElement?new MutationObserver(active):null;
  if(windowElement)observer?.observe(windowElement,{attributes:true,attributeFilter:['data-active']});
  if(windowElement)active();if(document.hidden)suspend();activity();
  document.addEventListener('visibilitychange',visibility);window.addEventListener('mendez-active-route',route);window.addEventListener('orientationchange',suspend);window.addEventListener('blur',suspend);window.addEventListener('resize',suspend);window.screen.orientation?.addEventListener('change',suspend);
  return()=>{observer?.disconnect();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('mendez-active-route',route);window.removeEventListener('orientationchange',suspend);window.removeEventListener('blur',suspend);window.removeEventListener('resize',suspend);window.screen.orientation?.removeEventListener('change',suspend);};
 },[path,root]);
 return allowed;
}
