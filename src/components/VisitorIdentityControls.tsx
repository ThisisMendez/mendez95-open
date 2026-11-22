import {useEffect,useRef,useState} from 'react';
import {usePocketMode} from '../pocket/layout';
import {useVisitorName,useVisitorAppearance} from '../desktop/visitorIdentity';
import {CHARACTERS,PRIMARY_COLORS} from '../apps/board/appearance';
import {PixelCharacter} from '../apps/board/PixelCharacter';
import './visitorIdentity.css';
export function VisitorIdentityControls({id="identity"}:{id?:string}){
  const pocket=usePocketMode();
  const [name,setName]=useVisitorName(),[appearance,setAppearance]=useVisitorAppearance();
  const [draft,setDraft]=useState(name==='Visitor'?'':name),editing=useRef(false);
  useEffect(()=>{if(!editing.current)setDraft(name==='Visitor'?'':name);},[name]);
  const save=()=>{editing.current=false;setName(draft);setDraft(draft.trim());};
  return <section className="visitor-identity-controls" id={id}>
    <h2>Your identity</h2><p>Saved on this browser for {pocket?'Players Lobby':'Chatroom 95'} and optional game scores. Published notes keep the name and portrait used when posted.</p>
    <label>Your name<input aria-label="Your name" autoComplete="nickname" maxLength={30} value={draft} placeholder="Visitor" onFocus={()=>{editing.current=true;}} onChange={e=>setDraft(e.target.value)} onBlur={save} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}}/></label>
    <fieldset><legend>Your portrait</legend><div className="visitor-portrait-grid">{CHARACTERS.map((portrait,i)=><button type="button" key={portrait} aria-label={`Portrait ${i+1}: ${portrait}`} aria-pressed={appearance.characterId===portrait} onClick={()=>setAppearance({...appearance,characterId:portrait})}><PixelCharacter characterId={portrait} colorId={appearance.colorId}/></button>)}</div></fieldset>
    <fieldset><legend>Portrait frame color</legend><div className="visitor-color-choices">{PRIMARY_COLORS.map(color=><button type="button" className={`lounge-color-${color}`} key={color} aria-pressed={appearance.colorId===color} onClick={()=>setAppearance({...appearance,colorId:color})}><span aria-hidden="true"/>{color.charAt(0).toUpperCase()+color.slice(1)}</button>)}</div>{!PRIMARY_COLORS.some(color=>color===appearance.colorId)&&<small>Current saved color: {appearance.colorId}. Choose a color to change it.</small>}</fieldset>
    <small className="visitor-identity-save">Name saves when you leave its field. Portrait and frame color save when selected.</small>
  </section>;
}
