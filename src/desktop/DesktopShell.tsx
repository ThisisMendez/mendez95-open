import {useManagedSurface,useWindowManager,WindowControls} from './ManagedWindows';
import {DesktopCompanion} from '../apps/guide/DesktopCompanion';
import {SnipGreetings} from '../apps/guide/SnipGreetings';
import {PocketHeader,PocketHome,PocketDock} from '../pocket/PocketChrome';
import { BrandLogo } from '../components/visual/BrandLogo';
import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import {portfolioNavigation} from '../content/portfolioPresentation';
import {readFolderPreferences} from '../components/folderPreferences';
import { storyLabel } from '../content/storyPresentation';
import type { SiteContentView } from '../content/types';
import { AppIcon } from '../components/visual/AppIcon';
import { CaseIcon } from '../components/visual/CaseIcon';
import { AppView, type AppViewProps } from '../apps/AppView';
import { DesktopWidgets } from '../apps/widgets/DesktopWidgets';
import { WelcomeWindow } from './onboarding/WelcomeWindow';
import { DesktopTour } from './onboarding/DesktopTour';
import { initialTourState, tourReducer } from './onboarding/tourMachine';
import { readTourProgress, writeTourProgress } from './onboarding/preferences';
import './onboarding/onboarding.css';
import { appById, availableApps } from './registry';
import { resolveRoute, sourceRoute } from './router';
import { restoreLauncherFocus } from './focus';
import type { WindowRecord } from './useDesktop';

