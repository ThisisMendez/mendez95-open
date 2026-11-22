import {useEffect,useMemo,useRef,useState} from 'react';
import type {PhotoRecord,Story} from '../../content/types';
import {sourceRoute} from '../../desktop/router';
import {CaseNavigation} from '../CaseNavigation';
import {CasePreviewNotice} from '../CasePreviewNotice';
import {parseArticle} from '../../content/articleMarkdown';
import {inline} from './inline';
import {DiagramViewer} from './DiagramViewer';
import './editorial.css';
export function EditorialArticle({story,photos,siblings,navigate,backRoute}:{story:Story;photos:PhotoRecord[];siblings:Story[];navigate:(path:string)=>void;backRoute:string}){
 const blocks=useMemo(()=>parseArticle(story.articleMarkdown||'',story.slug),[story.articleMarkdown,story.slug]);
 const [selected,setSelected]=useState<{src:string;alt:string}|null>(null),root=useRef<HTMLElement>(null),lastTrigger=useRef<HTMLButtonElement|null>(null);
 const allowed=new Map(photos.filter(p=>p.status==='published'&&p.disclosureStatus==='cleared'&&p.rightsCleared).map(p=>[p.src,p]));
 const titleBlock=blocks.find(b=>b.type==='heading'&&b.level===1);
 const headings=blocks.filter(b=>b.type==='heading'&&b.level>1);
 const jump=(id:string)=>{if(!id)return;const el=root.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);if(!el)return;el.scrollIntoView({block:'start',behavior:'instant'});el.focus({preventScroll:true});};
 useEffect(()=>{
  const sync=()=>{
   if(window.location.pathname!==sourceRoute(story.kind,story.slug))return;
   let fragment:string;
   try{fragment=decodeURIComponent(window.location.hash.slice(1));}catch{return;}
   jump(fragment);
  };
  const id=requestAnimationFrame(sync);
  window.addEventListener('hashchange',sync);window.addEventListener('popstate',sync);
  return()=>{cancelAnimationFrame(id);window.removeEventListener('hashchange',sync);window.removeEventListener('popstate',sync);};
 },[story.id,story.slug,blocks]);
 const close=()=>{setSelected(null);requestAnimationFrame(()=>lastTrigger.current?.focus({preventScroll:true}));};
 return <article ref={root} className="os-app os-editorial" data-story={story.id}>
 <div className="os-editorial-toolbar"><div><button className="os-text-action" onClick={()=>navigate(backRoute)}>← {backRoute==='/side-projects'?'Side Projects':'Portfolio'}</button>{story.overview&&<button className="os-text-action" onClick={()=>navigate(sourceRoute(story.kind,story.slug))}>Back to Overview</button>}</div><details className="os-editorial-sections"><summary>On this page</summary><nav aria-label="Article sections">{headings.map(h=>{
  if(h.type!=='heading')return null;
  const path=`${sourceRoute(story.kind,story.slug)}${story.overview?'?view=full':''}#${h.id}`;
  return <a key={h.id} href={path} onClick={event=>{event.preventDefault();event.currentTarget.closest('details')?.removeAttribute('open');navigate(path);requestAnimationFrame(()=>jump(h.id));}}>{h.text}</a>;
 })}</nav></details></div>
 <div className="os-editorial-paper"><CasePreviewNotice stage={story.caseStage}/>{blocks.map((block,index)=>{
  if(block.type==='heading'){if(block===titleBlock && story.title!==block.text)return <header key={index} className="os-editorial-intro"><h1 id={block.id} tabIndex={-1}>{inline(story.title)}</h1><p className="os-editorial-narrative-subtitle">{inline(block.text)}</p></header>;const Tag=`h${Math.min(block.level,6)}` as 'h1'|'h2'|'h3';return <Tag key={index} id={block.id} tabIndex={-1}>{inline(block.text)}</Tag>;}
  if(block.type==='paragraph')return <p key={index}>{inline(block.text)}</p>;
  if(block.type==='quote')return <blockquote key={index}>{inline(block.text)}</blockquote>;
  if(block.type==='rule')return <hr key={index}/>;
  if(block.type==='list'){
   // Only the authored evaluation-coverage set is established as independent.
   // Never infer that a long list of dependent instructions can be rearranged.
   const heading=[...blocks.slice(0,index)].reverse().find(b=>b.type==='heading');
   const independent=story.id==='demo-platform'&&heading?.type==='heading'&&heading.text==='Step 2: Plan the evaluation suite';
   return <ul className={`os-article-list ${independent&&block.items.length>=6?'is-compact':''} ${independent&&block.items.length>=9?'has-many':''}`} key={index}>{block.items.map((item,i)=><li key={i}>{inline(item)}</li>)}</ul>;
  }
  if(block.type==='table')return <table key={index}><tbody>{block.rows.filter(row=>row.some(Boolean)).map((row,i)=><tr key={i}>{row.map((cell,n)=>n===0?<th key={n} scope="row">{inline(cell)}</th>:<td key={n}>{inline(cell)}</td>)}</tr>)}</tbody></table>;
  const photo=allowed.get(block.src)||story.caseMedia?.find(media=>media.src===block.src&&media.rightsCleared);if(!photo)return <p key={index}>Image unavailable: {block.alt}</p>;
  return <figure key={index} className={index===1?'is-cover':''}><button className="os-editorial-image-button" onClick={event=>{lastTrigger.current=event.currentTarget;setSelected({src:photo.src,alt:block.alt});}} aria-label={`Enlarge: ${block.alt}`}><img src={photo.src} alt={block.alt} loading={index<3?'eager':'lazy'}/><span className="os-diagram-affordance">Enlarge diagram ↗</span></button><figcaption>{block.alt}</figcaption></figure>;
 })}</div>
 <CaseNavigation story={story} siblings={siblings} navigate={navigate}/>{selected&&<DiagramViewer photo={selected} close={close}/>}</article>;
}
