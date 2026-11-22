import {usePocketMode} from '../../pocket/layout';
import {useId,useRef,useState,type KeyboardEvent,type ReactNode} from 'react';
import type {Story} from '../../content/types';
import {portfolioSubtitle} from '../../content/portfolioPresentation';
import {sourceRoute} from '../../desktop/router';
import {CaseNavigation} from '../CaseNavigation';
import {inline} from './inline';
import {DiagramViewer} from './DiagramViewer';
import './editorial.css';
import {PocketCaseGraphic,PocketCaseMark} from '../../pocket/PocketCaseGraphic';

export type OverviewReadingState={selected:number;expanded:number[]};
export const overviewProse=(text?:string)=>text?.split(/\r?\n\s*\r?\n/).map((paragraph,index)=><p key={index}>{inline(paragraph)}</p>);

/** Shared case/project reader; its application body owns all reading scroll. */
export function CaseFile({title,sections,readingState,onReadingState}:{title:string;sections:{label:string;content:ReactNode}[];readingState:OverviewReadingState;onReadingState:(state:OverviewReadingState)=>void}) {
 const pocket=usePocketMode(),id=useId(),tabs=useRef<(HTMLButtonElement|null)[]>([]);
 const {selected,expanded}=readingState;
 const select=(index:number)=>onReadingState({...readingState,selected:index});
 const onTabKey=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{
  const next=event.key==='ArrowRight'?(index+1)%sections.length:event.key==='ArrowLeft'?(index+sections.length-1)%sections.length:event.key==='Home'?0:event.key==='End'?sections.length-1:null;
  if(next===null)return;
  event.preventDefault();select(next);tabs.current[next]?.focus();
 };
 return <section className="os-case-inset os-case-file" aria-labelledby={`${id}-file`}>
  <h2 id={`${id}-file`} className="os-case-panel-title">{title}</h2>
  <div className="os-case-file-inner">{pocket?<div className="pocket-case-accordions">{sections.map((section,index)=><details key={section.label} open={expanded.includes(index)} onToggle={event=>{const open=event.currentTarget.open;if(open!==expanded.includes(index))onReadingState({...readingState,expanded:open?[...expanded,index]:expanded.filter(i=>i!==index)});}}><summary>{section.label}</summary><div className="os-case-file-content">{section.content}</div></details>)}</div>:<>
   <div className="os-case-file-tabs" role="tablist" aria-label={`${title} sections`}>{sections.map((section,index)=><button key={section.label} ref={element=>{tabs.current[index]=element;}} type="button" role="tab" id={`${id}-tab-${index}`} aria-selected={selected===index} aria-controls={`${id}-panel-${index}`} tabIndex={selected===index?0:-1} onClick={()=>select(index)} onKeyDown={event=>onTabKey(event,index)}>{section.label}</button>)}</div>
   {sections.map((section,index)=><section key={section.label} role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} hidden={selected!==index} tabIndex={0} className="os-case-file-content"><h3>{section.label}</h3>{section.content}</section>)}
  </>}</div>
 </section>;
}

export function CaseOverview({story,siblings,navigate,readingState,onReadingState}:{story:Story;siblings:Story[];navigate:(path:string)=>void;readingState:OverviewReadingState;onReadingState:(state:OverviewReadingState)=>void}) {
 const [enlarged,setEnlarged]=useState(false),trigger=useRef<HTMLButtonElement>(null),id=useId();
 const pocket=usePocketMode();
 const overview=story.overview!,subtitle=portfolioSubtitle(story);
 const sections=[
  {label:'The Challenge',body:overview.challenge},
  {label:'My Approach',body:overview.contribution},
  {label:'The Outcome',body:overview.impact},
  {label:'The Tradeoff',body:overview.tradeoff},
 ].map(section=>({label:section.label,content:section.body.trim()?overviewProse(section.body):<p>This section is awaiting review.</p>}));
 return <article className="os-app os-editorial os-case-overview" data-story={story.id}>
  <div className="os-editorial-toolbar"><button className="os-text-action" onClick={()=>navigate('/work')}>← Portfolio</button><span>Overview</span></div>
  <div className="os-editorial-paper">
   <header><h1>{story.menuLabel||story.title}</h1>{story.featured&&<p className="os-featured-work">Featured work</p>}<p className="os-overview-subject">{story.subject}</p>{subtitle&&<p className="os-overview-subtitle">{inline(subtitle)}</p>}<p className="os-overview-meta">{[story.context.split(' · ')[0],story.role,story.dates].filter(Boolean).join(' · ')}</p></header>
   <div className="os-overview-description">{overviewProse(overview.introduction)}</div>
   <section className="os-case-inset os-case-highlights-panel" aria-labelledby={`${id}-highlights`}>
    <h2 id={`${id}-highlights`} className="os-case-panel-title">Key Highlights</h2>
    <ol className="os-case-highlights-row">{overview.highlights.map((highlight,index)=><li key={index}>{pocket?<details className="pocket-highlight"><summary><span className="pocket-highlight-symbol" aria-hidden="true"><PocketCaseMark name={['check','person','flag'][index%3]!}/></span>{story.id==='demo-platform'?['Contract checks','Human review','Staged rollout'][index]:inline(highlight.title)}</summary><p>{inline(highlight.body)}</p></details>:<><span className="os-overview-highlight-number" aria-hidden="true">{String(index+1).padStart(2,'0')}</span><div><h3>{inline(highlight.title)}</h3><p>{inline(highlight.body)}</p></div></>}</li>)}</ol>
   </section>
   <div className="os-case-sidebar-layout">
    <div className="os-case-visual-column">
     <section className="os-case-inset" aria-label="Case visual">
      <h2 className="os-case-panel-title">Case Visual</h2>
      <>{pocket?<PocketCaseGraphic caseId={story.id}/>:<figure><button ref={trigger} className="os-editorial-image-button" onClick={()=>setEnlarged(true)} aria-haspopup="dialog" aria-label={`Enlarge diagram: ${overview.artifact.alt}`}><img src={overview.artifact.src} alt={overview.artifact.alt}/><span className="os-diagram-affordance">Enlarge diagram ↗</span></button><figcaption>{inline(overview.artifact.caption)}</figcaption></figure>}</>
     </section>
    </div>
    <div className="os-case-file-column">
     <CaseFile title="Case File" sections={sections} readingState={readingState} onReadingState={onReadingState}/>
     <div className="os-overview-cta"><button className="os-button os-read-full" onClick={()=>navigate(`${sourceRoute(story.kind,story.slug)}?view=full`)}>Read Full Case Study →</button><button className="os-button" onClick={()=>navigate('/contact')}>Talk Product</button></div>
    </div>
   </div>
  </div>
  <CaseNavigation story={story} siblings={siblings} navigate={navigate} showContact={false}/>
  {enlarged&&<DiagramViewer photo={overview.artifact} close={()=>{setEnlarged(false);requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));}}/>}
 </article>;
}
