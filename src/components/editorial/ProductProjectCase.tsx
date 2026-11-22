import {useEffect, useRef, useState, type TouchEvent, type KeyboardEvent} from 'react';
import type {PhotoRecord, Story, ProductOverview} from '../../content/types';
import {CaseNavigation} from '../CaseNavigation';
import {usePocketMode} from '../../pocket/layout';
import {DiagramViewer} from './DiagramViewer';
import {inline} from './inline';
import {overviewProse} from './CaseOverview';
import {VideoPreview, bluelineBehindBuild} from '../VideoPreview';
import './productProject.css';

type Props = {story: Story; overview: ProductOverview; photos: PhotoRecord[]; siblings: Story[]; navigate: (path: string) => void};

export function ProductProjectCase({story, overview, photos, siblings, navigate}: Props) {
  const pocket = usePocketMode();
  const media = (story.supportingMediaIds || []).flatMap(id => photos.filter(photo => photo.id === id && photo.status !== 'hidden' && photo.disclosureStatus !== 'restricted' && photo.rightsCleared));
  const [selected, setSelected] = useState(0);
  const [image, setImage] = useState<PhotoRecord | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const touch = useRef<{x: number; y: number} | null>(null);
  const photo = media[selected] || media[0];
  useEffect(() => {setSelected(0); setImage(null);}, [story.id, media.length]);
  const step = (direction: number) => setSelected(index => media.length ? (index + direction + media.length) % media.length : 0);
  const key = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1);}
  };
  const swipe = (event: TouchEvent<HTMLElement>) => {
    const start = touch.current, end = event.changedTouches[0];
    touch.current = null;
    if (!start || !end) return;
    const dx = end.clientX - start.x, dy = end.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx > 0 ? -1 : 1);
  };
  const architecture = <div className="product-architecture-rows">{overview.architecture.map(row => <section key={row.title}><h3>{row.title}</h3><div>{overviewProse(row.choice)}<p className="product-tradeoff"><strong>Tradeoff</strong> {inline(row.tradeoff)}</p></div></section>)}{overview.integrations && <p className="product-integrations"><strong>Integrations</strong> {inline(overview.integrations)}</p>}</div>;
  const ownership = <>{overviewProse(overview.ownership)}<p className="product-next"><strong>Next iteration.</strong> {inline(overview.next)}</p></>;
  const galleryPanel = photo && <section key="gallery" className="os-case-inset product-gallery" aria-roledescription="carousel" aria-label="Product screenshots" onKeyDown={key} onTouchStart={event => {const point = event.touches.length === 1 ? event.touches[0] : null; touch.current = point ? {x: point.clientX, y: point.clientY} : null;}} onTouchEnd={swipe}>
    <h2 className="os-case-panel-title">Product screenshots <span>{media.length} screens</span></h2>
    <figure><button ref={trigger} className="os-editorial-image-button" onClick={() => setImage(photo)} aria-haspopup="dialog" aria-label={`Enlarge screenshot: ${photo.alt}`}><img src={photo.src} alt={photo.alt} decoding="async"/><span className="os-diagram-affordance">Enlarge image ↗</span></button></figure>
    <div className="product-gallery-controls"><button className="os-button" onClick={() => step(-1)} disabled={media.length < 2} aria-label="Previous screenshot">‹</button><span aria-live="polite" aria-atomic="true">{photo.title} · {selected + 1} / {media.length}</span><button className="os-button" onClick={() => step(1)} disabled={media.length < 2} aria-label="Next screenshot">›</button></div>
    {media.length > 1 && <div className="product-gallery-dots" role="group" aria-label="Choose screenshot">{media.map((item, index) => <button key={item.id} aria-label={`Show screenshot ${index + 1}: ${item.title}`} aria-pressed={index === selected} onClick={() => setSelected(index)}><span/></button>)}</div>}
    <p className="product-photo-caption">{inline(photo.caption)}</p>
  </section>;
  const videoPanel = overview.video && <section key="video" className="os-case-inset product-video"><h2 className="os-case-panel-title">Watch the project</h2><div className="product-video-inner"><VideoPreview video={overview.video} label="Product & Architecture Overview" description="The original GitDiagram explainer: the product and how its architecture fits together."/>{story.id === 'blueline-redline' && <VideoPreview video={bluelineBehindBuild} label="Behind the Build" description="Follow a lease through intake, model and citation checks, failure states, and implementation tradeoffs."/>}</div></section>;
  return <article className="os-app os-editorial os-case-overview os-product-project" data-project={story.id}>
    <div className="os-editorial-toolbar"><button className="os-text-action" onClick={() => navigate('/side-projects')}>← Side Projects</button><span>{story.maturity === 'shipped' ? 'Public beta' : story.maturity}</span></div>
    <div className="os-editorial-paper">
      <header><h1>{story.menuLabel || story.title}</h1><p className="os-overview-subject">{overview.tagline}</p><p className="os-overview-meta">{[story.context, story.role, story.dates].filter(Boolean).join(' · ')}</p></header>
      <div className="os-overview-description">{overviewProse(story.summary)}</div>
      <div className="product-studio">
        {pocket ? <>{videoPanel}{galleryPanel}</> : <>{galleryPanel}{videoPanel}</>}
      </div>
      <section className="product-purpose"><p className="product-eyebrow">The product</p><h2>Why I built it</h2>{overviewProse(overview.why)}</section>
      <section className="product-workflow"><h2>How it works</h2><ol>{overview.workflow.map((item, index) => <li key={item.title}><span className="product-step-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{item.title}</h3>{overviewProse(item.body)}</div></li>)}</ol></section>
      {pocket ? <div className="product-pocket-details"><details><summary>Architecture & tradeoffs</summary>{architecture}</details><details><summary>Product ownership & what’s next</summary><div className="product-ownership">{ownership}</div></details></div> : <><section className="product-architecture"><h2>Architecture & tradeoffs</h2>{architecture}</section><section className="product-ownership"><h2>Product ownership</h2>{ownership}</section></>}
      <section className="product-shipped"><header><h2>What shipped</h2><span>{overview.releaseLabel}</span></header><ul>{overview.shipped.map(item => <li key={item.title}><strong>{item.title}</strong> {inline(item.body)}</li>)}</ul></section>
      <nav className="product-resource-links" aria-label="Project resources">{overview.onePagerUrl && <a className="os-button" href={overview.onePagerUrl} target="_blank" rel="noopener noreferrer">One-pager · PDF ↗</a>}{story.repositoryUrl && <a className="os-button" href={story.repositoryUrl} target="_blank" rel="noopener noreferrer">GitHub ↗</a>}{story.liveUrl && <a className="os-button product-visit" href={story.liveUrl} target="_blank" rel="noopener noreferrer">Visit site ↗</a>}</nav>
    </div>
    <CaseNavigation story={story} siblings={siblings} navigate={navigate} showContact={!pocket}/>
    {image && <DiagramViewer photo={image} close={() => {setImage(null); requestAnimationFrame(() => trigger.current?.focus({preventScroll: true}));}}/>}
  </article>;
}
