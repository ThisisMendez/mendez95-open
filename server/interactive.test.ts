import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import express from 'express';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { profanity } from '@2toad/profanity';

let server: Server, base = '', dataDir = '';
beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'mendez-board-test-'));
  process.env.MENDEZ_OS_DATA_DIR = dataDir;
  process.env.MENDEZ_OS_OWNER_PASSWORD = 'test-owner-password-only';
  const [{ mountBoardRoutes }, { mountOwnerAuthRoutes }] = await Promise.all([import('./board'), import('./auth')]);
  const app = express(); app.use(express.json()); mountOwnerAuthRoutes(app); mountBoardRoutes(app);
  server = await new Promise<Server>(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port');
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await rm(dataDir, { recursive: true, force: true });
});
async function post(name: string, text: string) {
  return fetch(`${base}/api/board`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, text, x: 120, y: 100 }) });
}
it('fails closed if the local profanity screen throws', async () => {
  const { screenBoardNote } = await import('./board');
  expect(() => screenBoardNote('Visitor', 'Hello, this is a note.', () => { throw new Error('screen missing'); })).toThrow('screen missing');
  const screen = vi.spyOn(profanity, 'exists').mockImplementationOnce(() => { throw new Error('screen missing'); });
  try {
    const response = await post('Visitor', 'Hello, this is a note.');
    expect(response.status).toBe(503);
    expect((await (await fetch(`${base}/api/board`)).json()).notes.filter((note:{sample?:boolean})=>!note.sample)).toEqual([]);
  } finally { screen.mockRestore(); }
});
it('immediately publishes passing notes, blocks links and profanity, and requires owner CSRF for removal', async () => {
  const submitted = await post('Visitor', 'Hello <b>board</b> friends');
  expect(submitted.status).toBe(201);
  const { note } = await submitted.json();
  expect(note.text).not.toContain('<');
  expect(note.name).toBe('Visitor');
  const publicFeed = await (await fetch(`${base}/api/board`)).json();
  expect(publicFeed.notes.filter((note:{sample?:boolean})=>!note.sample)).toHaveLength(1);
  expect(publicFeed.notes[0].id).toBe(note.id);
  // Another unauthenticated visitor can move the first visitor's note.
  const moved = await fetch(`${base}/api/board/${note.id}/position`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'user-agent': 'second-visitor' }, body: JSON.stringify({ x: 740, y: 330 }) });
  expect(moved.status).toBe(200);
  const secondVisitorFeed = await (await fetch(`${base}/api/board`, { headers: { 'user-agent': 'first-visitor' } })).json();
  expect(secondVisitorFeed.notes[0]).toMatchObject({ id: note.id, x: 740, y: 330, text: note.text, name: 'Visitor' });
  const persistedMove = JSON.parse(await readFile(join(dataDir, 'board.json'), 'utf8'));
  expect(persistedMove[0]).toMatchObject({ x: 740, y: 330, status: 'published' });
  for (const position of [{ x: -1, y: 4 }, { x: '100', y: 4 }, { x: 1201, y: 4 }, { x: 2, y: null }]) {
    expect((await fetch(`${base}/api/board/${note.id}/position`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(position) })).status).toBe(400);
  }
  expect((await fetch(`${base}/api/board/${note.id}/position`, { method: 'PATCH', headers: { 'content-type': 'application/json', origin: 'https://other.example' }, body: JSON.stringify({ x: 4, y: 4 }) })).status).toBe(403);
  const report = await fetch(`${base}/api/board/${note.id}/report`, { method: 'POST' });
  expect(report.status).toBe(202);
  expect((await fetch(`${base}/api/board/${note.id}/report`, { method: 'POST' })).status).toBe(429);
  expect((await post('Visitor', 'Visit https://example.com')).status).toBe(422);
  expect((await post('Visitor', 'fuck this board')).status).toBe(422);
  expect((await (await fetch(`${base}/api/board`)).json()).notes.filter((note:{sample?:boolean})=>!note.sample)).toHaveLength(1);
  const privateFeed = await fetch(`${base}/api/board/moderation`);
  expect(privateFeed.status).toBe(401);
  const login = await fetch(`${base}/api/owner/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'test-owner-password-only' }) });
  expect(login.status).toBe(200);
  const cookie = login.headers.get('set-cookie')?.split(';')[0] || '';
  const { csrfToken } = await login.json();
  const ownerFeed = await (await fetch(`${base}/api/board/moderation`, { headers: { cookie } })).json();
  expect(ownerFeed.notes[0].reports).toBe(1);
  const withoutCsrf = await fetch(`${base}/api/board/moderation/${note.id}`, { method: 'DELETE', headers: { cookie } });
  expect(withoutCsrf.status).toBe(403);
  const removed = await fetch(`${base}/api/board/moderation/${note.id}`, { method: 'DELETE', headers: { cookie, 'x-mendez-csrf': csrfToken } });
  expect(removed.status).toBe(200);
  expect((await (await fetch(`${base}/api/board`)).json()).notes.filter((note:{sample?:boolean})=>!note.sample)).toEqual([]);
  const stored = JSON.parse(await readFile(join(dataDir, 'board.json'), 'utf8'));
  expect(stored[0].status).toBe('removed');
  expect((await fetch(`${base}/api/board/${note.id}/position`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: 4, y: 4 }) })).status).toBe(404);
  for (let attempt = 0; attempt < 58; attempt++) await fetch(`${base}/api/board/${note.id}/position`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: 4, y: 4 }) });
  expect((await fetch(`${base}/api/board/${note.id}/position`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: 4, y: 4 }) })).status).toBe(429);
  const reports = JSON.parse(await readFile(join(dataDir, 'board-reports.json'), 'utf8'));
  expect(Object.keys(reports[0]).sort()).toEqual(['createdAt', 'id', 'noteId']);
});
it('persists shared sample positions separately and preserves real note history, including multiline input',async()=>{
 const before=await readFile(join(dataDir,'board.json'),'utf8');
 vi.resetModules();const{mountBoardRoutes}=await import('./board');const app=express();app.use(express.json());mountBoardRoutes(app);const second=await new Promise<Server>(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});const addr=second.address();if(!addr||typeof addr==='string')throw new Error('No test port');const url=`http://127.0.0.1:${addr.port}`;
 try{
  const get=async()=>((await(await fetch(`${url}/api/board`)).json()).notes as {id:string;sample?:boolean;x:number;y:number}[]).filter(n=>n.sample);
  const first=await get();expect(first).toHaveLength(20);expect(await get()).toEqual(first);
  const move=await fetch(`${url}/api/board/sample-note-1/position`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({x:505,y:602})});expect(move.status).toBe(200);
  expect((await get()).find(n=>n.id==='sample-note-1')).toMatchObject({x:505,y:602});
  const shared=(await(await fetch(`${base}/api/board`)).json()).notes;expect(shared.find((n:{id:string})=>n.id==='sample-note-1')).toMatchObject({x:505,y:602});
  expect(await readFile(join(dataDir,'board.json'),'utf8')).toBe(before);
  const posted=await fetch(`${url}/api/board`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Sample tester',text:'First line\nSecond line',x:200,y:200})});expect(posted.status).toBe(201);expect((await posted.json()).note.text).toBe('First line\nSecond line');
  expect((await get()).map(n=>n.id)).toEqual(first.map(n=>n.id));
 }finally{await new Promise<void>(resolve=>second.close(()=>resolve()));}
});
