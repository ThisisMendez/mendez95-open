import {useManagedSurface,WindowControls} from '../ManagedWindows';
import { useEffect, useRef, useState } from 'react';
import { WELCOME_TIPS, nextTipIndex } from './preferences';
import {VideoPreview, portfolioTour} from '../../components/VideoPreview';

export function WelcomeWindow({ close, showWelcome, setShowWelcome, startTour, whatsNew, notice, mobileReady = false }: {
  close: () => void; showWelcome: boolean; setShowWelcome: (value: boolean) => void;
  startTour: () => void; whatsNew: () => void; notice: string; mobileReady?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLElement>(null), next = useRef<HTMLButtonElement>(null);
  const frame=useManagedSurface({id:'welcome',title:'Welcome',ref:dialog,onClose:close,onRestore:()=>dialog.current?.focus({preventScroll:true})});
  useEffect(() => { next.current?.focus(); }, []);
  return <section ref={dialog} className={`os-welcome-window os-window ${frame.active?'is-active':''}`} data-managed="welcome" data-minimized={frame.minimized} data-active={String(frame.active)} inert={frame.minimized} aria-hidden={frame.minimized} style={frame.style} tabIndex={-1} onPointerDown={frame.focus} role="dialog" aria-modal="false" aria-labelledby="welcome-heading" onKeyDown={event => {
    if (event.key === 'Escape' && !document.querySelector('dialog[open]')) { event.preventDefault(); event.stopPropagation(); close(); }
  }}>
    <div className="os-titlebar" {...frame.titlebar}><span className="os-window-title">Welcome</span><WindowControls title="Welcome" minimize={frame.minimize} close={close}/></div>
    <div className="os-welcome-body">
      <header className="os-welcome-intro"><div className="os-eyebrow">Mendez 95 / Getting started</div><h1 id="welcome-heading">Welcome to Mendez 95</h1><p className="os-welcome-subtitle">Jordan Example portfolio</p><p>Explore my work, ideas, and projects through a desktop built for discovery.</p></header>
      <div className="os-welcome-row"><div className="os-welcome-content"><div className="os-welcome-tip"><svg className="os-tip-icon" aria-hidden="true" viewBox="0 0 24 32" width="26" height="34" shapeRendering="crispEdges"><path fill="#12749b" d="M4 20h16v4h-4v4h-4v4H8v-4H4z"/><path fill="#fff" stroke="#18323d" d="M8 18h8v7H8z"/><path fill="#ffe24a" stroke="#18323d" d="M7 2h10v3h3v9h-3v4H7v-4H4V5h3z"/><path fill="#fffbd1" d="M8 4h3v7H8z"/><path fill="#18323d" d="M9 20h6v2H9z"/></svg><div><strong>Did you know...</strong><p role="status" aria-live="polite" aria-atomic="true">{WELCOME_TIPS[index % (mobileReady ? 4 : 3)]}</p></div></div><VideoPreview video={portfolioTour} label="Watch the 60-second tour" description="The product decisions behind the Windows 95 desktop and Game Boy Color Pocket experience."/></div>
      <div className="os-welcome-buttons"><button className="os-button" onClick={startTour}>Mendez 95 Tour</button><button className="os-button" onClick={whatsNew}>What’s New</button><button ref={next} className="os-button" onClick={() => setIndex(nextTipIndex(index, mobileReady ? 4 : 3))}>Next Tip</button><button className="os-button os-welcome-close" onClick={close}>Close</button></div></div>
      <label className="os-welcome-preference"><input type="checkbox" checked={showWelcome} onChange={event => setShowWelcome(event.target.checked)} />Show this welcome screen next time</label>
      {notice && <p className="os-onboarding-notice" role="status">{notice}</p>}
    </div>
  </section>;
}
