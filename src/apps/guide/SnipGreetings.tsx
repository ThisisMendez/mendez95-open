import './snipGreetings.css';
import {usePocketMode} from '../../pocket/layout';
import{useEffect,useLayoutEffect,useRef,useState}from'react';
import type{SiteContentView}from'../../content/types';
import type{WindowRecord}from'../../desktop/useDesktop';
import {tipsEnabled,setTipsEnabled,subscribeTips,dismissPreparedTip} from './tipPreferences';
export function SnipGreetings({windows,content,blocked}:{windows:WindowRecord[];content:SiteContentView;blocked:boolean}){
 const pocket=usePocketMode(),name='SNIP-E';
 const [anchor,setAnchor]=useState<{left:number;top:number;side:string}|null>(null);
 const tip=useRef<HTMLElement>(null);

 const previous=useRef(new Set<string>()),[message,setMessage]=useState(''),[enabled,setEnabled]=useState(tipsEnabled);
 useLayoutEffect(()=>{
  if(pocket||blocked||!message)return;const launcher=document.querySelector<HTMLElement>('.desktop-companion'),node=tip.current;if(!launcher||!node)return;
  const place=()=>{const r=launcher.getBoundingClientRect(),b=node.getBoundingClientRect(),gap=12;let left=r.left-b.width-gap,top=r.top+(r.height-b.height)/2,side='left';if(left<8){left=r.right+gap;side='right';}if(left+b.width>innerWidth-8){left=Math.max(8,Math.min(r.left,innerWidth-b.width-8));top=r.top-b.height-gap;side='above';}top=Math.max(50,Math.min(top,innerHeight-b.height-48));setAnchor(previous=>previous?.left===left&&previous.top===top&&previous.side===side?previous:{left,top,side});};
  const resize=new ResizeObserver(place);resize.observe(node);resize.observe(launcher);const observer=new MutationObserver(place);observer.observe(launcher,{attributes:true,attributeFilter:['style','hidden']});window.addEventListener('resize',place);place();return()=>{resize.disconnect();observer.disconnect();window.removeEventListener('resize',place);};
 },[pocket,blocked,message]);
 useEffect(()=>{if(!content.stories.length)return;const apps=new Set(windows.map(w=>w.appId));const opened=[...apps].filter(id=>!previous.current.has(id));previous.current=apps;if(!enabled)return;const count=content.stories.filter(s=>s.kind!=='side-project').length;const messages:Record<string,string>={work:`You’re in Portfolio. ${count===6?'Six cases.':`${count} available cases.`} You don’t need to read them alphabetically. Start with Digital Health Platform.`,resume:'You’re in Resume. A career, without the attachment hunt. Print the summary or request the full version.', 'side-projects':'You’re in Side Projects. Prototypes have boundaries. Open a project to see what was built and what remains.',paint:'You’re in Paint. Finally, a meeting where drawing boxes counts as progress. Try a brush, then save your masterpiece.',photos:'You’re in Photos. No slide deck here. Open a photograph, then browse with the arrows.'};const latest=opened.filter(id=>messages[id]).at(-1);if(latest)setMessage(messages[latest]!);},[windows,content.stories,enabled]);
 useEffect(()=>subscribeTips(()=>setEnabled(tipsEnabled())),[]);
 const [typing,setTyping]=useState(false);
 useEffect(()=>{const sync=()=>setTyping(Boolean(document.activeElement?.matches('input,textarea,[contenteditable=true]')));document.addEventListener('focusin',sync);document.addEventListener('focusout',sync);return()=>{document.removeEventListener('focusin',sync);document.removeEventListener('focusout',sync);};},[]);
 const disable=()=>{setTipsEnabled(false);setEnabled(false);setMessage('');};
 if(pocket||blocked||!enabled||!message||typing)return null;
 return <aside ref={tip} className="snip-greeting" data-side={anchor?.side} style={anchor?{left:anchor.left,top:anchor.top,bottom:'auto'}:{visibility:'hidden'}} aria-label={`${name} prepared tip`}><div><strong>{name} · Prepared tip</strong><p>{message}</p><button onClick={disable}>Disable automatic tips</button></div><button aria-label={`Dismiss ${name} tip`} onClick={()=>{dismissPreparedTip();setMessage('');}}>×</button></aside>;
}
