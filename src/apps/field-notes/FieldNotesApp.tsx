import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type MouseEvent} from 'react';
import type {FieldNote,SiteContentView} from '../../content/types';
import {usePocketMode} from '../../pocket/layout';
import {BROWSE_KEY,NOTE_FILTERS,indexExcerpt,notesForFilter,pocketShelves,restoreBrowseState,selectFilter,type BrowseState,type NoteFilter} from './browseState';
import './fieldNotes.css';
type Props={content:SiteContentView;navigate:(path:string)=>void;slug?:string;preview?:boolean};
const groupDescription=(note:FieldNote)=>!note.group?'Ungrouped':note.groupKind==='series'?'Series':'Editorial group';
const readingTime=(note:FieldNote)=>note.readingMinutes?`${note.readingMinutes} min read`:'Reading time unavailable';
function readState(notes:readonly FieldNote[]):BrowseState{try{return restoreBrowseState(sessionStorage.getItem(BROWSE_KEY),notes);}catch{return restoreBrowseState(null,notes);}}
function saveState(state:BrowseState){try{sessionStorage.setItem(BROWSE_KEY,JSON.stringify(state));}catch{/* Browsing remains usable without optional storage. */}}
function Cover({note,className=''}:{note:FieldNote;className?:string}){return note.coverSrc?<img className={className} src={note.coverSrc} alt={note.coverAlt||`Article cover: ${note.title}`} loading="lazy"/>:<span className={`fn-cover-fallback ${className}`} aria-hidden="true">▤</span>;}
function MediumLink({note}:{note:FieldNote}){return <a className="fn-medium-action os-button" href={note.url} target="_blank" rel="noopener noreferrer">Continue Reading on Medium <span aria-hidden="true">↗</span></a>;}
function NoteSummary({note,pocket}:{note:FieldNote;pocket:boolean}){return <article className={`fn-snapshot-content ${pocket?'is-pocket':''}`}>
  <header><span className="fn-kicker">{note.group||'Other Field Notes'} · {groupDescription(note)}</span><h1 id="fn-snapshot-title">{note.title}</h1><p className="fn-byline">Jordan Example · {readingTime(note)}</p></header>
  <div className="fn-snapshot-lead"><Cover note={note}/><section><h2>{pocket?'A quick look':'TL;DR'}</h2><p>{note.summary}</p></section></div>
  {!pocket&&<><section className="fn-takeaways"><h2>Key takeaways</h2><ul>{note.previewBullets?.map(bullet=><li key={bullet}>{bullet}</li>)}</ul></section><div className="fn-keywords" aria-label="Article keywords">{note.keywords?.map(keyword=><span key={keyword}>{keyword}</span>)}</div></>}
  <div className="fn-summary-disclosure">Original summary by this portfolio. Read the complete article on Medium.</div><MediumLink note={note}/>
</article>;}
function DesktopSnapshot({note,close}:{note:FieldNote;close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const element=dialog.current;if(!element)return;element.showModal();return()=>{if(element.open)element.close();};},[]);
 return <dialog ref={dialog} className="fn-snapshot-dialog" aria-labelledby="fn-snapshot-title" onCancel={event=>{event.preventDefault();close();}}><div className="fn-snapshot-toolbar"><span>Field Notes / Quick look</span><button type="button" className="os-button" autoFocus onClick={close} aria-label="Close Quick look">×</button></div><NoteSummary note={note} pocket={false}/><button className="fn-back os-text-action" onClick={close}>← Back to Field Notes</button></dialog>;
}
export function FieldNotesApp({content,navigate,slug}:Props){
 const pocket=usePocketMode();
 const notes=useMemo(()=>[...content.fieldNotes].sort((a,b)=>a.displayOrder-b.displayOrder),[content.fieldNotes]);
 const [state,setState]=useState(()=>readState(notes));const stateRef=useRef(state);
 const root=useRef<HTMLDivElement>(null),list=useRef<HTMLDivElement>(null),opener=useRef<HTMLElement|null>(null),previousSlug=useRef(slug);
 const selectedSnapshot=notes.find(note=>note.slug===slug);
 const visible=notesForFilter(notes,state.filter);
 const selected=visible.find(note=>note.id===state.selectedId)||visible.find(note=>note.featured)||visible[0];
 const pageScroller=useCallback(()=>root.current?.closest<HTMLElement>('.os-window-body')||null,[]);
 const commit=useCallback((next:BrowseState)=>{stateRef.current=next;setState(next);saveState(next);},[]);
 const remember=useCallback(()=>{if(slug)return;const next={...stateRef.current,listScroll:list.current?.scrollTop??stateRef.current.listScroll,[pocket?'pocketScroll':'pageScroll']:pageScroller()?.scrollTop??(pocket?stateRef.current.pocketScroll:stateRef.current.pageScroll)};stateRef.current=next;saveState(next);},[pageScroller,slug,pocket]);
 useEffect(()=>{const page=pageScroller();page?.addEventListener('scroll',remember,{passive:true});return()=>{page?.removeEventListener('scroll',remember);};},[remember,pocket]);
 useEffect(()=>{if(!selectedSnapshot)return;if(stateRef.current.selectedId!==selectedSnapshot.id)commit({...stateRef.current,selectedId:selectedSnapshot.id});},[selectedSnapshot,commit]);
 useLayoutEffect(()=>{
  if(slug){if(pocket){const page=pageScroller();if(page)page.scrollTop=0;}return;}
  const frame=requestAnimationFrame(()=>{const current=stateRef.current;if(list.current)list.current.scrollTop=current.listScroll;const page=pageScroller();if(page)page.scrollTop=pocket?current.pocketScroll:current.pageScroll;
   if(previousSlug.current){const target=opener.current?.isConnected?opener.current:root.current?.querySelector<HTMLElement>(`[data-note-id="${current.selectedId}"]`);target?.focus({preventScroll:true});}previousSlug.current=undefined;
  });return()=>cancelAnimationFrame(frame);
 },[slug,pocket,pageScroller]);
 useEffect(()=>{if(slug)previousSlug.current=slug;},[slug]);
 const filter=(next:NoteFilter)=>{commit(selectFilter(stateRef.current,next,notes));if(list.current)list.current.scrollTop=0;};
 const select=(note:FieldNote)=>commit({...stateRef.current,selectedId:note.id});
 const open=(note:FieldNote,event:MouseEvent<HTMLButtonElement>)=>{opener.current=event.currentTarget;remember();commit({...stateRef.current,selectedId:note.id});navigate(`/field-notes/${note.slug}`);};
 const close=()=>navigate('/field-notes');
 if(slug&&!selectedSnapshot)return <div className="os-app fn-app"><h1>Article unavailable</h1><p>This Field Note is unavailable in this view.</p><button className="os-button" onClick={close}>Back to Field Notes</button></div>;
 if(pocket&&selectedSnapshot)return <div ref={root} className="os-app fn-app fn-pocket-preview"><button className="fn-back os-text-action" onClick={close}>← Back to Field Notes</button><NoteSummary note={selectedSnapshot} pocket/><button className="fn-back os-text-action" onClick={close}>← Back to Field Notes</button></div>;
 return <div ref={root} className={`os-app fn-app ${pocket?'fn-pocket':'fn-desktop'}`}>
  <header className="fn-index-heading"><span className="fn-kicker">Jordan Example · Published on Medium</span><h1>Field Notes</h1><p>Products, teams, and the systems behind everyday decisions.</p></header>
  <nav className="fn-filters" aria-label="Filter Field Notes">{NOTE_FILTERS.map(item=><button type="button" key={item} aria-pressed={state.filter===item} onClick={()=>filter(item)}>{item}{item==='All'?` (${notes.length})`:''}</button>)}</nav>
  <p className="fn-filter-description">Example Method and Internal Use Only are series. Product &amp; Teams and Systems &amp; Performance are portfolio editorial groups.</p>
  {pocket?<div className="fn-shelves">{pocketShelves(notes,state.filter).map(shelf=><section className="fn-shelf" key={shelf.label}><header>{shelf.filter?<button onClick={()=>filter(shelf.filter!)} aria-label={`Browse ${shelf.label}`}>{shelf.label}</button>:<h2>{shelf.label}</h2>}<span>{shelf.kind==='series'?'Series':shelf.kind==='editorial'?'Editorial group':'More writing'}</span></header>{shelf.notes.map(note=><button type="button" className="fn-shelf-note" data-note-id={note.id} key={note.id} onClick={event=>open(note,event)} aria-label={`Quick look: ${note.title}`}><Cover note={note}/><span><strong>{note.title}</strong><small>{readingTime(note)} · Quick look</small></span><span aria-hidden="true">›</span></button>)}</section>)}</div>:
  <div className="fn-reading-desk"><div ref={list} className="fn-master-list" onScroll={remember} aria-label="Articles">{visible.map(note=><button className={`fn-master-note ${selected?.id===note.id?'is-selected':''}`} data-note-id={note.id} type="button" key={note.id} aria-pressed={selected?.id===note.id} onClick={()=>select(note)}><Cover note={note}/><span><strong>{note.title}</strong><small>{readingTime(note)} · {note.group}</small></span></button>)}</div>
   {selected&&<section className="fn-selected-preview" aria-live="polite" aria-atomic="true"><Cover note={selected}/><div className="fn-preview-actions">{selected.group&&NOTE_FILTERS.includes(selected.group as NoteFilter)?<button className="fn-group-link" onClick={()=>selected.group&&filter(selected.group as NoteFilter)}>{selected.group||'Other Field Notes'} · {groupDescription(selected)}</button>:<span className="fn-group-label">{selected.group||'Other Field Notes'} · {groupDescription(selected)}</span>}<button className="fn-quick-look os-button" onClick={event=>open(selected,event)}>Quick look <span aria-hidden="true">→</span></button></div><h2>{selected.title}</h2><p className="fn-byline">{readingTime(selected)}{selected.featured?' · Featured note':''}</p><p className="fn-index-excerpt">{indexExcerpt(selected)}</p><small>A summary, key takeaways, and the full article link.</small></section>}
  </div>}
  {visible.length===0&&<div className="fn-empty" role="status"><p>No articles are available in this group.</p><button className="os-button" onClick={()=>filter('All')}>Show all Field Notes</button></div>}
  <p className="fn-index-count">{visible.length} of {notes.length} articles · {state.filter}</p>
  {!pocket&&selectedSnapshot&&<DesktopSnapshot key={selectedSnapshot.id} note={selectedSnapshot} close={close}/>}
 </div>;
}
