import {sampleNotes} from './sampleData';
import {isCharacter, isColor, noteAppearance, type CharacterId, type ColorId} from '../src/apps/board/appearance';
import { createHmac, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { screenBoardNote } from './boardScreening';
export { screenBoardNote } from './boardScreening';
import type { Express, Request } from 'express';
import { requireOwner, requireOwnerCsrf } from './auth';
import { clientRateKey } from './clientAddress';
import { sameOrigin } from './origin';

type StoredNote = { characterId?: CharacterId; colorId?: ColorId; id: string; name: string; text: string; x: number; y: number; status: 'published' | 'removed' | 'pending' | 'rejected'; createdAt: string; updatedAt: string };
type Report = { id: string; noteId: string; createdAt: string };
const dir = resolve(process.env.MENDEZ_OS_DATA_DIR || join(process.cwd(), '.local'));
const file = join(dir, 'board.json');
const samplePositionsFile=join(dir,'board-sample-positions.json');
async function samples(){let positions:Record<string,{x:number;y:number}>={};try{positions=JSON.parse(await readFile(samplePositionsFile,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}return sampleNotes.map(note=>({...note,...positions[note.id]}));}
const reportsFile = join(dir, 'board-reports.json');
let queue: Promise<unknown> = Promise.resolve();
const attempts = new Map<string, { count: number; reset: number }>();
const rateSalt = randomBytes(24);
const reportAttempts = new Map<string, number>();
const moveAttempts = new Map<string, { count: number; reset: number }>();
function publicNote(note: StoredNote) { return { ...noteAppearance(note), id: note.id, name: note.name || 'Visitor', text: note.text, x: note.x, y: note.y, createdAt: note.createdAt }; }
async function readNotes(): Promise<StoredNote[]> {
  try { const parsed: unknown = JSON.parse(await readFile(file, 'utf8')); if (!Array.isArray(parsed)) throw new Error('Malformed board data'); return parsed as StoredNote[]; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}
async function persist(notes: StoredNote[]) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const temp = `${file}.${randomBytes(8).toString('hex')}.tmp`;
  await writeFile(temp, JSON.stringify(notes, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(temp, file);
}
async function readReports(): Promise<Report[]> {
  try { const parsed: unknown = JSON.parse(await readFile(reportsFile, 'utf8')); if (!Array.isArray(parsed)) throw new Error('Malformed reports'); return parsed as Report[]; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}
async function persistReports(reports: Report[]) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const temp = `${reportsFile}.${randomBytes(8).toString('hex')}.tmp`;
  await writeFile(temp, JSON.stringify(reports, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(temp, reportsFile);
}
function transact<T>(fn: (notes: StoredNote[]) => Promise<T>): Promise<T> {
  const operation = queue.then(async () => fn(await readNotes()));
  queue = operation.catch(() => undefined);
  return operation;
}
function rateLimit(req: Request): boolean {
  const key = clientRateKey(req, rateSalt), now = Date.now();
  const item = attempts.get(key) || { count: 0, reset: now + 3_600_000 };
  if (now >= item.reset) { item.count = 0; item.reset = now + 3_600_000; }
  if (item.count >= 4) return false;
  item.count += 1; attempts.set(key, item);
  if (attempts.size > 5000) for (const [address, value] of attempts) if (value.reset < now) attempts.delete(address);
  return true;
}
function plain(value: unknown, max: number, multiline=false): string | null {
  if (typeof value !== 'string') return null;
  const result = value.normalize('NFKC').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, ' ').replace(/<[^>]*>/g, '').replace(/[<>]/g, '').replace(multiline?/[^\S\n]+/g:/\s+/g, ' ').trim();
  return result.length >= 2 && result.length <= max ? result : null;
}
function position(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.min(1200, Math.max(0, value))) : fallback;
}
export function mountBoardRoutes(app: Express) {
  app.get('/api/board', async (_req, res) => {
    try { res.setHeader('Cache-Control', 'no-store'); const published = (await readNotes()).filter(note => note.status === 'published'); res.json({ publishedCount: published.length, notes: [...published.map(publicNote), ...(await samples()).map(note => ({...note, ...noteAppearance(note)}))] }); }
    catch { res.status(500).json({ error: 'Board is unavailable.' }); }
  });
  app.post('/api/board', async (req, res) => {
    if (!sameOrigin(req)) { res.status(403).json({ error: 'Origin not allowed.' }); return; }
    const rawName = req.body?.name;
    const name = rawName === undefined || (typeof rawName === 'string' && !rawName.trim()) ? 'Visitor' : plain(rawName, 30), text = plain(req.body?.text, 280, true);
    const characterId = req.body?.characterId === undefined ? 'scout' : req.body.characterId;
    const colorId = req.body?.colorId === undefined ? 'teal' : req.body.colorId;
    if (!isCharacter(characterId) || !isColor(colorId)) { res.status(400).json({ error: 'Choose a valid character and color.' }); return; }
    if (!name || !text) { res.status(400).json({ error: 'Use an optional name of 2–30 characters and a note of 2–280 characters.' }); return; }
    if (!rateLimit(req)) { res.status(429).json({ error: 'Please wait before posting another note.' }); return; }
    try {
      if (!screenBoardNote(name, text)) { res.status(422).json({ error: 'Jarvis says this note needs a rewrite. Please avoid harmful language, links, or repeated text.' }); return; }
      const now = new Date().toISOString();
      const note: StoredNote = { id: randomBytes(12).toString('hex'), name, text, characterId, colorId, x: position(req.body?.x, 260), y: position(req.body?.y, 240), status: 'published', createdAt: now, updatedAt: now };
      await transact(async notes => {
        notes.push(note); await persist(notes);
      });
      res.status(201).json({ note: publicNote(note) });
    } catch { res.status(503).json({ error: 'Screening or storage is unavailable. Nothing was published; please retry later.' }); }
  });
  // Moving a published note is a shared visitor action; it cannot edit its text
  // or status. Serialize with posting/removal so a late move never revives a note.
  app.patch('/api/board/:id/position', async (req, res) => {
    if (!sameOrigin(req)) { res.status(403).json({ error: 'Origin not allowed.' }); return; }
    const { x, y } = req.body || {};
    if (!(/^[a-f0-9]{24}$/.test(String(req.params.id))||sampleNotes.some(n=>n.id===req.params.id)) || typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1200 || y < 0 || y > 1200) {
      res.status(400).json({ error: 'Use a position inside the board.' }); return;
    }
    const key = clientRateKey(req, rateSalt), now = Date.now();
    for (const [address, item] of moveAttempts) if (item.reset <= now) moveAttempts.delete(address);
    const attempt = moveAttempts.get(key) || { count: 0, reset: now + 60_000 };
    if (attempt.count >= 60 || (!moveAttempts.has(key) && moveAttempts.size >= 5000)) { res.status(429).json({ error: 'Please wait a moment before moving more notes.' }); return; }
    attempt.count++; moveAttempts.set(key, attempt);
    try {
      if(sampleNotes.some(note=>note.id===req.params.id)){
        const moved=await transact(async()=>{const notes=await samples();const note=notes.find(n=>n.id===req.params.id)!;note.x=Math.round(x);note.y=Math.round(y);await mkdir(dir,{recursive:true,mode:0o700});const temp=samplePositionsFile+'.tmp';await writeFile(temp,JSON.stringify(Object.fromEntries(notes.map(n=>[n.id,{x:n.x,y:n.y}]))),{mode:0o600});await rename(temp,samplePositionsFile);return note;});res.json({note:moved});return;
      }
      const moved = await transact(async notes => {
        const note = notes.find(item => item.id === req.params.id && item.status === 'published');
        if (!note) return null;
        note.x = Math.round(x); note.y = Math.round(y); note.updatedAt = new Date().toISOString();
        await persist(notes); return publicNote(note);
      });
      if (!moved) { res.status(404).json({ error: 'Published note not found.' }); return; }
      res.json({ note: moved });
    } catch { res.status(503).json({ error: 'The move could not be saved. Please retry.' }); }
  });
  app.post('/api/board/:id/report', async (req, res) => {
    if (!sameOrigin(req)) { res.status(403).json({ error: 'Origin not allowed.' }); return; }
    const key = createHmac('sha256', rateSalt).update(`${clientRateKey(req, rateSalt)}:${req.params.id}`).digest('hex');
    const now = Date.now();
    if ((reportAttempts.get(key) || 0) > now - 86_400_000) { res.status(429).json({ error: 'You have already reported this note today.' }); return; }
    try {
      const found = await transact(async notes => {
        if (!notes.some(note => note.id === req.params.id && note.status === 'published')) return false;
        const reports = await readReports();
        reports.push({ id: randomBytes(12).toString('hex'), noteId: String(req.params.id), createdAt: new Date().toISOString() });
        await persistReports(reports); return true;
      });
      if (!found) { res.status(404).json({ error: 'Note not found.' }); return; }
      reportAttempts.set(key, now);
      if (reportAttempts.size > 5000) for (const [id, time] of reportAttempts) if (time < now - 86_400_000) reportAttempts.delete(id);
      res.status(202).json({ reported: true });
    } catch { res.status(500).json({ error: 'Report could not be saved.' }); }
  });
  // Owner-only removal stays outside the visitor Board UI. Historic pending
  // notes from the former review flow remain invisible and are never promoted.
  app.get('/api/board/moderation', requireOwner, async (_req, res) => {
    try {
      const [notes, reports] = await Promise.all([readNotes(), readReports()]);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ notes: notes.filter(note => note.status === 'published').map(note => ({ ...publicNote(note), reports: reports.filter(report => report.noteId === note.id).length })) });
    }
    catch { res.status(500).json({ error: 'Board is unavailable.' }); }
  });
  app.delete('/api/board/moderation/:id', requireOwnerCsrf, async (req, res) => {
    try {
      const removed = await transact(async notes => {
        const note = notes.find(item => item.id === req.params.id && item.status === 'published');
        if (!note) return false;
        note.status = 'removed'; note.updatedAt = new Date().toISOString();
        await persist(notes); return true;
      });
      if (!removed) { res.status(404).json({ error: 'Published note not found.' }); return; }
      res.json({ removed: true });
    } catch { res.status(500).json({ error: 'Removal failed.' }); }
  });
}
