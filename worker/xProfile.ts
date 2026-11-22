import {validXPost, validXStatusURL, type PublicXPost, type XMedia} from '../shared/xPost';
import type {Env} from './env';
import {body} from './env';
import {Repository} from './storage';

type Article = {text: string; links: string[]; media: XMedia[]; children: Article[]};
const OWNER = 'exampleowner';
const CACHE_KEY = 'x:signed-out:last-good';
function entities(value: string): string {
  const names: Record<string, string> = {amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' '};
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (full, entity: string) => {
    if (!entity.startsWith('#')) return names[entity.toLowerCase()] || full;
    const code = entity[1]?.toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : full;
  });
}

// X's signed-out page currently nests quoted posts as their own article.
// No scripts are executed here, and no fetched markup is rendered in our UI.
export async function parseXProfileHTML(html: string): Promise<PublicXPost | null> {
  const roots: Article[] = [], stack: Article[] = [];
  const rewriter = new HTMLRewriter()
    .on('article', {element(element) {
      const article: Article = {text: '', links: [], media: [], children: []};
      const parent = stack.at(-1);
      if (parent) parent.children.push(article); else roots.push(article);
      stack.push(article);
      element.onEndTag(() => {stack.pop();});
    }})
    .on('article a[href]', {element(element) {
      const href = element.getAttribute('href');
      if (!href || !stack.length) return;
      try {
        const url = new URL(href, 'https://x.com').href;
        if (validXStatusURL(url)) stack.at(-1)!.links.push(url);
      } catch { /* Ignore malformed links. */ }
    }})
    .on('article [dir="auto"]', {
      text(chunk) {const article = stack.at(-1); if (article) article.text += chunk.text;},
      element(element) {const article = stack.at(-1); element.onEndTag(() => {if (article) article.text += '\n';});},
    })
    .on('article img[src], article video[poster]', {element(element) {
      const article = stack.at(-1);
      const isVideo = element.tagName === 'video';
      const source = element.getAttribute(isVideo ? 'poster' : 'src');
      if (!article || !source) return;
      try {
        const url = new URL(entities(source));
        if (url.protocol !== 'https:' || url.hostname !== 'pbs.twimg.com' || !/^\/(media|amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb)\//.test(url.pathname)) return;
        if (article.media.length < 4 && !article.media.some(item => item.url === url.href)) article.media.push({url: url.href, alt: element.getAttribute('alt') || (isVideo ? 'Video preview; watch on X' : 'Post image'), kind: isVideo ? 'video' : 'image'});
      } catch { /* Ignore remote or malformed media. */ }
    }});
  await rewriter.transform(new Response(html)).text();
  const posts: PublicXPost[] = [];
  for (const article of roots) {
    const url = article.links.find(link => validXStatusURL(link, OWNER));
    if (!url) continue;
    const id = url.split('/').at(-1)!;
    // X snowflake IDs encode the creation time; signed-out markup has no <time>.
    const timestamp = Number((BigInt(id) >> 22n) + 1288834974657n);
    if (timestamp < 1288834974657 || timestamp > Date.now() + 300000) continue;
    const quote = article.children.find(child => child.links.some(link => validXStatusURL(link)));
    const quoteURL = quote?.links.find(link => validXStatusURL(link));
    const post: PublicXPost = {text: entities(article.text.trim()), url, createdAt: new Date(timestamp).toISOString(), media: article.media};
    if (quote && quoteURL) post.quote = {author: new URL(quoteURL).pathname.split('/')[1]!, text: entities(quote.text.trim()), url: quoteURL, media: quote.media};
    if (validXPost(post)) posts.push(post);
  }
  return posts.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] || null;
}

/** Visitors only read the shared last-good record; they never launch a browser. */
export async function cachedXPost(env: Env): Promise<PublicXPost | null> {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(CACHE_KEY).first<{value: string}>();
  if (!row) return null;
  try {const post: unknown = JSON.parse(row.value); return validXPost(post) ? post : null;} catch {return null;}
}

/** Called by the existing scheduled handler. At most one attempt per UTC day. */
export async function refreshXPost(env: Env, now = Date.now()) {
  if (env.X_BROWSER_ENABLED !== 'true' || env.EXTERNAL_FETCH_ENABLED !== 'true' || !env.X_BROWSER) return;
  const day = new Date(now).toISOString().slice(0, 10);
  if (!await new Repository(env.DB).take(`x:browser:${day}`, 1, 2 * 86400000, now)) return;
  try {
    const response = await env.X_BROWSER.quickAction('content', {
      url: `https://x.com/${OWNER}`, gotoOptions: {timeout: 20000, waitUntil: 'networkidle2'},
      waitForTimeout: 5000, bestAttempt: true, cacheTTL: 0,
    });
    if (!response.ok) return;
    const payload = await body(response, 2000000);
    if (payload.success !== true || typeof payload.result !== 'string') return;
    const post = await parseXProfileHTML(payload.result);
    if (!post) return; // Login walls and failures must not erase the last good post.
    const previous = await cachedXPost(env);
    if (previous && Date.parse(previous.createdAt) > Date.parse(post.createdAt)) return;
    post.checkedAt = new Date(now).toISOString();
    await env.DB.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(CACHE_KEY, JSON.stringify(post)).run();
  } catch { /* No retry today, no credentials in logs, preserve the last-good record. */ }
}
