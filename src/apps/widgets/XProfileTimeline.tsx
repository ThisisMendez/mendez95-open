import {useEffect,useRef,useState} from 'react';
import {loadXWidgets,X_PROFILE} from './xTimeline';
const REFRESH_MS=5*60_000;
/** The provider renders its own timeline; no post is copied, fabricated or called verified latest. */
export function XProfileTimeline({compact=false,open}:{compact?:boolean;open?:()=>void}){
 const target=useRef<HTMLDivElement>(null),frameRoot=useRef<HTMLDivElement>(null),lastRefresh=useRef(0);
 const [width,setWidth]=useState(0),[theme,setTheme]=useState(()=>document.documentElement.dataset.theme==='dark'?'dark':'light');
 const [attempt,setAttempt]=useState(0),[failure,setFailure]=useState(''),[state,setState]=useState<'loading'|'ready'|'unavailable'>('loading');
 useEffect(()=>{const root=frameRoot.current;if(!root)return;const update=()=>setWidth(Math.floor(root.clientWidth));update();const observer=new ResizeObserver(update);observer.observe(root);return()=>observer.disconnect();},[]);
 useEffect(()=>{const update=()=>setTheme(document.documentElement.dataset.theme==='dark'?'dark':'light');const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});return()=>observer.disconnect();},[]);
 useEffect(()=>{
  if(width<180||!target.current)return;
  let active=true,finished=false;const container=target.current,host=document.createElement('div');container.replaceChildren(host);setState('loading');setFailure('');lastRefresh.current=Date.now();
  // Use the published anchor markup, scoped to this host for SPA/React navigation.
  const link=document.createElement('a');link.className='twitter-timeline';link.href=X_PROFILE;link.textContent='Posts by @exampleowner';
  for(const [key,value] of Object.entries({'data-dnt':'true','data-theme':theme,'data-chrome':'noheader nofooter noborders transparent','data-width':String(Math.min(520,width)),'data-height':compact?'220':'520','data-aria-polite':'polite'}))link.setAttribute(key,value);
  host.append(link);
  // A generation owns its host; late SDK work cannot replace a newer attempt.
  const timeout=setTimeout(()=>{if(active&&!finished){finished=true;observer.disconnect();setState('unavailable');setFailure('no-provider-frame');host.remove();}},18000);
  const inspect=()=>{const frame=host.querySelector('iframe');if(!active||finished||!frame||frame.getBoundingClientRect().height<20)return;finished=true;clearTimeout(timeout);frame.title='Public X profile timeline for @exampleowner';setState('ready');};
  const observer=new MutationObserver(inspect);observer.observe(host,{childList:true,subtree:true,attributes:true});
  void loadXWidgets().then(api=>{if(active&&!finished){api.widgets.load(host);inspect();}}).catch(()=>{if(active&&!finished){finished=true;clearTimeout(timeout);setState('unavailable');setFailure('sdk-load');observer.disconnect();host.remove();}});
  return()=>{active=false;observer.disconnect();clearTimeout(timeout);host.remove();};
 },[width,theme,attempt]);
 useEffect(()=>{
  const refresh=()=>{if(document.visibilityState!=='visible'||Date.now()-lastRefresh.current<REFRESH_MS)return;const focused=document.activeElement;if(focused&&frameRoot.current?.contains(focused))return;setAttempt(value=>value+1);};
  const timer=setInterval(refresh,REFRESH_MS);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 const narrow=width>0&&width<180;
 return <section className={`os-x-timeline${compact?' is-compact':''}`} aria-label="X profile timeline">
  <a className="os-x-account" href={X_PROFILE} target="_blank" rel="noopener noreferrer">@exampleowner ↗</a>
  <div ref={frameRoot} className="os-x-timeline-viewport" data-x-state={narrow?'narrow':state} data-x-failure={failure||undefined}>
   {!narrow&&<div ref={target} className="os-x-timeline-target"/>}
   <p className="os-x-timeline-status" role="status" aria-live="polite">{narrow?'Open the timeline for a wider view.':state==='loading'?'Loading X timeline…':state==='unavailable'?'X’s timeline is unavailable here right now. Open the profile on X.':''}</p>
  </div>
  <div className="os-widget-actions os-x-timeline-actions"><a href={X_PROFILE} target="_blank" rel="noopener noreferrer">Open on X ↗</a>{compact&&open&&<button type="button" onClick={open}>Open timeline</button>}{!narrow&&<button type="button" aria-label="Refresh X timeline" onClick={()=>setAttempt(value=>value+1)}>Refresh</button>}</div>
  {!compact&&<small>Official X profile timeline. Checks again every five minutes while this page is visible; X controls which posts are returned. Privacy preference: do not personalize.</small>}
 </section>;
}
