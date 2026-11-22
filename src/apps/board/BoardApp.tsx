import {useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent} from 'react';
import {useVisitorAppearance,useVisitorName} from '../../desktop/visitorIdentity';
import {usePocketMode} from '../../pocket/layout';
import {noteAppearance} from './appearance';
import {PixelCharacter} from './PixelCharacter';
import './board.css';
import {RoomScene} from './RoomScene';
import {VisitorIdentityDialog} from '../../components/VisitorIdentityDialog';
import {isNearTranscriptBottom,shouldFollowTranscript} from './transcriptScroll';
import {useBoardActivity} from './useBoardActivity';
/** Reversible public presentation switch; private moderation/report endpoints remain. */
const SHOW_PUBLIC_REPORT = import.meta.env.VITE_PUBLIC_BOARD_REPORT === 'true';
export function relativeTime(date:string,now:number){const seconds=Math.max(0,Math.floor((now-Date.parse(date))/1000));if(seconds<60)return 'Just now';if(seconds<3600)return `${Math.floor(seconds/60)}m ago`;if(seconds<86400)return `${Math.floor(seconds/3600)}h ago`;if(seconds<30*86400)return `${Math.floor(seconds/86400)}d ago`;return `${Math.floor(seconds/(30*86400))}mo ago`;}
type Note = {id:string; name:string; text:string; createdAt:string; x:number; y:number; sample?:boolean; characterId?:unknown; colorId?:unknown};
function dateLabel(date:string){return new Date(date).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'});}
export default function BoardApp(_props:{navigate:(path:string)=>void}){
  const pocket=usePocketMode();
  const root=useRef<HTMLElement>(null);
  const active=useBoardActivity(root);
  const loadController=useRef<AbortController|null>(null);
  const [name]=useVisitorName();
  const [message,setMessage]=useState('');
  const [appearance]=useVisitorAppearance();
  const [notes,setNotes]=useState<Note[]>([]);
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [identityOpen,setIdentityOpen]=useState(false),[atLatest,setAtLatest]=useState(true);
  const identityTrigger=useRef<HTMLButtonElement>(null);
  const nearBottom=useRef(true),positionedInitial=useRef(false),postedFollow=useRef(false);
  const posting=useRef(false), revision=useRef(0);
  const transcript=useRef<HTMLDivElement>(null);
  const showLatest=useCallback(()=>{const node=transcript.current;if(!node)return;node.scrollTo({top:node.scrollHeight,behavior:'auto'});nearBottom.current=true;setAtLatest(true);},[]);
  useLayoutEffect(()=>{
    if(!loaded||!active)return;
    const initial=!positionedInitial.current,posted=postedFollow.current;
    if(!shouldFollowTranscript({initial,posted,nearBottom:nearBottom.current})){setAtLatest(false);return;}
    // Two animation frames let the data commit and responsive transcript layout
    // settle. Polling rechecks the reader position before moving it.
    let second=0;
    const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{
      if(shouldFollowTranscript({initial,posted,nearBottom:nearBottom.current}))showLatest();
      positionedInitial.current=true;postedFollow.current=false;
    });});
    return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
  },[notes,loaded,active,showLatest]);
  const load=useCallback(async()=>{
    if(!active)return;
    const start=revision.current;
    loadController.current?.abort();const controller=new AbortController();loadController.current=controller;
    try{
      const response=await fetch('/api/board',{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error();
      const data=await response.json();
      if(controller.signal.aborted||start!==revision.current||posting.current)return;
      const incoming:Note[]=Array.isArray(data.notes)?data.notes:[];
      incoming.sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id.localeCompare(b.id));
      setNotes(incoming);
      setLoaded(true);
    }catch{if(!controller.signal.aborted)setNotice('Chatroom 95 is temporarily unavailable. Try Refresh.');}
  },[active]);
  useEffect(()=>{if(!active)return;void load();const timer=window.setInterval(()=>{void load();},20_000);return()=>{clearInterval(timer);loadController.current?.abort();};},[load,active]);
  async function submit(event:FormEvent){
    event.preventDefault();if(posting.current||message.trim().length<2)return;
    posting.current=true;setBusy(true);setNotice('Checking your note…');
    try{
      const response=await fetch('/api/board',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,text:message,...appearance})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'The note could not be published.');
      postedFollow.current=true;setLoaded(true);revision.current++;setNotes(current=>[...current,data.note]);
      setMessage('');setNotice('Your note is published. Thanks for leaving a little wave.');
    }catch(error){setNotice(error instanceof Error?error.message:'The note could not be published. Your draft is still here.');}
    finally{posting.current=false;setBusy(false);}
  }
  async function report(note:Note){try{const response=await fetch(`/api/board/${encodeURIComponent(note.id)}/report`,{method:'POST'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Report could not be sent.');setNotice('Report sent to the owner.');}catch(error){setNotice(error instanceof Error?error.message:'Report could not be sent.');}}
  return <section ref={root} className={`m-lounge${pocket?' m-lounge-pocket':''}`} aria-label={pocket?'Players Lobby':'Chatroom 95'}>
    <header className="lounge-heading"><div><h2>{pocket?'Players Lobby':'Chatroom 95'}</h2><p>Leave a message for the next visitor.</p></div><button onClick={()=>void load()}>Refresh</button></header>
    {pocket&&<RoomScene/>}
    <div className="lounge-layout"><div className="lounge-main">
    <div className="lounge-transcript" ref={transcript} role="log" tabIndex={0} aria-live="off" aria-label="Messages" onScroll={event=>{nearBottom.current=isNearTranscriptBottom(event.currentTarget);setAtLatest(nearBottom.current);}}>
      <h3 className="lounge-messages-label">Messages</h3>
      {!notes.length&&<p className="lounge-empty">{loaded?'No notes yet. Leave the first little wave.':'Loading notes…'}</p>}
      {notes.map(note=><article className={`lounge-message lounge-color-${noteAppearance(note).colorId}`} key={note.id} data-note-id={note.id}>
        <PixelCharacter {...noteAppearance(note)}/><div><header><strong>{note.name}</strong><span aria-hidden="true"> · </span><time dateTime={note.createdAt}>{dateLabel(note.createdAt)}</time></header><p>{note.text}</p>{SHOW_PUBLIC_REPORT&&!note.sample&&<button className="lounge-report" aria-label={`Report note by ${note.name}`} onClick={()=>void report(note)}>Report</button>}</div>
      </article>)}
    </div>
    <div className="lounge-transcript-footer"><span>Messages stay here for future visitors.</span>{!atLatest&&<button onClick={showLatest}>Latest notes ↓</button>}</div>
    <form className="lounge-composer" onSubmit={submit}>
      <div className="lounge-current-identity"><PixelCharacter {...appearance}/><span>You are <strong>{name}</strong></span><button ref={identityTrigger} type="button" aria-haspopup="dialog" onClick={()=>setIdentityOpen(true)}>Edit identity</button></div>
      <div className="lounge-compose-fields"><label htmlFor="messenger-note">Your public note <small>{message.length}/280</small></label><textarea id="messenger-note" value={message} onChange={event=>setMessage(event.target.value)} minLength={2} maxLength={280} rows={2} placeholder="Leave a note…" required onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&event.keyCode!==229){event.preventDefault();if(!posting.current)event.currentTarget.form?.requestSubmit();}}}/><button type="submit" disabled={busy||message.trim().length<2}>{busy?'Checking…':'Post note'}</button></div>
      <small>Public notes · No links or private information. Shift+Enter adds a line.</small>
    </form><p className="lounge-notice" role="status">{notice}</p>
    </div>{!pocket&&<aside className="lounge-room-info"><h3>Room info</h3><RoomScene/><h4>A place to drop a note.</h4><p>Public guestbook.</p><p>Share a thought, a hello, or whatever’s on your mind.</p></aside>}</div>
    {identityOpen&&<VisitorIdentityDialog close={()=>{setIdentityOpen(false);identityTrigger.current?.focus({preventScroll:true});}}/>}
  </section>;
}
