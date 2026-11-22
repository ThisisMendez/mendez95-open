import { useEffect, useMemo, useRef, useState } from 'react';
import type { PhotoRecord } from '../../content/types';
import './photos.css';

export type PhotosAppProps = {
  photos: PhotoRecord[];
  navigate: (path: string) => void;
  pathname: string;
  preview: boolean;
};

const isPublic = (photo: PhotoRecord) =>
  photo.gallery === true &&
  photo.status === 'published' &&
  photo.disclosureStatus === 'cleared' &&
  photo.rightsCleared === true &&
  Boolean(photo.src && photo.alt.trim() && photo.caption.trim() && photo.rights.trim());

function safeInstagramHref(href?: string) {
  if (!href) return undefined;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && url.hostname === 'www.instagram.com' && /^\/(?:p|reel)\/[A-Za-z0-9_-]+\/$/.test(url.pathname) && !url.search && !url.hash
      ? url.href
      : undefined;
  } catch { return undefined; }
}

export function PhotosApp({ photos, navigate, pathname, preview }: PhotosAppProps) {
  const visible = useMemo(
    () => photos.filter((photo) => photo.gallery === true && photo.status !== 'hidden' && photo.disclosureStatus !== 'restricted' && (preview || isPublic(photo))).sort((a, b) => a.displayOrder - b.displayOrder),
    [photos, preview],
  );
  const slug = pathname.replace(/\/+$/, '').match(/^\/photos\/([^/]+)$/)?.[1];
  const selectedIndex = slug ? visible.findIndex((photo) => photo.slug === slug) : -1;
  const selected = selectedIndex >= 0 ? visible[selectedIndex] : undefined;
  const appRef = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [wasOpenedHere, setWasOpenedHere] = useState(false);
  const [viewerReadySrc, setViewerReadySrc] = useState('');
  const viewerReady = selected?.src === viewerReadySrc;

  const open = (photo: PhotoRecord) => {
    setWasOpenedHere(true);
    navigate(`/photos/${photo.slug}`);
  };
  const close = () => {
    if (selected && wasOpenedHere) {
      triggerRefs.current[selected.slug]?.focus();
    }
    navigate('/photos');
  };
  const step = (delta: number) => {
    if (selectedIndex < 0 || !visible.length) return;
    const next = (selectedIndex + delta + visible.length) % visible.length;
    const nextPhoto = visible[next];
    if (nextPhoto) navigate(`/photos/${nextPhoto.slug}`);
  };

  useEffect(() => {
    if (!selected || !viewerReady || appRef.current?.closest('.os-window')?.getAttribute('data-active') === 'false') return;
    closeButton.current?.focus();
  }, [selected?.slug, viewerReady]);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (appRef.current?.closest('.os-window')?.getAttribute('data-active') === 'false') return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
      if (event.key === 'Tab') {
        const dialog = document.querySelector<HTMLElement>('.photos-lightbox-frame');
        const focusable = [...(dialog?.querySelectorAll<HTMLElement>('button, a[href]') ?? [])].filter((node) => !node.hasAttribute('disabled'));
        if (!focusable.length) return;
        const current = focusable.indexOf(document.activeElement as HTMLElement);
        if (event.shiftKey && current <= 0) { event.preventDefault(); focusable.at(-1)?.focus(); }
        if (!event.shiftKey && current === focusable.length - 1) { event.preventDefault(); focusable[0]?.focus(); }
        if (!event.shiftKey && current < 0) { event.preventDefault(); focusable[0]?.focus(); }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [selected?.slug, selectedIndex, visible, wasOpenedHere]);

  return (
    <section ref={appRef} className="os-app photos-app" aria-label="Photos gallery">
      <header className="photos-header">
        <div className="photos-title-row"><h1>Photos</h1><span className="photos-count" aria-label={`${visible.length} images`}>{String(visible.length).padStart(2, '0')} frames</span></div>
        <p className="os-muted">Profile covers from <a href="https://www.instagram.com/exampleowner/" target="_blank" rel="noopener noreferrer">Instagram @exampleowner</a>. Select a frame to explore.</p>
      </header>

      {visible.length === 0 ? (
        <div className="os-empty photos-empty">
          <h2>Selections coming soon</h2>
          <p>{preview?'No individual Instagram photos have been supplied in an accessible original form and cleared for this gallery yet.':'For now, find Jordan’s personal photos on Instagram.'}</p>
          <a className="os-button" href="https://www.instagram.com/exampleowner/" target="_blank" rel="noopener noreferrer">Visit Instagram ↗</a>
        </div>
      ) : (
        <div className="photos-grid">
          {visible.map((photo, index) => (
            <button
              key={photo.id}
              ref={(node) => { triggerRefs.current[photo.slug] = node; }}
              className="photos-tile"
              type="button"
              onClick={() => open(photo)}
              aria-label={`Open image ${index + 1} of ${visible.length}: ${photo.title}`}
            >
              <span className="photos-tile-image"><img src={photo.src} alt={photo.alt} loading={index < 6 ? 'eager' : 'lazy'} /></span>
              {preview && !isPublic(photo) && <span className="photos-draft">{photo.status === 'hidden' ? 'Hidden' : 'Draft / Needs review'}</span>}
            </button>
          ))}
        </div>
      )}

      {slug && !selected && (
        <div className="os-empty" role="status">
          <h2>Image unavailable</h2>
          <p>This frame is not in the published gallery, or its link has changed.</p>
          <button className="os-button" onClick={() => navigate('/photos')}>Back to gallery</button>
        </div>
      )}

      {selected && (
        <div className={`photos-lightbox-frame${viewerReady ? ' photos-lightbox' : ''}`} role="dialog" aria-modal="true" aria-label={`${selected.title}, image ${selectedIndex + 1} of ${visible.length}`}
          onTouchStart={(event) => {
            const point = event.touches.item(0);
            if (point) setTouchStart({ x: point.clientX, y: point.clientY });
          }}
          onTouchEnd={(event) => {
            if (!touchStart) return;
            const point = event.changedTouches.item(0);
            if (!point) return;
            const dx = point.clientX - touchStart.x;
            const dy = point.clientY - touchStart.y;
            if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
            setTouchStart(null);
          }}
        >
          <div className="photos-lightbox-top"><span className="os-kicker">Frame {String(selectedIndex + 1).padStart(2, '0')} / {String(visible.length).padStart(2, '0')}</span><button ref={closeButton} className="photos-icon-button" type="button" onClick={close} aria-label="Close image">✕ <span>Close</span></button></div>
          <div className="photos-lightbox-stage">
            <button className="photos-image-nav" type="button" onClick={() => step(-1)} aria-label="Previous image">←</button>
            <img src={selected.src} alt={selected.alt} loading="eager" decoding="sync" onLoad={() => setViewerReadySrc(selected.src)} />
            <button className="photos-image-nav" type="button" onClick={() => step(1)} aria-label="Next image">→</button>
          </div>
          <footer className="photos-lightbox-footer">
            <div><h2>{selected.title}</h2><p>{selected.caption}</p><small>{selected.credit}</small>{preview && !isPublic(selected) && <strong className="photos-draft">{selected.status === 'hidden' ? 'Hidden' : 'Draft / Needs review'}</strong>}</div>
            {safeInstagramHref(selected.gallerySourceUrl) && <a className="os-button" href={safeInstagramHref(selected.gallerySourceUrl)} target="_blank" rel="noopener noreferrer">Open on Instagram</a>}
          </footer>
          <p className="photos-key-hint">Use ← and → to browse. Esc returns to the gallery.</p>
        </div>
      )}
    </section>
  );
}

export default PhotosApp;
