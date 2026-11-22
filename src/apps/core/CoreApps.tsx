import {SideProjectCase} from '../../components/editorial/SideProjectCase';
import {usePocketMode} from '../../pocket/layout';
import {PocketPortfolio} from '../../pocket/PocketPortfolio';
import {portfolioCategory,filterPortfolio} from '../../content/portfolioCategories';
import { useEffect, useId, useRef, useState } from 'react';
import type { PhotoRecord, SiteContentView, Story } from '../../content/types';
import { CaseOverview, type OverviewReadingState } from '../../components/editorial/CaseOverview';
import { EditorialArticle } from '../../components/editorial/EditorialArticle';
import { CaseNavigation } from '../../components/CaseNavigation';
import {readFolderPreferences} from '../../components/folderPreferences';
import {orderedPortfolio,portfolioNavigation,portfolioOrganization} from '../../content/portfolioPresentation';
import { storyLabel, storyNarrativeTitle } from '../../content/storyPresentation';
import { FolderBrowser } from '../../components/FolderBrowser';
import { AppIcon } from '../../components/visual/AppIcon';
import { caseIconAssets } from '../../components/visual/CaseIcon';
import { CasePreviewNotice } from '../../components/CasePreviewNotice';
import { sourceRoute } from '../../desktop/router';
import aboutPortrait from './media/portrait-example.svg';
import './content-revision.css';

type Navigate = (path: string) => void;
export type BaseProps = { content: SiteContentView; navigate: Navigate; preview: boolean };
const cleared = (entry: {status: string; disclosureStatus: string}) => entry.status === 'published' && entry.disclosureStatus === 'cleared';
const visibleStories = (content: SiteContentView, preview: boolean) => content.stories.filter(story => story.status !== 'hidden' && story.disclosureStatus !== 'restricted' && (preview || content.reviewMode || cleared(story)));

