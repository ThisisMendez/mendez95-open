import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile, copyFile, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import type { SiteContent, SiteContentView, PhotoRecord } from '../src/content/types';
import { parsePhotoMediaPath } from '../src/content/mediaPath';
import { toPublicContent, validateSiteContent } from '../src/content/validation';
import { requireOwner, requireOwnerCsrf } from './auth';
import { isLocalReview } from './localReview';

const root = fileURLToPath(new URL('..', import.meta.url));
const dataDir = process.env.MENDEZ_OS_DATA_DIR || join(root, '.local');
const contentDir = process.env.MENDEZ_OS_CONTENT_DIR || join(root, 'content');
const privateDir = join(dataDir, 'private-media');
const contentMediaDir = process.env.MENDEZ_OS_MEDIA_DIR || join(root, 'content-media');
const publishedMediaDir = join(contentMediaDir, 'editor');
const backupDir = join(dataDir, 'content-backups');
const names = ['stories', 'field-notes', 'photos', 'resume', 'about', 'elsewhere'] as const;
type Collection = typeof names[number];
const property: Record<Collection, keyof SiteContent> = { stories: 'stories', 'field-notes': 'fieldNotes', photos: 'photos', resume: 'resume', about: 'about', elsewhere: 'elsewhere' };
let pendingWrite: Promise<unknown> = Promise.resolve();

function jsonPath(name: Collection) { return join(contentDir, `${name}.json`); }
function queue<T>(task: () => Promise<T>): Promise<T> {
  const run = pendingWrite.then(task, task);
  pendingWrite = run.catch(() => undefined);
  return run;
}

export async function readContent(preview = false): Promise<SiteContentView> {
  const entries = await Promise.all(names.map(async name => JSON.parse(await readFile(jsonPath(name), 'utf8')) as unknown));
  const data = Object.fromEntries(names.map((name, index) => [property[name], entries[index]])) as unknown as SiteContent;
  const issues = validateSiteContent(data);
  if (issues.length) throw new Error(`Content validation failed: ${issues.join(' ')}`);
  // Legacy public download links are never part of any content projection.
  delete data.resume.downloadUrl;
  return preview ? data : toPublicContent(data);
}

export const publicContent = () => readContent(false);

async function writeJson(path: string, value: unknown) {
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  try { await copyFile(path, join(backupDir, `${basename(path)}.${Date.now()}.bak`)); } catch { /* first write */ }
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temp, path);
}

async function publishPrivatePhotos(photos: PhotoRecord[]): Promise<PhotoRecord[]> {
  await mkdir(publishedMediaDir, { recursive: true });
  return Promise.all(photos.map(async photo => {
    if (photo.status !== 'published' || !photo.src.startsWith('/api/editor/media/')) return photo;
    const file = basename(photo.src);
    if (!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(file)) throw new Error('Photo has an invalid private image path.');
    const source = join(privateDir, file);
    await stat(source);
    await copyFile(source, join(publishedMediaDir, file));
    return { ...photo, src: `/media/editor/${file}` };
  }));
}

async function validatePhotoAssets(photos: PhotoRecord[]): Promise<string[]> {
  const issues: string[] = [];
  for (const photo of photos) {
    if (photo.status !== 'published' || photo.disclosureStatus !== 'cleared' || !photo.rightsCleared) continue;
    const parsed = parsePhotoMediaPath(photo.src);
    const source = parsed?.kind === 'private' ? join(privateDir, parsed.relative) : parsed?.kind === 'public' ? join(contentMediaDir, parsed.relative) : null;
    if (!source) { issues.push(`Photo ${photo.id}: image path is not served by this app.`); continue; }
    try { const file = await stat(source); if (!file.isFile()) issues.push(`Photo ${photo.id}: image file is missing.`); }
    catch { issues.push(`Photo ${photo.id}: image file is missing.`); }
  }
  return issues;
}

async function saveCollection(name: Collection, value: unknown) {
  return queue(async () => {
    const current = await readContent(true) as SiteContent;
    let candidateValue = value;
    const candidate = { ...current, [property[name]]: candidateValue } as SiteContent;
    const issues = validateSiteContent(candidate);
    if (name === 'photos' && Array.isArray(candidateValue)) issues.push(...await validatePhotoAssets(candidateValue as PhotoRecord[]));
    if (issues.length) return { ok: false as const, issues };
    // Only copy an owner-reviewed private image into the public directory after
    // every publication requirement has passed.
    if (name === 'photos' && Array.isArray(candidateValue)) candidateValue = await publishPrivatePhotos(candidateValue as PhotoRecord[]);
    const oldStories = name === 'stories' ? current.stories : [];
    await writeJson(jsonPath(name), candidateValue);
    if (name === 'stories') {
      const redirectsPath = join(contentDir, 'redirects.json');
      let redirects: Record<string, string> = {};
      try { redirects = JSON.parse(await readFile(redirectsPath, 'utf8')) as Record<string, string>; } catch { /* new */ }
      for (const prior of oldStories) {
        const next = candidate.stories.find(story => story.id === prior.id);
        if (next && next.slug !== prior.slug) {
          const base = prior.kind === 'ai-lab' ? '/ai-lab/' : prior.kind === 'side-project' ? '/side-projects/' : '/work/';
          redirects[`${base}${prior.slug}`] = `${base}${next.slug}`;
        }
      }
      await writeJson(redirectsPath, redirects);
    }
    return { ok: true as const, value: candidateValue };
  });
}

export async function resolveRedirect(pathname: string) {
  try {
    const map = JSON.parse(await readFile(join(contentDir, 'redirects.json'), 'utf8')) as Record<string, string>;
    return map[pathname];
  } catch { return undefined; }
}

