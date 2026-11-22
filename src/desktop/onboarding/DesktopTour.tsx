import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {POCKET_BREAKPOINT} from '../../pocket/layout';
import { placeTourDialog, TOUR_STEPS, type TourRect } from './tourMachine';

export function DesktopTour({ step, back, next, skip, destination }: { step: number; back: () => void; next: () => void; skip: () => void; destination: (path: string) => void }) {
  const definition = TOUR_STEPS[step]!;
  const dialog = useRef<HTMLElement>(null);
  const [geometry, setGeometry] = useState<{ targets: TourRect[]; box: TourRect; viewport: { width: number; height: number } }>({ targets: [], box: { x: 10, y: 53, width: 350, height: 250 }, viewport: { width: innerWidth, height: innerHeight } });
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      const viewport = { width: innerWidth, height: innerHeight }, selectors = viewport.width < POCKET_BREAKPOINT ? definition.mobile : definition.desktop;
      const readTargets = (selectors: readonly string[]): TourRect[] => selectors.flatMap(selector => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element || !element.getClientRects().length || getComputedStyle(element).visibility === 'hidden') return [];
        const r = element.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return [];
        return [{ x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(innerWidth, r.right) - Math.max(0, r.x), height: Math.min(innerHeight, r.bottom) - Math.max(0, r.y) }];
      });
      let targets = readTargets(selectors);
      if (viewport.width < POCKET_BREAKPOINT && step === 2 && targets.length === 0) targets = readTargets(['#pocket-nav-home']);
      const size = dialog.current?.getBoundingClientRect() ?? { width: Math.min(350, innerWidth - 20), height: 250 };
      const nextGeometry = { targets, box: placeTourDialog(viewport, size, targets), viewport };
      setGeometry(previous => JSON.stringify(previous) === JSON.stringify(nextGeometry) ? previous : nextGeometry);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    if (dialog.current) observer.observe(dialog.current);
    for (const selector of [...definition.desktop, ...definition.mobile, '#pocket-nav-home', '.os-home-layout']) { const e = document.querySelector(selector); if (e) observer.observe(e); }
    measure(); window.addEventListener('resize', schedule); window.addEventListener('scroll', schedule, true);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true); };
  }, [definition, step]);
  useEffect(() => { dialog.current?.querySelector<HTMLButtonElement>('[data-tour-primary]')?.focus(); }, [step]);
  useEffect(() => {
    const focus = (event: FocusEvent) => { if (dialog.current && !dialog.current.contains(event.target as Node)) dialog.current.querySelector<HTMLButtonElement>('button')?.focus(); };
    document.addEventListener('focusin', focus);
    return () => document.removeEventListener('focusin', focus);
  }, []);
  const { box, targets, viewport } = geometry;
  return <div className="os-desktop-tour" data-tour-step={step + 1}>
    <svg className="os-tour-shade" aria-hidden="true" width="100%" height="100%" viewBox={`0 0 ${viewport.width} ${viewport.height}`}><defs><mask id="mendez-tour-mask"><rect width={viewport.width} height={viewport.height} fill="white"/>{targets.map((r, i) => <rect key={i} x={r.x - 4} y={r.y - 4} width={r.width + 8} height={r.height + 8} rx="3" fill="black"/>)}</mask></defs><rect width="100%" height="100%" fill="rgba(3,20,30,.58)" mask="url(#mendez-tour-mask)"/>{targets.map((r, i) => <rect key={i} data-tour-highlight x={r.x - 4} y={r.y - 4} width={r.width + 8} height={r.height + 8} rx="3" fill="none" stroke="#ffe58a" strokeWidth="2"/>)}</svg>
    <section ref={dialog} className="os-tour-dialog os-window is-active" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-description" style={{ left: box.x, top: box.y }} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); skip(); }
      if (event.key === 'Tab') { const items = [...dialog.current!.querySelectorAll<HTMLButtonElement>('button')]; const first = items[0], last = items.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
    }}>
      <div className="os-titlebar"><span>Mendez 95 Tour</span><span>{step + 1} of {TOUR_STEPS.length}</span></div>
      <div className="os-tour-body"><h2 id="tour-title">{definition.title}</h2><p id="tour-description">{definition.text}</p>{targets.length === 0 && <p className="os-tour-unanchored">This destination is available through the site navigation.</p>}
      <div className="os-tour-actions">{'destination' in definition && <button className="os-button os-tour-destination" onClick={() => destination(definition.destination)}>{definition.action}</button>}{step > 0 && <button className="os-button" onClick={back}>Back</button>}<button className="os-button" data-tour-primary onClick={next}>{step === TOUR_STEPS.length - 1 ? 'Finish tour' : 'Next'}</button><button className="os-button os-tour-skip" onClick={skip}>Skip tour</button></div></div>
    </section>
  </div>;
}