type ShellProps = Omit<AppViewProps, 'route'> & {
  onboardingReturn?: {appId:string;back:()=>void};
  route:string; pocket:boolean; systemBlocked:boolean;
  windows: WindowRecord[]; activeKey:string|null;
  focusWindow:(key:string)=>void; closeWindow:(key:string)=>void; showDesktop:()=>void;
  urlFor:(path:string)=>string; welcomeOpen:boolean; closeWelcome:()=>void; openWelcome:()=>void;
  showWelcome:boolean; setShowWelcome:(value:boolean)=>void; onTourActiveChange:(active:boolean)=>void;
};
type Nav=(path:string)=>void;
function NavLink({path,label,navigate,urlFor,className,children,id}:{path:string;label:string;navigate:Nav;urlFor:(path:string)=>string;className?:string;children?:React.ReactNode;id?:string}) {
  return <a id={id} href={urlFor(path)} className={className} onClick={event=>{event.preventDefault();navigate(path);}} aria-label={label} draggable={false}>{children??label}</a>;
}
function playChime() {
  try { const context=new AudioContext(); const oscillator=context.createOscillator(); const volume=context.createGain(); oscillator.type='sine'; oscillator.frequency.setValueAtTime(523.25,context.currentTime); oscillator.frequency.exponentialRampToValueAtTime(783.99,context.currentTime+.13); volume.gain.setValueAtTime(.035,context.currentTime); volume.gain.exponentialRampToValueAtTime(.001,context.currentTime+.18); oscillator.connect(volume).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime+.19); oscillator.onended=()=>void context.close(); } catch { /* audio unsupported */ }
}
const caseRoute=(story:SiteContentView['stories'][number])=>sourceRoute(story.kind,story.slug);
function TopBar({props,openStart,setOpenStart}:{props:ShellProps;openStart:boolean;setOpenStart:(v:boolean)=>void}) {
  const [menu,setMenu]=useState<string|null>(null);
  const navRef=useRef<HTMLElement>(null);
  const navigate=(path:string)=>{setMenu(null);setOpenStart(false);props.navigate(path);if(props.soundOn)playChime();};
  useEffect(()=>{if(menu)requestAnimationFrame(()=>navRef.current?.querySelector<HTMLButtonElement>('.os-top-menu-trigger[aria-expanded="true"] + .os-menu-popover button')?.focus());},[menu]);
  useEffect(()=>{const down=(e:PointerEvent)=>{if(!navRef.current?.contains(e.target as Node))setMenu(null);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){const trigger=navRef.current?.querySelector<HTMLButtonElement>('.os-top-menu-trigger[aria-expanded="true"]');setMenu(null);trigger?.focus();}};window.addEventListener('pointerdown',down);window.addEventListener('keydown',key);return()=>{window.removeEventListener('pointerdown',down);window.removeEventListener('keydown',key);};},[]);
  const caseStories=portfolioNavigation(props.content.stories.filter(story=>story.kind!=='side-project'&&story.status!=='hidden'&&story.disclosureStatus!=='restricted'&&(story.kind==='case-study'||story.kind==='career-story')),readFolderPreferences('mendez-95-portfolio-folder').sort);
  const dropdown=(name:string,items:{label:string;action:()=>void;caseId?:string}[])=> <div className="os-top-menu" key={name}><button className="os-top-menu-trigger" aria-expanded={menu===name} aria-haspopup="menu" onClick={()=>setMenu(menu===name?null:name)}>{name}<span aria-hidden="true">▾</span></button>{menu===name&&<div className="os-menu-popover" role="menu">{items.map(item=><button key={item.label} role="menuitem" onClick={()=>{setMenu(null);item.action();}}>{item.caseId&&<CaseIcon caseId={item.caseId} size={18}/>}{item.label}</button>)}</div>}</div>;
  const system=[
    {label:'About Mendez 95',action:()=>navigate('/system-about')},
    {label:'System Update',action:()=>navigate('/system-update')},
    {label:'Settings',action:()=>navigate('/settings')},
    {label:'Show Desktop',action:()=>{setMenu(null);props.showDesktop();}},
    {label:'Screensaver',action:()=>{setMenu(null);props.startScreensaver();}},
    {label:'Restart',action:()=>{setMenu(null);props.replayBoot();}},
    {label:'Restart in Safe Mode',action:()=>{setMenu(null);props.safeMode();}},
    {label:'Shut Down',action:()=>navigate('/shutdown')},
  ];
  const portfolio=[{label:'Open Portfolio',action:()=>navigate('/work')},...caseStories.map((story,i)=>({caseId:story.id,label:`${String(i+1).padStart(2,'0')} · ${storyLabel(story)} · ${story.dates?.match(/(?:19|20)\d{2}/)?.[0]??''}`,action:()=>navigate(caseRoute(story))}))];
  return <header className="os-menubar" ref={navRef}>
    <button id="mobile-start-button" className="os-mobile-start" aria-expanded={openStart} onClick={()=>setOpenStart(!openStart)}><BrandLogo symbol decorative className="os-flag-mark os-flag-small"/>Start</button>
    <nav className="os-menu-links" aria-label="Top menu">
      {dropdown(props.theme==='dark'?'Mendez OS':'Mendez 95',system)}
      {dropdown('Portfolio',portfolio)}
      {dropdown('Games',[{label:'Open Games',action:()=>navigate('/games')},{label:'01 · Snake',action:()=>navigate('/games/snake')},{label:'02 · Bounce',action:()=>navigate('/games/bounce')},{label:'03 · Solitaire',action:()=>navigate('/games/solitaire')},{label:'04 · Minesweeper',action:()=>navigate('/games/minesweeper')}])}
      {dropdown('Accessories',[{label:'Photos',action:()=>navigate('/photos')},{label:'SNIP-E',action:()=>navigate('/guide')},{label:'Paint',action:()=>navigate('/paint')}])}
      <NavLink path="/board" label="Chatroom 95" navigate={navigate} urlFor={props.urlFor}>Chatroom 95</NavLink>
      <NavLink path="/about" label="About Jordan" navigate={navigate} urlFor={props.urlFor}>About</NavLink>
      <NavLink path="/contact" label="Contact" navigate={navigate} urlFor={props.urlFor}>Contact</NavLink>
    </nav>
    <div className="os-menu-tools"><button aria-label="Change appearance" title="Change appearance" onClick={()=>props.setTheme(props.theme==='retro'?'dark':props.theme==='dark'?'light':'retro')}>◐ <span>{props.theme==='retro'?'Teal 95':props.theme==='dark'?'Noir Grid':'Monochrome'}</span></button><button aria-label={props.soundOn?'Mute system sound':'Enable system sound'} title="System sound" onClick={()=>{props.setSoundOn(!props.soundOn);if(!props.soundOn)playChime();}}>{props.soundOn?'♪':'♫̸'}</button><button aria-label="Find" title="Find" onClick={()=>navigate('/find')}>⌕</button></div>
    {props.preview&&<span className="os-preview-indicator">Local review · Needs review</span>}
  </header>;
}