function imageType(buffer: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length > 12 && buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP') return 'webp';
  return null;
}

export function mountContentRoutes(app: Express) {
  app.use('/media', async (req, res) => {
    try {
      const path = new URL(req.originalUrl, 'http://localhost').pathname;
      const content = await readContent(true) as SiteContent;
      const photo = content.photos.find(item => item.src === path && item.status === 'published' && item.disclosureStatus === 'cleared' && item.rightsCleared === true);
      const parsed = parsePhotoMediaPath(path);
      const visible = isLocalReview(req) ? content.stories.filter(s=>s.status!=='hidden'&&s.disclosureStatus!=='restricted') : toPublicContent(content).stories;
      const storyAsset=visible.some(story=>story.caseMedia?.some(media=>media.src===path&&media.rightsCleared===true));
      const articleAsset=content.fieldNotes.some(note=>note.coverSrc===path&&note.status==='published'&&note.disclosureStatus==='cleared');
      if ((!photo&&!storyAsset&&!articleAsset) || parsed?.kind !== 'public') { res.status(404).end(); return; }
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(join(contentMediaDir, parsed.relative));
    } catch { res.status(404).end(); }
  });
  app.get('/api/content', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      if (req.query.review === '1') {
        if (!isLocalReview(req)) { res.status(401).json({ error: 'Not available.' }); return; }
        res.json({ ...await readContent(true), reviewMode: true }); return;
      }
      if (req.query.preview === '1') return requireOwner(req, res, async () => {
        try { res.json(await readContent(true)); } catch (error) { res.status(500).json({ error: String(error) }); }
      });
      res.json(await publicContent());
    } catch (error) { res.status(500).json({ error: String(error) }); }
  });
  app.get('/api/editor/content', requireOwner, async (_req, res) => {
    try { res.setHeader('Cache-Control', 'no-store'); res.json(await readContent(true)); }
    catch (error) { res.status(500).json({ error: String(error) }); }
  });
  app.put('/api/editor/content/:collection', requireOwnerCsrf, async (req, res) => {
    const name = req.params.collection as Collection;
    if (!names.includes(name)) { res.status(404).json({ error: 'Unknown collection.' }); return; }
    try {
      const outcome = await saveCollection(name, req.body);
      if (!outcome.ok) { res.status(422).json({ error: 'Publication validation failed.', issues: outcome.issues }); return; }
      res.json({ ok: true, value: outcome.value });
    } catch (error) { res.status(500).json({ error: String(error) }); }
  });
  app.get('/api/editor/backups/:collection', requireOwner, async (req, res) => {
    const name = req.params.collection as Collection;
    if (!names.includes(name)) { res.status(404).json({ error: 'Unknown collection.' }); return; }
    try {
      const files = await readdir(backupDir).catch(() => [] as string[]);
      const pattern = new RegExp(`^${name}\\.json\\.(\\d+)\\.bak$`);
      const backups = files.map(file => ({ file, match: file.match(pattern) })).filter(item => item.match).sort((a,b)=>Number(b.match![1])-Number(a.match![1])).slice(0, 30).map(item => ({ id: item.file, savedAt: new Date(Number(item.match![1])).toISOString() }));
      res.setHeader('Cache-Control', 'no-store');
      res.json({ backups });
    } catch (error) { res.status(500).json({ error: String(error) }); }
  });
  app.post('/api/editor/restore/:collection', requireOwnerCsrf, async (req, res) => {
    const name = req.params.collection as Collection;
    if (!names.includes(name)) { res.status(404).json({ error: 'Unknown collection.' }); return; }
    const backup = typeof req.body?.backup === 'string' ? req.body.backup : '';
    if (!new RegExp(`^${name}\\.json\\.\\d+\\.bak$`).test(backup)) { res.status(400).json({ error: 'Invalid backup identifier.' }); return; }
    try {
      const value = JSON.parse(await readFile(join(backupDir, backup), 'utf8')) as unknown;
      const outcome = await saveCollection(name, value);
      if (!outcome.ok) { res.status(422).json({ error: 'Backup no longer passes publication validation.', issues: outcome.issues }); return; }
      res.json({ ok: true, value: outcome.value });
    } catch (error) { res.status(500).json({ error: String(error) }); }
  });
  app.post('/api/editor/media', requireOwnerCsrf, async (req, res) => {
    try {
      if (typeof req.body?.data !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(req.body.data)) {
        res.status(400).json({ error: 'Upload a PNG, JPEG, or WebP image.' }); return;
      }
      const encoded = req.body.data.slice(req.body.data.indexOf(',') + 1);
      if (encoded.length > 7_000_000) { res.status(413).json({ error: 'Image exceeds 5 MB.' }); return; }
      const buffer = Buffer.from(encoded, 'base64');
      const type = imageType(buffer);
      if (!type || buffer.length > 5_000_000) { res.status(400).json({ error: 'Invalid or oversized image.' }); return; }
      await mkdir(privateDir, { recursive: true, mode: 0o700 });
      const file = `${randomUUID()}.${type}`;
      await writeFile(join(privateDir, file), buffer, { mode: 0o600 });
      res.json({ src: `/api/editor/media/${file}` });
    } catch (error) { res.status(500).json({ error: String(error) }); }
  });
  app.get('/api/editor/media/:file', (req, res, next) => isLocalReview(req) ? next() : requireOwner(req, res, next), async (req, res) => {
    const file = basename(String(req.params.file));
    if (!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(file)) { res.status(404).end(); return; }
    res.setHeader('Cache-Control', 'no-store');
    // The authenticated/local-only directory deliberately lives under .local.
    // Explicit basename validation above confines dotfile permission to this image.
    res.sendFile(join(privateDir, file), { dotfiles: 'allow' });
  });
}
