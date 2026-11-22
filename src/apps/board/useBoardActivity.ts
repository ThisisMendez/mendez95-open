import {useEffect,useState,type RefObject} from 'react';
/** Retain drafts while suspending guestbook network work behind another route. */
export function useBoardActivity(root:RefObject<HTMLElement|null>){
 const [active,setActive]=useState(()=>!document.hidden&&window.location.pathname==='/board');
 useEffect(()=>{
  let routeBlocked=window.location.pathname!=='/board';
  const windowElement=root.current?.closest('.os-window');
  const update=()=>setActive(!document.hidden&&!routeBlocked&&(!windowElement||windowElement.getAttribute('data-active')==='true'));
  const route=(event:Event)=>{const detail=(event as CustomEvent<{path:string;blocked:boolean}>).detail;routeBlocked=!detail||typeof detail.path!=='string'||detail.path.split(/[?#]/,1)[0]!=='/board'||detail.blocked!==false;update();};
  const observer=windowElement?new MutationObserver(update):null;
  if(windowElement)observer?.observe(windowElement,{attributes:true,attributeFilter:['data-active']});
  document.addEventListener('visibilitychange',update);window.addEventListener('mendez-active-route',route);update();
  return()=>{observer?.disconnect();document.removeEventListener('visibilitychange',update);window.removeEventListener('mendez-active-route',route);};
 },[root]);
 return active;
}
