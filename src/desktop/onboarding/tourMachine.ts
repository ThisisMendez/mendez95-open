import type { TourProgress } from './preferences';

export const TOUR_STEPS = [
  { title: 'Welcome to Mendez 95', text: 'Jordan Example — Product · Technical Systems · London. Explore the work through a desktop built for discovery.', desktop: ['.os-desktop-logo'], mobile: ['.pocket-brand'] },
  { title: 'Explore the work', text: 'Start with Digital Health Platform, the featured Example Health case, then explore the decisions and systems behind the work.', desktop: ['#launcher-work'], mobile: ['#pocket-nav-portfolio'], destination: '/work', action: 'Open Portfolio' },
  { title: 'Get to know Jordan', text: 'Read the background, explore the career timeline, or request the full resume.', desktop: ['#launcher-about', '#launcher-resume'], mobile: ['#pocket-home-about', '#pocket-home-resume'], destination: '/resume', action: 'Open Resume' },
  { title: 'Continue the conversation', text: 'Get in touch about product opportunities, platform work, and thoughtful collaboration.', desktop: ['#launcher-contact'], mobile: ['#pocket-nav-contact'], destination: '/contact', action: 'Open Contact' },
  { title: 'Make yourself at home', text: 'Try a game, open Paint or Photos, and leave a note on the shared board.', desktop: ['#launcher-games', '#launcher-accessories', '#launcher-board'], mobile: ['#pocket-nav-tools'] },
] as const;
export type TourState = { phase: 'idle' | 'running'; step: number; completed: boolean; resumeStep: number | null };
export type TourAction = { type: 'START' | 'RESUME' | 'BACK' | 'NEXT' | 'SKIP' | 'DESTINATION' | 'SUSPEND' };
export const initialTourState = (progress: TourProgress): TourState => ({ phase: 'idle', step: 0, completed: progress.completed, resumeStep: progress.resumeStep });
export function tourReducer(state: TourState, action: TourAction): TourState {
  if (action.type === 'START') return { ...state, phase: 'running', step: 0, completed: false, resumeStep: null };
  if (action.type === 'RESUME') return { ...state, phase: 'running', step: state.resumeStep ?? 0, completed: false, resumeStep: null };
  if (state.phase !== 'running') return state;
  switch (action.type) {
    case 'BACK': return { ...state, step: Math.max(0, state.step - 1) };
    case 'NEXT': return state.step === TOUR_STEPS.length - 1 ? { ...state, phase: 'idle', completed: true, resumeStep: null } : { ...state, step: state.step + 1 };
    case 'SKIP': return { ...state, phase: 'idle', resumeStep: null };
    case 'SUSPEND': return { ...state, phase: 'idle', resumeStep: state.step };
    case 'DESTINATION': return 'destination' in TOUR_STEPS[state.step]! ? { ...state, phase: 'idle', resumeStep: Math.min(state.step + 1, TOUR_STEPS.length - 1) } : state;
  }
}
export type TourRect = { x: number; y: number; width: number; height: number };
export function placeTourDialog(viewport: { width: number; height: number }, size: { width: number; height: number }, targets: TourRect[]): TourRect {
  const margin = 10, top = 53, bottom = viewport.height - (viewport.width < 768 ? 75 : 50);
  const width = Math.min(size.width, viewport.width - margin * 2), height = Math.min(size.height, Math.max(80, bottom - top));
  const clamp = (x: number, low: number, high: number) => Math.max(low, Math.min(x, Math.max(low, high)));
  const xs = [margin, (viewport.width - width) / 2, viewport.width - width - margin];
  const ys = [top, (top + bottom - height) / 2, bottom - height];
  const candidates = targets.flatMap(t => [
    { x: t.x + (t.width - width) / 2, y: t.y + t.height + 14 },
    { x: t.x + (t.width - width) / 2, y: t.y - height - 14 },
    { x: t.x + t.width + 14, y: t.y + (t.height - height) / 2 },
    { x: t.x - width - 14, y: t.y + (t.height - height) / 2 },
  ]).concat(xs.flatMap(x => ys.map(y => ({ x, y }))));
  const scored = candidates.map(p => ({ x: clamp(p.x, margin, viewport.width - width - margin), y: clamp(p.y, top, bottom - height), width, height })).map(p => ({ p, overlap: targets.reduce((sum, t) => sum + Math.max(0, Math.min(p.x + width, t.x + t.width + 6) - Math.max(p.x, t.x - 6)) * Math.max(0, Math.min(p.y + height, t.y + t.height + 6) - Math.max(p.y, t.y - 6)), 0) }));
  return scored.sort((a, b) => a.overlap - b.overlap)[0]!.p;
}
