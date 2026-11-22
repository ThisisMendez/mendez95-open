import {usePocketMode} from './pocket/layout';
import {PocketBoot} from './pocket/PocketBoot';
import { BrandLogo } from './components/visual/BrandLogo';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { SiteContentView } from './content/types';
import { DesktopShell } from './desktop/DesktopShell';
import { useDesktop } from './desktop/useDesktop';
import { useAppearance } from './desktop/useAppearance';
import { readWelcomePreference, writeWelcomePreference } from './desktop/onboarding/preferences';
import { PowerOffScreen, SafeModeScreen } from './apps/system/SystemApps';

const EditorApp = lazy(() => import('./apps/editor/EditorApp'));
const MazeSaver = lazy(() => import('./apps/screensaver/MazeSaver'));
const emptyContent: SiteContentView = { stories: [], fieldNotes: [], photos: [], resume: null, about: { journey: [], principles: [], competencies: [] }, elsewhere: [] };
const bootKey = 'mendez-95-boot-seen';
function bootSeen(){try{return sessionStorage.getItem(bootKey)==='1';}catch{return false;}}
function markBootSeen(){try{sessionStorage.setItem(bootKey,'1');}catch{/* Session storage is optional. */}}
type SystemMode = 'normal'|'safe-transition'|'safe'|'off';
function Startup({ skip, reduceMotion, theme, pocket }: { skip: () => void; reduceMotion: boolean; theme:string;pocket:boolean }) {
  const skipRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { skipRef.current?.focus(); }, []);
  if(pocket)return <PocketBoot start={skip} reduceMotion={reduceMotion}/>;
  return <div className="os-boot" role="dialog" aria-modal="true" aria-label="Mendez 95 startup" onKeyDown={event=>{ if (event.key === 'Tab') { event.preventDefault(); skipRef.current?.focus(); } if (event.key === 'Escape') { event.stopPropagation(); skip(); } }}>
    <div className="os-boot-card"><BrandLogo symbol decorative className="os-flag-mark os-flag-large"/><div className="os-eyebrow">Starting your desktop</div><h1>{theme==='dark'?'Mendez OS':'Mendez 95'}</h1><p>Jordan Example · Product Manager</p><div className="os-boot-track"><span className={reduceMotion?'is-static':''} /></div><div className="os-boot-bottom"><span>{reduceMotion?'Ready':'Preparing your view…'}</span><button ref={skipRef} className="os-button" onClick={skip}>Skip startup</button></div></div>
  </div>;
}