function Status({ status, disclosureStatus }: { status: string; disclosureStatus: string }) {
  return cleared({status, disclosureStatus}) ? null : <span className="os-chip os-chip-review">Needs review</span>;
}
function StoryFigure({ photo }: { photo: PhotoRecord }) {
  return <figure className="os-case-figure" style={{margin:'1.5rem 0'}}><img src={photo.src} alt={photo.alt} style={{width:'100%',display:'block',maxHeight:360,objectFit:'contain'}} /><figcaption style={{fontSize:'.8rem',marginTop:8}}>{photo.caption}</figcaption></figure>;
}
export function StoryDetail({ story, navigate, preview, backRoute, photos = [], siblings=[], full=false }: { full?:boolean; siblings?: Story[]; story?: Story; navigate: Navigate; preview: boolean; backRoute: string; photos?: PhotoRecord[] }) {
  const [overviewStates,setOverviewStates]=useState<Record<string,OverviewReadingState>>({});
  if (!story) return <UnavailableApp navigate={navigate} />;
  if(story.kind==='side-project'&&!story.articleMarkdown)return <SideProjectCase story={story} photos={photos} siblings={siblings} navigate={navigate}/>;
  if(story.overview&&!full)return <CaseOverview story={story} siblings={siblings} navigate={navigate} readingState={overviewStates[story.id]||{selected:0,expanded:[0]}} onReadingState={state=>setOverviewStates(current=>({...current,[story.id]:state}))}/>;
  if (story.articleMarkdown) return <EditorialArticle key={story.id} story={story} photos={photos} siblings={siblings} navigate={navigate} backRoute={backRoute}/>;
  const media = (story.supportingMediaIds ?? []).flatMap(id => photos.filter(photo => photo.id === id && photo.status !== 'hidden' && photo.disclosureStatus !== 'restricted' && (preview || (cleared(photo) && photo.rightsCleared))));
  const decisions = story.decisions?.split('\n\n') ?? [];
  const highlights=story.highlights?.slice(0,3) ?? [];
  const [organization,contextDetail]=story.context.split(' · ',2);
  const sections = [['What it was',story.problem],['What I did',story.execution],['What happened',story.results]].filter((entry): entry is [string,string] => Boolean(entry[1]));
  return <article className="os-app os-case">
    <button className="os-text-action" onClick={() => navigate(backRoute)}>← {backRoute === '/side-projects' ? 'Side Projects' : 'Portfolio'}</button>
    <header className="os-case-lede"><CasePreviewNotice stage={story.caseStage}/><div className="os-eyebrow">{story.dates}</div><h1>{story.title}</h1><p className="os-lede">{story.summary}</p>
      <div className="os-case-meta"><span><b>Organization</b>{organization}</span><span><b>Role</b>{story.role}</span>{contextDetail&&<span><b>Context</b>{contextDetail}</span>}{story.maturity && <span><b>Stage</b>{story.maturity}</span>}{preview && <Status {...story} />}</div>
      {story.disclaimer && <p className="os-muted">{story.disclaimer}</p>}
      <div className="os-actions" aria-label="Story topics">{story.tags.map(tag=><span className="os-chip" key={tag}>{tag}</span>)}</div>
    </header>
    {media[0]?<StoryFigure photo={media[0]}/>:<div className="os-case-primary-visual" aria-label={`${organization} case study`}><span>{story.tags.slice(0,3).join(' / ')}</span><strong>{shortTitle(story)}</strong></div>}
    <div className="os-case-highlights">{highlights.map((text,i)=><div key={i}><span>{String(i+1).padStart(2,'0')}</span><strong>{text}</strong></div>)}</div>
    <div className="os-case-sections">
      {sections.map(([heading,body])=><section key={heading}><h2>{heading}</h2>{body.split('\n\n').map((paragraph,i)=><p key={i}>{paragraph}</p>)}</section>)}
      <section className="os-case-decisions"><h2>Decisions and tradeoffs</h2>{decisions.map((body,i)=><div className="os-case-decision" key={i}><div className="os-eyebrow">Decision {String(i+1).padStart(2,'0')}</div><p>{body}</p>{media[i+1] && <StoryFigure photo={media[i+1]!} />}</div>)}</section>

    </div>
    {story.lessons&&<section className="os-case-reflection"><h2>What I learned</h2><p>{story.lessons}</p></section>}
    <CaseNavigation story={story} siblings={siblings} navigate={navigate}/>
  </article>;
}
const shortTitle=storyLabel;
function Collection({ title, intro, stories, photos, navigate, portfolio=false }: { portfolio?:boolean; title: string; intro: string; stories: Story[]; photos:PhotoRecord[]; navigate: Navigate }) {
  const pocket=usePocketMode();
  const folder=<FolderBrowser preferenceKey={portfolio?'mendez-95-portfolio-folder':'mendez-95-side-project-folder'} numberByDisplayedOrder alphabeticalBy={portfolio?'company':'name'} className={portfolio?'os-portfolio-folder':'os-side-project-folder'} title={title} items={(portfolio?stories:[...stories].sort((a,b)=>a.displayOrder-b.displayOrder)).map(story=>({id:story.id,title:shortTitle(story),subject:portfolio?story.subject:undefined,year:story.dates,organization:portfolioOrganization(story.context),previewImage:portfolio&&story.id==='demo-health-psm'?story.overview?.artifact.src:undefined,secondary:portfolio&&story.featured?(story.id==='demo-health-psm'?'Start here':`Start here · ${storyNarrativeTitle(story)}`):undefined,image:caseIconAssets[story.id]||photos.find(photo=>photo.id===(story.tileMediaId||story.coverMediaId)&&cleared(photo)&&photo.rightsCleared)?.src,featured:story.featured,open:()=>navigate(sourceRoute(story.kind,story.slug))}))}/>;
  return pocket&&!portfolio?<section className="os-side-project-index"><header><h1>{title}</h1><p>{intro}</p></header>{folder}</section>:folder;
}
function PublicContext({content, navigate, side=false}: {content:SiteContentView; navigate:Navigate; side?:boolean}) {
  const clearedImages=content.photos.filter(photo=>cleared(photo)&&photo.rightsCleared);
  const relatedImages=clearedImages.filter(photo=>side?photo.projectHref?.startsWith('/side-projects'):photo.projectHref?.startsWith('/work'));
  const images=relatedImages.length?relatedImages:clearedImages;
  return <section className="os-app os-public-context"><h2>{side?'Ideas in practice':'The thinking behind the work'}</h2><div className="os-overview-grid">{images.map(photo=><figure className="os-card os-overview-card" key={photo.id}><img src={photo.src} alt={photo.alt}/><strong>{photo.title}</strong><figcaption>{photo.caption}</figcaption></figure>)}</div><div className="os-actions"><button className="os-button" onClick={()=>navigate('/about#how-i-build')}>How I Build</button><button className="os-button" onClick={()=>navigate('/field-notes')}>Field Notes</button></div></section>;
}
export function WorkApp({content,navigate,preview,slug,full}:BaseProps&{slug?:string;full?:boolean}) {
  const pocket=usePocketMode(),category=portfolioCategory(new URLSearchParams(location.search).get('category'));
  const review=preview||Boolean(content.reviewMode),stories=orderedPortfolio(visibleStories(content,review).filter(story=>story.kind!=='side-project'));
  const chosenSort=readFolderPreferences('mendez-95-portfolio-folder').sort;
  const shown=filterPortfolio(portfolioNavigation(stories,chosenSort),category);
  const workNavigate=(path:string)=>{const url=new URL(path,location.origin);if(url.pathname.startsWith('/work')&&!url.searchParams.has('category')&&category!=='all')url.searchParams.set('category',category);navigate(url.pathname+url.search+url.hash);};
  if(slug)return <StoryDetail key={slug} full={full} story={stories.find(story=>story.slug===slug)} navigate={workNavigate} preview={review} backRoute="/work" photos={content.photos} siblings={shown}/>;
  if(pocket)return <PocketPortfolio stories={shown} category={category} navigate={workNavigate}/>;
  return <><Collection portfolio photos={content.photos} title="Portfolio" intro="From healthcare platforms to AI products, field quality, and community athletics." stories={filterPortfolio(stories,category)} navigate={workNavigate}/>{!stories.length&&<PublicContext content={content} navigate={navigate}/>}</>;
}
export function AiLabApp(props:BaseProps&{slug?:string}) {return <WorkApp {...props}/>;}
export function SideProjectsApp({content,navigate,preview,slug}:BaseProps&{slug?:string}) {
  const pocket=usePocketMode();
  const review=preview||Boolean(content.reviewMode),stories=visibleStories(content,review).filter(story=>story.kind==='side-project');
  if(slug)return <StoryDetail story={stories.find(story=>story.slug===slug)} navigate={navigate} preview={review} backRoute="/side-projects" photos={content.photos} siblings={[...stories].sort((a,b)=>a.displayOrder-b.displayOrder)}/>;
  if(pocket)return <PocketPortfolio stories={[...stories].sort((a,b)=>a.displayOrder-b.displayOrder)} category="all" navigate={navigate} side/>;
  return <><Collection photos={content.photos} title="Side Projects" intro="Small products, real questions, and what it takes to build a useful answer." stories={stories} navigate={navigate}/>{!stories.length&&<PublicContext content={content} navigate={navigate} side/>}</>;
}
export function AboutApp({content,navigate,preview}:BaseProps) {
  const pocket=usePocketMode(),panelId=useId();
  const tabFromHash=():'about'|'journey'|'how'|'competencies'|'philosophies'=>window.location.hash==='#journey'?'journey':window.location.hash==='#how-i-build'?'how':window.location.hash==='#competencies'?'competencies':window.location.hash==='#philosophies'?'philosophies':'about';
  const [tab,setTab]=useState(tabFromHash);
  const [portraitPhoto,setPortraitPhoto]=useState(false);
  useEffect(()=>{const sync=()=>{const next=tabFromHash();setTab(next);requestAnimationFrame(()=>{const id=window.location.hash.slice(1);const section=id?document.getElementById(id):null;if(section instanceof HTMLDetailsElement)section.open=true;if(pocket)section?.scrollIntoView({block:'start'});});};window.addEventListener('hashchange',sync);window.addEventListener('popstate',sync);sync();return()=>{window.removeEventListener('hashchange',sync);window.removeEventListener('popstate',sync);};},[pocket]);
  const review=preview||Boolean(content.reviewMode),intro=content.about.journey.find(entry=>entry.id==='introduction');
  const tabs=[{id:'journey',label:'Journey',hash:'journey'},{id:'how',label:'How I Build',hash:'how-i-build'},{id:'competencies',label:'Core Competencies',hash:'competencies'},{id:'philosophies',label:'Philosophies',hash:'philosophies'}] as const;
  const desktopTabs=[{id:'about',label:'About',hash:''},...tabs] as const;
  const socialIds=['linkedin','medium','x'];
  const socials=content.elsewhere.filter(link=>socialIds.includes(link.id)&&link.url).sort((a,b)=>socialIds.indexOf(a.id)-socialIds.indexOf(b.id));
  const availableRoutes=new Set(['/field-notes',...visibleStories(content,review).map(story=>sourceRoute(story.kind,story.slug))]);
  const renderIntro=(body:string)=>body.split('\n\n').map((paragraph,index)=><p key={index}>{linkAboutText(paragraph,navigate,availableRoutes)}</p>);
  const invitation='If you’re hiring for platform, API, or integration products, send me a message.';
  const introBody=intro?.body||'';
  const hasInvitation=introBody.endsWith(invitation);
  const introduction=<div className="os-about-prose">{renderIntro(hasInvitation?introBody.slice(0,-invitation.length).trim():introBody)}{hasInvitation&&<aside className="os-about-hiring"><p>If you’re hiring for platform, API, or integration products, <button className="os-inline-link" onClick={()=>navigate('/contact')}>send me a message</button>.</p></aside>}</div>;
  const links=<div className="os-about-links"><div className="os-about-social-row" role="group" aria-label="About social links">{socials.map((link,index)=><span className="os-about-social-item" key={link.id}>{index>0&&<span className="os-about-social-separator" aria-hidden="true">·</span>}<a href={link.url} target="_blank" rel="noopener noreferrer">{link.id==='x'?'X':link.id==='medium'?'Medium':link.label}</a></span>)}</div><div className="os-about-resume-row"><button onClick={()=>navigate('/resume')}>Resume</button></div></div>;
  const portrait=pocket?<div className="pocket-portrait-shell"><div className="pocket-portrait-topline"><span>PLAYER PROFILE</span><span className="pocket-portrait-power" aria-hidden="true"/></div><button className="pocket-portrait-switch" aria-pressed={portraitPhoto} aria-label={portraitPhoto?'Show cartoon portrait of Jordan Example':'Show real photo of Jordan Example'} onClick={()=>setPortraitPhoto(current=>!current)}><img src={portraitPhoto?aboutPortrait:'/brand/pocket/portrait-example.svg'} alt={portraitPhoto?'Jordan Example wearing a navy blazer and white shirt':'Approved cartoon likeness of Jordan Example'} className={portraitPhoto?'is-photo':undefined}/></button><div className="pocket-portrait-caption"><strong aria-live="polite">{portraitPhoto?'PHOTO':'CARTOON'}</strong><span>{portraitPhoto?'Tap to see cartoon':'Tap to see photo'} ↻</span></div></div>:<div className="os-about-portrait"><img src={aboutPortrait} alt="Jordan Example wearing a navy blazer and white shirt"/></div>;
  const identity=<><div className="os-eyebrow">About Jordan</div><h1>Jordan Example</h1><p className="os-about-subtitle">{intro?.title||'Product · Technical Systems · London, MA'}</p></>;
  const section=(id:string)=>{
   const entries=id==='journey'?[...content.about.journey].filter(entry=>entry.id!=='introduction').sort((a,b)=>a.displayOrder-b.displayOrder):id==='competencies'?[...content.about.competencies].sort((a,b)=>a.displayOrder-b.displayOrder):content.about.principles.filter(entry=>entry.id!=='build-introduction'&&entry.id.startsWith(id==='how'?'build-':'philosophy-')).sort((a,b)=>a.displayOrder-b.displayOrder);
   const toolkit=content.about.principles.find(entry=>entry.id==='build-introduction');
   return <>{id==='how'&&toolkit&&<header className="os-about-toolkit-heading"><h2>{toolkit.label}</h2><p>{toolkit.body}</p></header>}<div className={`os-entry-list os-about-card-grid os-about-cards-${id} ${id==='how'?'os-tools-groups':''}`}>{entries.map((entry,entryIndex)=><article className="os-entry" data-entry-id={entry.id} key={entry.id}><div className="os-eyebrow">{'dates'in entry?entry.dates:''}</div><h2>{id==='how'&&<span className="os-toolkit-category" aria-hidden="true">{['⌘','▤','⇄','◇','✓','▥'][entryIndex]}</span>}{'title'in entry?entry.title:entry.label}</h2>{'tools'in entry&&entry.tools&&<p className="os-toolkit-labels">{entry.tools}</p>}<p>{entry.body}</p>{'areas'in entry&&entry.areas&&<ul>{entry.areas.map(area=><li key={area}>{area}</li>)}</ul>}{'referenceUrl'in entry&&entry.referenceUrl&&<a href={entry.referenceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${entry.id==='philosophy-demo-platform'?'Read about Example Method':`Read an example of ${'label'in entry?entry.label:'this principle'}`} — ${'referenceAuthor'in entry?entry.referenceAuthor:'reference article'}`}>{entry.id==='philosophy-demo-platform'?'Read about Example Method ↗':'Read an example ↗'}</a>}{'caseId'in entry&&entry.caseId&&('caseLabel'in entry)&&<div>{content.stories.some(s=>s.id===entry.caseId)?<button className="os-text-action" onClick={()=>navigate(sourceRoute(content.stories.find(s=>s.id===entry.caseId)!.kind,content.stories.find(s=>s.id===entry.caseId)!.slug))}>{entry.caseLabel}</button>:<span className="os-muted">{entry.caseLabel} Case study unavailable.</span>}</div>}</article>)}</div></>;
  };
  if(!pocket)return <div className="os-app os-about os-about-desktop"><aside className="os-about-sidebar">{portrait}{identity}{links}</aside><div className="os-about-reader">{<div className="os-about-tabs" role="tablist" aria-label="About sections">{desktopTabs.map((item,index)=><button key={item.id} role="tab" id={`${panelId}-${item.id}`} aria-controls={`${panelId}-panel`} aria-selected={tab===item.id} tabIndex={tab===item.id?0:-1} onClick={()=>setTab(item.id)} onKeyDown={event=>{const next=event.key==='ArrowRight'?(index+1)%desktopTabs.length:event.key==='ArrowLeft'?(index+desktopTabs.length-1)%desktopTabs.length:event.key==='Home'?0:event.key==='End'?desktopTabs.length-1:null;if(next===null)return;event.preventDefault();setTab(desktopTabs[next]!.id);event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();}}>{item.label}</button>)}</div>}<section className="os-about-reading-panel" id={`${panelId}-panel`} role="tabpanel" aria-labelledby={`${panelId}-${tab}`} tabIndex={0}>{tab==='about'?introduction:section(tab)}</section></div><footer className="os-about-status"><span>Mendez 95 · About</span><span>{desktopTabs.find(item=>item.id===tab)?.label}</span></footer></div>;
  return <div className="os-app os-about"><img className="pocket-about-art" src="/brand/pocket/landscape-example.svg" alt="Original pixel waterfront skyline at sunset"/><header className="os-about-intro">{portrait}<div className="os-about-copy">{identity}{introduction}{links}</div></header>{tabs.map(item=><details className="pocket-about-section" key={item.id} id={item.hash} open={item.id==='journey'||item.id===tab}><summary>{item.label}</summary>{section(item.id)}</details>)}</div>;
}

function linkAboutText(text:string,navigate:Navigate,availableRoutes:Set<string>) {
  const links:Record<string,string>={'Example Studio':'/work/demo-platform','Example Health':'/work/demo-health-psm','Point Solutions Management':'/work/demo-health-psm','Example Data':'/work/demo-data-field-quality','Example Coaching Athletics':'/work/demo-coaching','Field Notes':'/field-notes'};
  const pattern=new RegExp(`(${Object.keys(links).join('|')})`,'g');
  return text.split(pattern).map((part,index)=>links[part]&&availableRoutes.has(links[part]!)?<a className="os-inline-link" href={links[part]} onClick={event=>{event.preventDefault();navigate(links[part]!);}} key={`${part}-${index}`}>{part}</a>:part);
}

export { ResumeApp } from './ResumeApp';
export { ContactApp } from './ContactApp';

export {FieldNotesApp} from '../field-notes/FieldNotesApp';

export function GamesFolder({ navigate }: { navigate: Navigate }) {
  return <div className="os-app"><header className="os-app-heading"><div className="os-eyebrow">Off the clock</div><h1>Games</h1><p>Two small games, made for a short break. Play for a personal best or a place on the leaderboard.</p></header><div className="os-story-grid"><button className="os-card os-story-card" onClick={()=>navigate('/games/snake')}><strong>Snake</strong><span>Collect, turn, and avoid the wall and your trail.</span><span>Play →</span></button><button className="os-card os-story-card" onClick={()=>navigate('/games/bounce')}><strong>Bounce</strong><span>Keep the ball in play and clear the field.</span><span>Play →</span></button></div></div>;
}

export function UnavailableApp({ navigate }: { navigate: Navigate }) {
  return <div className="os-app os-empty"><h1>Page not found</h1><p>Explore the portfolio or return to the desktop.</p><button className="os-button" onClick={()=>navigate('/work')}>Portfolio →</button></div>;
}