const startRows=[
  {name:'Programs',children:[['Games','/games'],['Photos','/photos'],['SNIP-E','/guide'],['Paint','/paint'],['Chatroom 95','/board']]},
  {name:'Documents',children:[['Resume','/resume'],['Portfolio','/work'],['Field Notes','/field-notes'],['How I Build','/about#how-i-build'],['Core Competencies','/about#competencies']]},
  {name:'Settings',path:'/settings'},
  {name:'Find',children:[['Search Mendez 95','/find'],['How to Navigate','/help']]},
  {name:'Help',path:'/help'},
  {name:'Run',path:'/run'},
  {name:'Shut Down…',children:[['Restart','restart'],['Restart in Safe Mode','safe'],['Shut Down','off']]},
] as const;
function StartMenu({props,open,setOpen,mobile=false}:{props:ShellProps;open:boolean;setOpen:(v:boolean)=>void;mobile?:boolean}) {
  const [branch,setBranch]=useState<string|null>(null);const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!open){setBranch(null);return;}requestAnimationFrame(()=>ref.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]')?.focus());const down=(e:PointerEvent)=>{if(!ref.current?.contains(e.target as Node)&&!(e.target as Element).closest?.('.os-start-toggle,.os-mobile-start'))setOpen(false);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);setBranch(null);requestAnimationFrame(()=>{const button=(document.getElementById('mobile-start-button')?.getClientRects().length?document.getElementById('mobile-start-button'):document.getElementById('start-button'));button?.focus();});}};window.addEventListener('pointerdown',down);window.addEventListener('keydown',key);return()=>{window.removeEventListener('pointerdown',down);window.removeEventListener('keydown',key);};},[open,setOpen]);
  if(!open)return null;
  const action=(path:string)=>{setOpen(false);setBranch(null);if(path==='restart')props.replayBoot();else if(path==='safe')props.safeMode();else if(path==='off')props.powerOff();else props.navigate(path);};
  return <div className={`os-start-menu ${mobile?'is-mobile':''}`} ref={ref} role="menu" aria-label="Start menu" onKeyDown={event=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;const items=[...(ref.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')??[])];if(!items.length)return;event.preventDefault();const index=items.indexOf(document.activeElement as HTMLButtonElement);const next=event.key==='Home'?0:event.key==='End'?items.length-1:event.key==='ArrowDown'?(index+1)%items.length:(index<=0?items.length-1:index-1);items[next]?.focus();}}><div className="os-start-side">MENDEZ <b>95</b></div><div className="os-start-rows">{startRows.map((row,i)=><div className={`os-start-entry ${i===6?'is-separated':''}`} key={row.name}><button role="menuitem" aria-haspopup={'children'in row?'menu':undefined} aria-expanded={'children'in row?branch===row.name:undefined} onClick={()=>{'path'in row?action(row.path):setBranch(branch===row.name?null:row.name);}}><AppIcon name={row.name==='Programs'?'programs':row.name==='Documents'?'documents':row.name==='Shut Down…'?'shutdown':row.name.toLowerCase()} size={21}/><span>{row.name}</span>{'children'in row&&<b aria-hidden="true">▸</b>}</button>{'children'in row&&branch===row.name&&<div className="os-start-submenu" role="menu" aria-label={row.name}>{row.children.map(([label,path])=><button key={label} role="menuitem" onClick={()=>action(path)}><AppIcon name={path==='/games'?'games':path==='/photos'?'photos':path==='/guide'?'guide':path==='/paint'?'paint':path==='/board'?'board':path==='/resume'?'resume':path==='/work'?'work':path==='/field-notes'?'field-notes':path.startsWith('/about')?'about':path==='/find'?'find':path==='/help'?'help':path==='restart'?'restart':path==='safe'?'settings':'shutdown'} size={18}/>{label}</button>)}</div>}</div>)}</div></div>;
}
function Taskbar({props,openStart,setOpenStart}:{props:ShellProps;openStart:boolean;setOpenStart:(v:boolean)=>void}) {
  const [now,setNow]=useState(()=>new Date());useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(timer);},[]);
  const manager=useWindowManager();
  return <footer className="os-taskbar"><button id="start-button" className="os-start-toggle" aria-expanded={openStart} onClick={()=>setOpenStart(!openStart)}><BrandLogo symbol decorative className="os-flag-mark os-flag-small"/>Start</button><div className="os-taskbar-windows" aria-label="Open windows">{manager.surfaces.map(surface=><button key={surface.id} data-task-window={surface.id} aria-label={`${surface.minimized?'Restore':'Focus'} ${surface.title}`} className={surface.id===manager.active&&!surface.minimized?'is-active':''} onClick={()=>manager.restore(surface.id)}><span>{surface.title}</span></button>)}</div><button className="os-task-sound" aria-label={props.soundOn?'Mute sound':'Enable sound'} onClick={()=>{props.setSoundOn(!props.soundOn);if(!props.soundOn)playChime();}}>{props.soundOn?'♪':'♫̸'}</button><time className="os-task-clock" dateTime={now.toISOString()}>{new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit',hour12:!props.clock24}).format(now)}</time></footer>;

}
function DesktopHome({props}:{props:ShellProps}) {
  return <main className="os-home-layout">
    {!props.pocket&&<nav key="icons" className="os-icon-grid" aria-label="Desktop applications">{availableApps().filter(app=>app.desktop).map(app=><NavLink key={app.id} id={`launcher-${app.id}`} path={app.route} label={`Open ${app.label}`} navigate={props.navigate} urlFor={props.urlFor} className="os-icon"><span className="os-icon-art"><AppIcon name={app.icon}/></span><span>{app.id==='board'?'Chatroom 95':app.label}</span>{app.id==='work'&&<b className="os-icon-new">NEW</b>}</NavLink>)}</nav>}
    {!props.pocket&&<section key="brand" className="os-desktop-brand" aria-label="Mendez 95 desktop"><div className="os-wallpaper-center"><BrandLogo className="os-desktop-logo"/></div><footer className="os-desktop-footer">Jordan Example | Product at Example Studio</footer></section>}
    <aside key="widgets" className="os-widget-column" aria-label={props.pocket?'Pocket utilities':'Desktop widgets'}><DesktopWidgets units={props.units} clock24={props.clock24} visible={props.widgetsVisible} pocket={props.pocket} route={props.route} navigate={props.navigate} stopAudio={props.systemBlocked} closeUtility={id=>props.closeWindow('/'+id)}/></aside>
  </main>;
}
function AppWindow({record,active,index,props}:{record:WindowRecord;active:boolean;index:number;props:ShellProps}) {
  const dialogRef=useRef<HTMLElement>(null);const route=resolveRoute(record.path);const app=appById(record.appId);
  const scrolls=useRef(new Map<string,number>()),lastSlug=useRef(route.slug);
  const scrollMode=`${route.slug||''}:${route.view==='full'?'full':'overview'}`;
  useLayoutEffect(()=>{const body=dialogRef.current?.querySelector<HTMLElement>('.os-window-body');const newCase=lastSlug.current!==route.slug;lastSlug.current=route.slug;if(body)body.scrollTop=newCase&&route.slug&&record.transition!=='history'?0:scrolls.current.get(scrollMode)||0;},[scrollMode,record.transition,route.slug]);
  const story=route.slug?props.content.stories.find(item=>item.slug===route.slug):undefined;
  const utility=['weather','world-time','pocket-radio','visitor-log','signal'].includes(record.appId);
  const title=story?.title??(record.appId==='board'?'Chatroom 95':props.pocket&&record.appId==='guide'?'PIP':undefined)??(record.appId==='about'?'About Jordan':record.appId==='games'&&route.slug?route.slug[0]!.toUpperCase()+route.slug.slice(1):app?.label??'Mendez 95');
  const frame=useManagedSurface({id:record.key,title,open:!utility,ref:dialogRef,onRestore:()=>props.focusWindow(record.key),onClose:()=>{props.closeWindow(record.key);restoreLauncherFocus(record.appId);},escape:!['games','board'].includes(record.appId)});
  useLayoutEffect(()=>{if(!utility&&props.activeKey===record.key)frame.focus();},[record.z,props.activeKey,utility]);
  active=props.pocket?active:frame.active;
  useLayoutEffect(()=>{if(active)dialogRef.current?.focus({preventScroll:true});},[active,record.key]);
  const close=()=>{props.closeWindow(record.key);restoreLauncherFocus(record.appId);};
  if(utility)return null;
  return <section ref={dialogRef} inert={props.pocket?!active:frame.minimized} aria-hidden={props.pocket?!active:frame.minimized} data-managed="app" data-window-key={record.key} data-minimized={!props.pocket&&frame.minimized} role="dialog" aria-modal="false" aria-label={title} tabIndex={-1} className={`os-window ${active?'is-active':''} ${route.slug&&record.appId!=='field-notes'?'os-window-detail':''}`} data-app={record.appId} data-window-mode={['work','side-projects'].includes(record.appId)?!route.slug?'catalog':route.view==='full'?'full':'overview':undefined} data-case-view={story?.overview?(route.view==='full'?'full':'overview'):undefined} data-game={record.appId==='games'?route.slug:undefined} data-active={String(active)} style={{...(!props.pocket?frame.style:{}),'--os-window-offset':`${Math.min(index,3)*14}px`} as React.CSSProperties} onPointerDown={()=>{if(!active){frame.focus();props.focusWindow(record.key);}}}>
    <div className="os-titlebar" {...frame.titlebar}><span className="os-window-title"><CaseIcon caseId={story?.id} fallback={app?.icon??'work'} size={17}/>{title}</span><WindowControls title={title} minimize={frame.minimize} close={close}/></div>
    <div className="os-window-body" onScroll={event=>scrolls.current.set(scrollMode,event.currentTarget.scrollTop)}>{active&&props.onboardingReturn?.appId===record.appId&&<div className="os-onboarding-return"><button onClick={props.onboardingReturn.back}>‹ Back to Getting started</button></div>}<AppView {...props} route={route}/></div>
  </section>;
}
export function DesktopShell(props:ShellProps) {
  const manager=useWindowManager();
  const priorRoute=useRef(props.route);
  useEffect(()=>{if(props.route==='/'&&priorRoute.current!=='/'&&!props.pocket)manager.dispatch({type:'desktop'});priorRoute.current=props.route;},[props.route,props.pocket]);
  useEffect(()=>{if(props.pocket){for(const surface of manager.surfaces)if(surface.id===props.activeKey)manager.dispatch({type:'focus',id:surface.id});}},[props.pocket,props.activeKey]);
  const [openStart,setOpenStart]=useState(false);
  const [tour,dispatchTour]=useReducer(tourReducer,undefined,()=>initialTourState(readTourProgress()));
  const [notice,setNotice]=useState('');
  const childOrigin=useRef<'updates'|'tour'|null>(null);
  const childApp=useRef<string|null>(null);
  const previousFocus=useRef<HTMLElement|null>(null), welcomeFocus=useRef<HTMLElement|null>(null);
  const touring=!props.pocket&&tour.phase==='running';
  // Suspend an active desktop tour without changing completion or its saved step.
  useEffect(()=>{if(props.pocket&&tour.phase==='running')dispatchTour({type:'SUSPEND'});},[props.pocket,tour.phase]);
  useEffect(()=>{if(!props.pocket&&childApp.current&&!props.windows.some(w=>w.appId===childApp.current)){childOrigin.current=null;childApp.current=null;props.openWelcome();}},[props.windows,props.openWelcome]);
  const restoreFocus=(target:HTMLElement|null)=>requestAnimationFrame(()=>{
    if(target?.isConnected && target.getClientRects().length && !target.closest('[inert]'))target.focus({preventScroll:true});
    else if(props.activeKey){const section=document.querySelector<HTMLElement>('.os-window.is-active');section?.focus({preventScroll:true});}
    else restoreLauncherFocus('work');
  });
  useEffect(()=>{props.onTourActiveChange(touring);return()=>props.onTourActiveChange(false);},[touring,props.onTourActiveChange]);
  useEffect(()=>{if(!props.pocket)writeTourProgress({version:1,completed:tour.completed,resumeStep:tour.resumeStep});},[tour.completed,tour.resumeStep,props.pocket]);
  const openWelcome=()=>{welcomeFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setNotice('');props.openWelcome();};
  const closeWelcome=()=>{props.closeWelcome();setNotice('');restoreFocus(welcomeFocus.current);};
  const startTour=(resume=false)=>{
    if(props.pocket)return;
    if(document.querySelector('dialog[open], .os-shell-interactive [aria-modal="true"]')){setNotice('Close the open dialog before starting the tour. Your work is still here.');return;}
    if(props.welcomeOpen)childOrigin.current='tour';
    previousFocus.current=props.welcomeOpen?welcomeFocus.current:document.activeElement instanceof HTMLElement?document.activeElement:null;
    setOpenStart(false);props.closeWelcome();setNotice('');dispatchTour({type:resume?'RESUME':'START'});
  };
  const returnFromTour=()=>{if(childOrigin.current==='tour'){childOrigin.current=null;childApp.current=null;props.openWelcome();}else restoreFocus(previousFocus.current);};
  const endTour=()=>{dispatchTour({type:'SKIP'});returnFromTour();};
  const next=()=>{if(tour.step===4)returnFromTour();dispatchTour({type:'NEXT'});};
  const destination=(path:string)=>{if(childOrigin.current==='tour')childApp.current=resolveRoute(path).appId;dispatchTour({type:'DESTINATION'});props.navigate(path);};
  const returnToWelcome=()=>{const child=props.windows.find(w=>w.appId===childApp.current);childOrigin.current=null;childApp.current=null;if(child)props.closeWindow(child.key);props.openWelcome();};
  const integratedProps:ShellProps={...props,showDesktop:()=>{manager.dispatch({type:'desktop'});props.showDesktop();},onboardingReturn:!props.pocket&&childApp.current?{appId:childApp.current,back:returnToWelcome}:undefined,onboarding:props.pocket?undefined:{openWelcome,startTour:()=>startTour(),resumeTour:()=>startTour(true),resumable:tour.resumeStep!==null,notice}};
  return <div className={props.pocket?'os-root pocket-shell':'os-root os-desktop'}>
    <div className={`os-shell-interactive ${touring?'is-touring':''}`} inert={touring} aria-hidden={touring}>
    {props.pocket?<PocketHeader route={props.route} navigate={props.navigate} preview={props.preview}/>:<TopBar props={integratedProps} openStart={openStart} setOpenStart={setOpenStart}/>}
    {props.pocket&&!resolveRoute(props.route).appId&&<PocketHome navigate={props.navigate}/>}
    <DesktopHome props={integratedProps}/>
    <div className="os-window-layer" aria-live="off">{[...props.windows].sort((a,b)=>a.z-b.z).map((record,index)=><AppWindow key={record.key} record={record} index={index} active={!touring&&props.activeKey===record.key} props={integratedProps}/>)}</div>
    {!props.pocket&&<><StartMenu props={integratedProps} open={openStart} setOpen={setOpenStart} mobile={false}/><Taskbar props={integratedProps} openStart={openStart} setOpenStart={setOpenStart}/></>}
    {props.pocket&&<PocketDock route={props.route} navigate={props.navigate}/>}
    {!props.pocket&&<DesktopCompanion navigate={props.navigate} blocked={touring||props.systemBlocked||openStart}/>}
    <SnipGreetings windows={props.windows} content={props.content} blocked={touring||props.systemBlocked}/>
    </div>
    {!props.pocket&&props.welcomeOpen&&<WelcomeWindow mobileReady close={closeWelcome} showWelcome={props.showWelcome} setShowWelcome={props.setShowWelcome} startTour={()=>startTour()} whatsNew={()=>{childOrigin.current='updates';childApp.current='system-update';props.closeWelcome();props.navigate('/system-update');}} notice={notice}/>}
    {touring&&<DesktopTour step={tour.step} back={()=>dispatchTour({type:'BACK'})} next={next} skip={endTour} destination={destination}/>}
  </div>;
}
