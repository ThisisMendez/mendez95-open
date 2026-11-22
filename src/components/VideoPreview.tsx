import {useCallback, useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import './videoPreview.css';

export type PortfolioVideo = {src: string; poster: string; title: string; duration: string; captions?: string};

export const portfolioTour: PortfolioVideo = {
  src: '',
  poster: '/videos/mendez95-product-decisions-and-experience-poster.jpg',
  captions: '/videos/mendez95-product-decisions-and-experience.vtt',
  title: 'Mendez 95 | Product Decisions and Experience',
  duration: '1:00',
};

export const bluelineBehindBuild: PortfolioVideo = {
  src: '',
  poster: '/videos/blueline-behind-the-build-poster.jpg',
  captions: '/videos/blueline-behind-the-build.vtt',
  title: 'Blue Line Lease | Behind the Build',
  duration: '3:50',
};

/** Keep the existing native MP4 controls and hosting; mount media only on request. */
export function VideoPreview({video, label, description, menu = false}: {video: PortfolioVideo; label: string; description?: string; menu?: boolean}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (!video.src) return <p className="os-muted">Personal video omitted from this example edition. See docs/VIDEO-WORKFLOW.md.</p>;
  return <div className={menu ? 'os-video-menu' : 'os-video-preview'}>
    <button className={menu ? 'os-button' : 'os-video-card'} aria-haspopup="dialog" aria-label={`${label}: ${video.title}`} onClick={() => setOpen(true)}>
      {menu && <span className="os-video-menu-play" aria-hidden="true">▶</span>}
      {!menu && <span className="os-video-thumbnail"><img src={video.poster} alt="" loading="lazy" decoding="async" width="1920" height="1080"/><span aria-hidden="true">▶ Play · {video.duration}</span></span>}
      <span className="os-video-copy"><strong>{label}</strong>{!menu && description && <span>{description}</span>}</span>
    </button>
    {open && <VideoPlayer video={video} close={close}/>}
  </div>;
}

function VideoPlayer({video, close}: {video: PortfolioVideo; close: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null), player = useRef<HTMLVideoElement>(null), id = useId();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = dialog.current, media = player.current;
    modal?.showModal();
    // Browser Back returns to navigation even when desktop windows stay mounted.
    window.addEventListener('popstate', close);
    return () => {
      window.removeEventListener('popstate', close);
      media?.pause();
      modal?.close();
      if (origin?.isConnected) origin.focus({preventScroll: true});
    };
  }, [close]);
  // Keep editorial heading rules out of the shared player chrome.
  return createPortal(<dialog ref={dialog} className="os-video-player" aria-labelledby={`${id}-title`} onCancel={event => {event.preventDefault(); close();}} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    // Wrap only the outer edges so native video controls keep their own keys.
    const controls = event.currentTarget.querySelectorAll<HTMLElement>('button, video, p a[href]');
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
    else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
  }}>
    <header><h2 id={`${id}-title`}>{video.title}</h2><button autoFocus className="os-button" onClick={close}>Close / Back ×</button></header>
    <video ref={player} controls playsInline preload="none" poster={video.poster} aria-label={video.title} onError={() => setFailed(true)}>
      <source src={video.src} type="video/mp4"/>
      {video.captions && <track kind="captions" src={video.captions} srcLang="en" label="English" default/>}
      <a href={video.src}>Open video</a>
    </video>
    {failed && <p role="alert">The video could not load. Try opening the video directly.</p>}
    <p><a href={video.src} download>Download video</a>{video.captions && <> · <a href={video.captions} download>English captions</a></>}</p>
  </dialog>, document.body);
}
