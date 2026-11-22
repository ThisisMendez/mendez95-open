export type XMedia = {url: string; alt: string; kind?: 'image' | 'video'};
export type QuotedXPost = {author: string; text: string; url: string; media: XMedia[]};
export type PublicXPost = {
  text: string; url: string; createdAt: string; media: XMedia[];
  quote?: QuotedXPost; checkedAt?: string;
};

export function validXStatusURL(value: unknown, owner?: string): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    const match = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,22})$/.exec(url.pathname);
    return url.origin === 'https://x.com' && !url.username && !url.password && !url.search && !url.hash && !!match && (!owner || match[1]?.toLowerCase() === owner.toLowerCase());
  } catch { return false; }
}
function validMedia(value: unknown): value is XMedia[] {
  return Array.isArray(value) && value.length <= 4 && value.every(media => {
    if (!media || typeof media.url !== 'string' || typeof media.alt !== 'string' || media.alt.length > 1000 || ![undefined, 'image', 'video'].includes(media.kind)) return false;
    try {
      const url = new URL(media.url);
      return url.protocol === 'https:' && url.hostname === 'pbs.twimg.com' && !url.port && !url.username && !url.password;
    } catch { return false; }
  });
}
export function validXPost(value: unknown): value is PublicXPost {
  if (!value || typeof value !== 'object') return false;
  const p = value as PublicXPost;
  if (typeof p.text !== 'string' || p.text.length > 10000 || !validXStatusURL(p.url, 'exampleowner') || typeof p.createdAt !== 'string' || !Number.isFinite(Date.parse(p.createdAt)) || !validMedia(p.media)) return false;
  if (p.checkedAt !== undefined && (typeof p.checkedAt !== 'string' || !Number.isFinite(Date.parse(p.checkedAt)))) return false;
  if (p.quote !== undefined) {
    const q = p.quote;
    if (!q || typeof q.author !== 'string' || !/^[A-Za-z0-9_]{1,15}$/.test(q.author) || !validXStatusURL(q.url, q.author) || typeof q.text !== 'string' || q.text.length > 10000 || !validMedia(q.media)) return false;
  }
  return !!(p.text.trim() || p.media.length || p.quote);
}
