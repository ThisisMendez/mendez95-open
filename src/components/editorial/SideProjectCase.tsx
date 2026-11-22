import {useRef,useState} from 'react';
import type {PhotoRecord,Story} from '../../content/types';
import {CaseNavigation} from '../CaseNavigation';
import {usePocketMode} from '../../pocket/layout';
import {CaseFile,overviewProse,type OverviewReadingState} from './CaseOverview';
import {DiagramViewer} from './DiagramViewer';
import {inline} from './inline';
import {PocketProjectGraphic} from '../../pocket/PocketCaseGraphic';
import {ProductProjectCase} from './ProductProjectCase';
import {validProductOverview} from '../../content/productOverview';

export function SideProjectCase({story,photos,siblings,navigate}:{story:Story;photos:PhotoRecord[];siblings:Story[];navigate:(path:string)=>void}) {
 if(validProductOverview(story.productOverview))return <ProductProjectCase story={story} overview={story.productOverview} photos={photos} siblings={siblings} navigate={navigate}/>;
 return <LegacySideProjectCase story={story} photos={photos} siblings={siblings} navigate={navigate}/>;
}

function LegacySideProjectCase({story,photos,siblings,navigate}:{story:Story;photos:PhotoRecord[];siblings:Story[];navigate:(path:string)=>void}) {
 const pocket=usePocketMode();
 const [image,setImage]=useState<PhotoRecord|null>(null),trigger=useRef<HTMLButtonElement|null>(null);
 const [readingStates,setReadingStates]=useState<Record<string,OverviewReadingState>>({});
 const readingState=readingStates[story.id]||{selected:0,expanded:[0]};
 const media=(story.supportingMediaIds||[]).flatMap(id=>photos.filter(photo=>photo.id===id&&photo.status!=='hidden'&&photo.disclosureStatus!=='restricted'&&photo.rightsCleared));
 const cover=pocket?media.find(photo=>photo.id===story.coverMediaId):undefined;
 const gallery=cover?media.filter(photo=>photo.id!==cover.id):media;
 const renderVisual=(photo:PhotoRecord)=>(
  <figure key={photo.id}>
   <button className="os-editorial-image-button" onClick={event=>{trigger.current=event.currentTarget;setImage(photo);}} aria-haspopup="dialog" aria-label={`Enlarge project visual: ${photo.alt}`}>
    <img src={photo.src} alt={photo.alt}/>
    <span className="os-diagram-affordance">Enlarge image ↗</span>
   </button>
   <figcaption>{inline(photo.caption)}</figcaption>
  </figure>
 );
 const sections=[
  {label:'The Challenge',content:overviewProse(story.problem)},
  {label:'My Approach',content:overviewProse(story.execution)},
  {label:'The Outcome',content:overviewProse(story.results)},
  {label:'The Tradeoff',content:<>
   <h4>Decisions and tradeoffs</h4>
   {overviewProse(story.decisions)}
   {story.decisionTradeoffs?.map((decision,index)=><div className="os-project-decision" key={index}><h4>{String(index+1).padStart(2,'0')} · {inline(decision.choice)}</h4>{overviewProse(decision.tradeoff)}</div>)}
   {story.lessons&&<section className="os-project-reflection"><h4>Reflection</h4>{overviewProse(story.lessons)}</section>}
  </>},
 ];
 return <article className="os-app os-editorial os-case-overview os-project-overview" data-project={story.id}>
  <div className="os-editorial-toolbar"><button className="os-text-action" onClick={()=>navigate('/side-projects')}>← Side Projects</button><span>{story.maturity}</span></div>
  <div className="os-editorial-paper">
   <header><h1>{story.title}</h1>{story.subject&&<p className="os-overview-subject">{story.subject}</p>}<p className="os-overview-meta">{[story.context,story.role,story.dates].filter(Boolean).join(' · ')}</p></header>
   <div className="os-overview-description">{overviewProse(story.summary)}{story.disclaimer&&<p>{inline(story.disclaimer)}</p>}</div>
   <div className="os-case-sidebar-layout">
    <section className="os-case-inset os-case-visual-column" aria-label="Project visuals">
     <h2 className="os-case-panel-title">Project Visuals</h2>
     {pocket&&(cover?renderVisual(cover):<PocketProjectGraphic title={story.menuLabel||story.title}/>)}
     {pocket&&gallery.length>0&&<details className="pocket-project-media"><summary>{cover?'More project visuals ›':'Project visuals ›'}</summary><div className="os-project-visuals">{gallery.map(renderVisual)}</div></details>}
     {!pocket&&<div className="os-project-visuals">{gallery.map(renderVisual)}</div>}
    </section>
    <div className="os-case-file-column">
     <CaseFile title="Project File" sections={sections} readingState={readingState} onReadingState={state=>setReadingStates(current=>({...current,[story.id]:state}))}/>
     <div className="os-overview-cta">{story.repositoryUrl&&<a className="os-button" href={story.repositoryUrl} target="_blank" rel="noopener noreferrer">GitHub ↗</a>}{story.liveUrl&&<a className="os-button" href={story.liveUrl} target="_blank" rel="noopener noreferrer">Visit site ↗</a>}{pocket&&<button className="os-button" onClick={()=>navigate('/contact')}>Talk Product</button>}</div>
    </div>
   </div>
  </div>
  <CaseNavigation story={story} siblings={siblings} navigate={navigate} showContact={!pocket}/>
  {image&&<DiagramViewer photo={image} close={()=>{setImage(null);requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));}}/>}
 </article>;
}
