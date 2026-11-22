import type {Story} from '../content/types';
import {storyLabel} from '../content/storyPresentation';
import {sourceRoute} from '../desktop/router';
import './caseNavigation.css';

const exampleHealthSite={label:'example.invalid',url:'https://example.invalid/insights/2022/best-in-class-point-solutions.html'};
const websites:Record<string,{label:string;url:string}>={
 'demo-platform':{label:'example.invalid',url:'https://example.invalid/'},
 'demo-health-psm':exampleHealthSite,'demo-health-platform-lifecycle':exampleHealthSite,'demo-health-measure-and-invest':exampleHealthSite,
 'demo-coaching':{label:'example.invalid',url:'https://example.invalid/'},
 'demo-data-field-quality':{label:'example.invalid',url:'https://example.invalid/solutions/audience-measurement/#audience-measurement'},
};
export function CaseNavigation({story,siblings,navigate,showContact=true}:{story:Story;siblings:Story[];navigate:(path:string)=>void;showContact?:boolean}){
 const index=siblings.findIndex(item=>item.id===story.id);
 const previous=index>0?siblings[index-1]:undefined,next=index>=0?siblings[index+1]:undefined;
 const website=websites[story.id];
 const target=(item:Story)=>sourceRoute(item.kind,item.slug)+(new URLSearchParams(window.location.search).get('view')==='full'?'?view=full':'');
 return <footer className={`os-case-footer ${showContact?'':'without-contact'}`}>
  <div className="os-case-website">{website&&<a className="os-button" href={website.url} target="_blank" rel="noopener noreferrer">{website.label} ↗</a>}</div>
  {showContact&&<button className="os-button os-case-contact" onClick={()=>navigate('/contact')}>Talk Product</button>}
  {index>=0&&<nav className="os-case-pagination" aria-label="Case navigation">
   <button className="os-button" disabled={!previous} aria-label={previous?`Previous case: ${storyLabel(previous)}`:'Previous case'} onClick={()=>previous&&navigate(target(previous))}>‹ Prev</button>
   <span className="os-case-counter" aria-label={`Case ${index+1} of ${siblings.length}`}>{String(index+1).padStart(2,'0')} / {String(siblings.length).padStart(2,'0')}</span>
   <button className="os-button" disabled={!next} aria-label={next?`Next case: ${storyLabel(next)}`:'Next case'} onClick={()=>next&&navigate(target(next))}>Next ›</button>
  </nav>}
 </footer>;
}