export function App() {
  const desktop = useDesktop();
  const pocket=usePocketMode();
  useEffect(()=>{document.documentElement.dataset.layout=pocket?'pocket':'desktop';},[pocket]);
  const appearance = useAppearance();
  const editorRoute = window.location.pathname === '/editor';
  const [content, setContent] = useState<SiteContentView>(emptyContent);
  const [loading, setLoading] = useState(true);
  const [contentError, setContentError] = useState('');
  const [previewDenied, setPreviewDenied] = useState(false);
  const [localReview, setLocalReview] = useState<boolean|null>(null);
  const [boot, setBoot] = useState(() => !editorRoute && (pocket||window.location.pathname==='/') && (appearance.bootFrequency==='always' || (appearance.bootFrequency==='once' && !bootSeen())));
  const [showWelcome,setShowWelcomeState]=useState(readWelcomePreference);
  const setShowWelcome=(value:boolean)=>{setShowWelcomeState(value);writeWelcomePreference(value);};
  const [welcomeOpen, setWelcomeOpen] = useState(() => !pocket && !editorRoute && window.location.pathname==='/' && !boot && readWelcomePreference());
  const [tourActive,setTourActive]=useState(false);
  const [blockingDialog,setBlockingDialog]=useState(false);
  useEffect(()=>{let frame=0;const check=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>setBlockingDialog(Boolean(document.querySelector('dialog[open]'))));};const observer=new MutationObserver(check);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});check();return()=>{observer.disconnect();cancelAnimationFrame(frame);};},[]);
  const [systemMode, setSystemMode] = useState<SystemMode>('normal');
  const [screensaver, setScreensaver] = useState(false);
  const forceWelcome = useRef(false);

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/' || path === '/editor') return;
    let cancelled = false;
    void fetch(`/api/resolve-route?path=${encodeURIComponent(path)}`, { cache: 'no-store' })
      .then(response => response.ok ? response.json() as Promise<{ target: string | null }> : null)
      .then(result => { if (!cancelled && result?.target?.startsWith('/') && !result.target.startsWith('//')) window.location.replace(`${result.target}${window.location.search}`); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  useEffect(()=>{ if(editorRoute){setLocalReview(false);return;} let cancelled=false;void fetch('/api/review-session',{cache:'no-store',credentials:'same-origin'}).then(r=>r.ok?r.json() as Promise<{localReview?:boolean}>:null).then(value=>{if(!cancelled)setLocalReview(value?.localReview===true);}).catch(()=>{if(!cancelled)setLocalReview(false);});return()=>{cancelled=true;};},[editorRoute]);
  useEffect(() => {
    if (!boot || (pocket && appearance.reduceMotion)) return;
    const timer = window.setTimeout(() => { setBoot(false); markBootSeen(); if(!pocket && (forceWelcome.current || (window.location.pathname==='/'&&readWelcomePreference())))setWelcomeOpen(true);forceWelcome.current=false; }, pocket ? (appearance.reduceMotion ? 0 : 2200) : appearance.reduceMotion ? 250 : 2600);
    return () => window.clearTimeout(timer);
  }, [boot, appearance.reduceMotion, pocket]);
  useEffect(() => {
    if (editorRoute || localReview===null) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true); setContentError(''); setPreviewDenied(false);
      try {
        const endpoint = desktop.preview ? '/api/content?preview=1' : localReview && !desktop.publicMode ? '/api/content?review=1' : '/api/content';
        let response = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' });
        if (response.status === 401 && desktop.preview) {
          if (!cancelled) setPreviewDenied(true);
          response = await fetch(localReview && !desktop.publicMode ? '/api/content?review=1' : '/api/content', { credentials:'same-origin', cache:'no-store' });
        }
        if (!response.ok) throw new Error(`Content unavailable (${response.status}).`);
        if (!cancelled) setContent(await response.json() as SiteContentView);
      } catch (error) { if (!cancelled) setContentError(String(error)); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [desktop.preview, desktop.publicMode, editorRoute, localReview]);

  const closeScreensaver=useCallback(()=>setScreensaver(false),[]);
  useEffect(()=>{
    if(pocket||editorRoute||boot||welcomeOpen||tourActive||screensaver||systemMode!=='normal'||appearance.screensaverMinutes===0)return;
    let timer=0;let lastMove=0;
    const arm=()=>{clearTimeout(timer);timer=window.setTimeout(()=>setScreensaver(true),appearance.screensaverMinutes*60000);};
    const activity=(event:Event)=>{if(event.type==='pointermove'){const now=Date.now();if(now-lastMove<1000)return;lastMove=now;}arm();};
    arm(); for(const name of ['pointermove','pointerdown','keydown','touchstart','scroll'])window.addEventListener(name,activity,{passive:true});
    return()=>{clearTimeout(timer);for(const name of ['pointermove','pointerdown','keydown','touchstart','scroll'])window.removeEventListener(name,activity);};
  },[appearance.screensaverMinutes,boot,editorRoute,screensaver,systemMode,welcomeOpen,tourActive,pocket]);
  useEffect(()=>{if(pocket){setScreensaver(false);setWelcomeOpen(false);}},[pocket]);
  useEffect(()=>{window.dispatchEvent(new CustomEvent('mendez-active-route',{detail:{path:desktop.route,blocked:boot||screensaver||systemMode!=='normal'||tourActive||blockingDialog}}));},[desktop.route,boot,screensaver,systemMode,welcomeOpen,tourActive,blockingDialog,pocket]);
  const finishBoot=()=>{setBoot(false);markBootSeen();setWelcomeOpen(!pocket&&(forceWelcome.current||readWelcomePreference()));forceWelcome.current=false;};
  const replayBoot=()=>{desktop.showDesktop();setScreensaver(false);setSystemMode('normal');setWelcomeOpen(false);forceWelcome.current=true;setBoot(true);};
  const safeMode=()=>{desktop.showDesktop();setScreensaver(false);setWelcomeOpen(false);setSystemMode('safe-transition');window.setTimeout(()=>setSystemMode('safe'),appearance.reduceMotion?0:650);};
  const powerOff=()=>{desktop.showDesktop();setScreensaver(false);setWelcomeOpen(false);setSystemMode('off');};
  if (editorRoute) return <Suspense fallback={<div className="os-editor-loading">Opening editor…</div>}><EditorApp /></Suspense>;
  const reviewVisible=!desktop.publicMode&&((desktop.preview&&!previewDenied)||localReview===true);
  return <>
    {loading && <div className="os-content-loading" role="status">Loading portfolio content…</div>}
    {contentError && <div className="os-content-error" role="alert">{contentError} <button onClick={()=>window.location.reload()}>Retry</button></div>}
    {previewDenied && !localReview && <div className="os-preview-denied" role="status">This view is unavailable.</div>}
    <div inert={boot||screensaver||systemMode!=='normal'} aria-hidden={boot||screensaver||systemMode!=='normal'}><DesktopShell pocket={pocket} systemBlocked={boot||screensaver||systemMode!=='normal'} {...desktop} {...appearance} preview={reviewVisible} content={content} replayBoot={replayBoot} safeMode={safeMode} powerOff={powerOff} startScreensaver={()=>{if(!pocket)setScreensaver(true);}} welcomeOpen={!pocket&&welcomeOpen} closeWelcome={()=>setWelcomeOpen(false)} openWelcome={()=>{if(!pocket)setWelcomeOpen(true);}} showWelcome={showWelcome} setShowWelcome={setShowWelcome} onTourActiveChange={setTourActive} /></div>
    {boot && <Startup skip={finishBoot} reduceMotion={appearance.reduceMotion} theme={appearance.theme} pocket={pocket} />}
    {systemMode==='safe-transition'&&<div className="os-safe-transition" role="status"><strong>M95_SIMULATED_RECOVERY</strong><span>A fictional system pause. Preparing Safe Mode…</span></div>}
    {systemMode==='safe'&&<SafeModeScreen content={content} preview={reviewVisible} restart={replayBoot}/>}
    {systemMode==='off'&&<PowerOffScreen restart={replayBoot} />}
    {screensaver&&<Suspense fallback={<div className="os-maze-loading" role="status">Opening maze…</div>}><MazeSaver exit={closeScreensaver} reducedMotion={appearance.reduceMotion}/></Suspense>}
  </>;
}
