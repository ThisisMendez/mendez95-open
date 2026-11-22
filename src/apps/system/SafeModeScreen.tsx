import {useEffect,useRef,useState} from 'react';
import type {SiteContentView} from '../../content/types';
import {ResumeApp,ContactApp} from '../core/CoreApps';
import './safeMode.css';

type Destination='about'|'resume'|'contact'|null;

/** Safe Mode reads the same complete introduction as About, without its app layout. */
export function SafeModeAbout({about}:{about:SiteContentView['about']}) {
  const introduction=about.journey.find(entry=>entry.id==='introduction');
  return <section className="os-safe-about" aria-label="About introduction">{introduction?introduction.body.split('\n\n').map((paragraph,index)=><p key={index}>{paragraph}</p>):<p>The About introduction is not available.</p>}</section>;
}
export function SafeModeScreen({content,preview,restart}:{content:SiteContentView;preview:boolean;restart:()=>void}) {
  const [destination,setDestination]=useState<Destination>(null),[choice,setChoice]=useState('');
  const root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),heading=useRef<HTMLHeadingElement>(null);
  const select=(value:string)=>{const next=value==='1'?'about':value==='2'?'resume':value==='3'?'contact':null;setDestination(next);setChoice('');};
  useEffect(()=>{if(destination)heading.current?.focus();else input.current?.focus();},[destination]);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{
    const tag=(event.target as HTMLElement)?.tagName;
    if((event.target as HTMLElement)?.isContentEditable||(event.target as HTMLElement)?.closest('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(tag)||event.metaKey||event.ctrlKey||event.altKey)return;
    if(['0','1','2','3'].includes(event.key)){event.preventDefault();select(event.key);}
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  const navigate=(path:string)=>{if(path.startsWith('/resume'))setDestination('resume');else if(path.startsWith('/contact'))setDestination('contact');else setDestination('about');};
  const common={content,preview,navigate};
  return <div ref={root} className="os-safe-mode" role="dialog" aria-modal="true" aria-label="Mendez 95 Safe Mode" onKeyDown={event=>{
    if(event.key!=='Tab')return;const scope=(event.target as HTMLElement).closest('dialog[open]')||root.current;const items=[...(scope?.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea,summary,[tabindex]')||[])].filter(item=>item.tabIndex>=0&&!item.hasAttribute('disabled')&&item.getClientRects().length>0);
    if(event.shiftKey&&event.target===items[0]){event.preventDefault();items.at(-1)?.focus();}else if(!event.shiftKey&&event.target===items.at(-1)){event.preventDefault();items[0]?.focus();}
  }}>
    <span className="os-safe-corner">SAFE MODE</span><span className="os-safe-corner">SAFE MODE</span>
    <div className="os-safe-content"><header><span className="os-safe-code">MENDEZ 95 / 2.3</span><h1 ref={heading} tabIndex={-1}>{destination?{about:'About Jordan',resume:'Resume',contact:'Contact'}[destination]:'Safe Mode'}</h1><p>An intentional text-oriented view. No real outage, just a different way in.</p></header>

      <ol className="os-safe-choices" aria-label="Safe Mode destinations"><li><button onClick={()=>select('1')}>1 About</button></li><li><button onClick={()=>select('2')}>2 Resume</button></li><li><button onClick={()=>select('3')}>3 Contact</button></li></ol>
        <form className="os-safe-choice" onSubmit={event=>{event.preventDefault();select(choice);}}><label>Enter a choice: <input ref={input} inputMode="numeric" pattern={destination?'[0123]':'[123]'} maxLength={1} value={choice} onChange={event=>setChoice(event.target.value)} required aria-label="Enter a choice"/><span className="os-safe-caret" aria-hidden="true">▌</span></label><button type="submit">Enter ↵</button></form>
      <nav className="os-safe-navigation" aria-label="Safe Mode navigation">{destination&&<button onClick={()=>select('0')}>0 Back</button>}<button onClick={restart}>Restart Normally</button></nav>
      {destination&&<div className="os-safe-app">{destination==='about'?<SafeModeAbout about={content.about}/>:destination==='resume'?<ResumeApp {...common}/>:<ContactApp {...common}/>}</div>}
    </div>
    <span className="os-safe-corner">SAFE MODE</span><span className="os-safe-corner">SAFE MODE</span>
  </div>;
}
