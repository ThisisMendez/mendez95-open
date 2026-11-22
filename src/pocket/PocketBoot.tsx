import {useEffect,useRef} from 'react';
import './pocketBoot.css';
export function PocketBoot({start,reduceMotion}:{start:()=>void;reduceMotion:boolean}){
 const button=useRef<HTMLButtonElement>(null);
 useEffect(()=>{button.current?.focus();},[]);
 return <div className={`pocket-color-boot${reduceMotion?' is-ready':''}`} role="dialog" aria-modal="true" aria-label="Mendez 95 Pocket startup" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();start();}if(event.key==='Tab'){event.preventDefault();button.current?.focus();}}}>
 <div className="pocket-boot-bezel"><div className="pocket-boot-lcd"><h1>MENDEZ<span>95</span></h1><p>POCKET EDITION</p><div className="pocket-boot-color" aria-label="Color">{[...'COLOR'].map((letter,i)=><b key={i}>{letter}</b>)}</div><button ref={button} onClick={start} aria-label="Press Start — skip startup">PRESS START</button><div className="pocket-boot-pixels" aria-hidden="true">{[0,1,2,3,4].map(i=><i key={i}/>)}</div></div><span>MENDEZ 95 · POCKET</span></div></div>;
}
