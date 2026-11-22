import {useState} from 'react';
import {validXPost, type PublicXPost, type XMedia} from '../../../shared/xPost';
export {validXPost};
export type {PublicXPost};

function MediaPreview({media, href}: {media: XMedia; href: string}) {
  const [failed, setFailed] = useState(false);
  return <a className="os-x-post-media" href={href} target="_blank" rel="noopener noreferrer" aria-label={media.kind === 'video' ? 'Watch video on X' : 'View image on X'}>
    {!failed && <img src={media.url} alt={media.alt || 'Post media'} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)}/>}
    {(media.kind === 'video' || failed) && <span className="os-x-media-caption">{media.kind === 'video' ? '▶ Watch video on X' : 'View image on X'} ↗</span>}
  </a>;
}
const date = (value: string) => new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'}).format(new Date(value));
function quoteExcerpt(text: string) {const words = text.trim().split(/\s+/); return words.length > 24 ? `${words.slice(0, 24).join(' ')}…` : text;}

/** Shared cached data only. No X SDK, browser session or API request per visitor. */
export function XPostCard({post, compact = false, open}: {post?: unknown; compact?: boolean; open?: () => void}) {
  if (!validXPost(post)) return <section className="os-x-post-card" aria-label="On X">
    <a href="https://x.com/exampleowner" target="_blank" rel="noopener noreferrer">@exampleowner ↗</a>
    <p>Latest post unavailable. Visit the profile on X.</p>
    {compact && open && <button type="button" onClick={open}>Open</button>}
  </section>;
  return <section className={`os-x-post-card ${compact ? 'is-compact' : ''}`} aria-label="Post from Jordan Example on X">
    <header className="os-x-identity">
      <span className="os-x-avatar" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-5-7.6L5.2 22H2l7.4-8.5L.8 2h6.5l4.5 6.9L18.9 2Zm-1.1 18h1.7L6.4 3.9H4.6L17.8 20Z"/></svg></span>
      <div><strong>Jordan Example</strong><a href="https://x.com/exampleowner" target="_blank" rel="noopener noreferrer">@exampleowner ↗</a></div>
    </header>
    <time dateTime={post.createdAt}>{date(post.createdAt)}</time>
    {post.text && <p className="os-x-post-text">{post.text}</p>}
    {post.media[0] && <MediaPreview key={post.media[0].url} media={post.media[0]} href={post.url}/>}
    {post.quote && <blockquote className="os-x-quote">
      <div className="os-x-quote-label">Quoted post</div>
      <a className="os-x-quote-author" href={post.quote.url} target="_blank" rel="noopener noreferrer">@{post.quote.author} ↗</a>
      <p>{quoteExcerpt(post.quote.text)}</p>
      {post.quote.media[0] && !compact && <MediaPreview key={post.quote.media[0].url} media={post.quote.media[0]} href={post.quote.url}/>}
      {compact&&post.quote.media[0]&&<a className="os-x-original" href={post.quote.url} target="_blank" rel="noopener noreferrer">{post.quote.media[0].kind==='video'?'Quoted video':'Quoted image'} ↗</a>}
      <a className="os-x-original" href={post.quote.url} target="_blank" rel="noopener noreferrer">Read original ↗</a>
    </blockquote>}
    <footer className="os-x-footer">
      <div className="os-widget-actions"><a className="os-x-open-post" href={post.url} target="_blank" rel="noopener noreferrer">Open post ↗</a>{compact && open && <button type="button" onClick={open}>Expand</button>}</div>
      {post.checkedAt&&Date.now()-Date.parse(post.checkedAt)>36*60*60*1000&&<small className="os-x-stale">Saved post · latest check is overdue.</small>}
      <small>Updates daily{post.checkedAt && <> · Checked <time dateTime={post.checkedAt}>{date(post.checkedAt)}</time></>}</small>
    </footer>
  </section>;
}
