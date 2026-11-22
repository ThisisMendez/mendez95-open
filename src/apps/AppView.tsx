import { lazy, Suspense } from 'react';
import {usePocketMode} from '../pocket/layout';
import {PocketTools,PocketWorld} from '../pocket/PocketChrome';
import type { SiteContentView } from '../content/types';
import type { RouteMatch } from '../desktop/router';
import type { BootFrequency, ScreenSaverMinutes, ThemeName } from '../desktop/useAppearance';
import { AboutApp, AiLabApp, ContactApp, FieldNotesApp, ResumeApp, SideProjectsApp, UnavailableApp, WorkApp } from './core/CoreApps';
import { SettingsApp } from './core/SettingsApp';
import { AccessoriesApp, FindApp, HelpApp, RunApp, ShutdownApp, SystemAboutApp, SystemUpdateApp } from './system/SystemApps';

const PhotosApp = lazy(() => import('./photos/PhotosApp'));
const GuideApp = lazy(() => import('./guide/GuideApp'));
const BoardApp = lazy(() => import('./board/BoardApp'));
const GamesApp = lazy(() => import('./games/GamesApp'));
const SnakeApp = lazy(() => import('./games/SnakeApp'));
const BounceApp = lazy(() => import('./games/BounceApp'));
const SolitaireApp = lazy(() => import('./games/classic/SolitaireApp'));
const MinesweeperApp = lazy(() => import('./games/classic/MinesweeperApp'));
const PaintApp = lazy(() => import('./paint/PaintApp').then(module => ({ default: module.PaintApp })));

export type AppViewProps = {
  onboarding?: { openWelcome: () => void; startTour: () => void; resumeTour: () => void; resumable: boolean; notice: string };
  route: RouteMatch; content: SiteContentView; navigate:(path:string)=>void; preview:boolean;
  theme:ThemeName; setTheme:(v:ThemeName)=>void;
  reduceMotion:boolean; setReduceMotion:(v:boolean)=>void;
  shadows:boolean; setShadows:(v:boolean)=>void;
  screensaverMinutes:ScreenSaverMinutes; setScreensaverMinutes:(v:ScreenSaverMinutes)=>void;
  bootFrequency:BootFrequency; setBootFrequency:(v:BootFrequency)=>void;
  widgetsVisible:boolean; setWidgetsVisible:(v:boolean)=>void;
  units:'f'|'c'; setUnits:(v:'f'|'c')=>void;
  clock24:boolean; setClock24:(v:boolean)=>void;
  soundOn:boolean; setSoundOn:(v:boolean)=>void;
  resetAppearance:()=>void; forgetBrowser:()=>void; replayBoot:()=>void;
  startScreensaver:()=>void; safeMode:()=>void; powerOff:()=>void;
};

export function AppView(props: AppViewProps) {
  const { route, content, navigate, preview } = props;
  const pocket=usePocketMode();
  const common = { content, navigate, preview };
  let view: React.ReactNode;
  switch (route.appId) {
    case 'work': view = <WorkApp {...common} slug={route.slug} full={route.view==='full'} />; break;
    case 'about': view = <AboutApp {...common} />; break;
    case 'resume': view = <ResumeApp {...common} />; break;
    case 'contact': view = <ContactApp {...common} />; break;
    case 'field-notes': view = <FieldNotesApp {...common} slug={route.slug} />; break;
    case 'ai-lab': view = <AiLabApp {...common} slug={route.slug} />; break;
    case 'side-projects': view = <SideProjectsApp {...common} slug={route.slug} />; break;
    case 'photos': view = <PhotosApp photos={content.photos} navigate={navigate} pathname={route.path} preview={preview} />; break;
    case 'guide': view = <GuideApp navigate={navigate} />; break;
    case 'board': view = <BoardApp navigate={navigate} />; break;
    case 'games': view = route.slug === 'snake' ? <SnakeApp /> : route.slug === 'bounce' ? <BounceApp /> : route.slug === 'solitaire' ? <SolitaireApp /> : route.slug === 'minesweeper' ? <MinesweeperApp /> : <GamesApp navigate={navigate} />; break;
    case 'paint': view = <PaintApp />; break;
    case 'mendez-world': view=<PocketWorld navigate={navigate}/>;break;
    case 'tools': view=<PocketTools navigate={navigate} route={`${route.path}${route.search||''}`}/>;break;
    case 'weather': case 'world-time': case 'pocket-radio': case 'visitor-log': case 'signal': view=null;break;
    case 'accessories': view = pocket?<PocketTools navigate={navigate} route={`${route.path}${route.search||''}`} />:<AccessoriesApp navigate={navigate} />; break;
    case 'system-about': view = <SystemAboutApp navigate={navigate} restart={props.replayBoot} safeMode={props.safeMode} powerOff={props.powerOff}/>; break;
    case 'system-update': view = <SystemUpdateApp />; break;
    case 'find': view = <FindApp content={content} navigate={navigate} />; break;
    case 'help': view = <HelpApp navigate={navigate} onboarding={props.onboarding} />; break;
    case 'run': view = <RunApp navigate={navigate} />; break;
    case 'shutdown': view = <ShutdownApp restart={props.replayBoot} safeMode={props.safeMode} powerOff={props.powerOff} />; break;
    case 'settings': view = <SettingsApp {...props} />; break;
    default: view = <UnavailableApp navigate={navigate} />;
  }
  return <Suspense fallback={<div className="os-app os-loading" role="status">Opening application…</div>}>{view}</Suspense>;
}
