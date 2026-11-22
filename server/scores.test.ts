import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import express from 'express';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';

let server: Server, base = '', dataDir = '';
beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'mendez-scores-test-'));
  process.env.MENDEZ_OS_DATA_DIR = dataDir;
  const { mountScoreRoutes } = await import('./scores');
  const app = express(); app.use(express.json()); mountScoreRoutes(app);
  server = await new Promise<Server>(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port');
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await rm(dataDir, { recursive: true, force: true }); });
async function start(game: string, difficulty?: string) { const result = await fetch(`${base}/api/scores/${game}/start`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(difficulty ? { difficulty } : {}) }); return result.json(); }
async function submit(game: string, body: unknown) { return fetch(`${base}/api/scores/${game}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }

it('persists top ten/count and rejects replayed, implausible, or cross-game rounds', async () => {
  const original = Date.now;
  const { token } = await start('snake');
  const tooSoon = await submit('snake', { token, nickname: 'Alex', score: 10 });
  expect(tooSoon.status).toBe(422);
  const round = await start('snake');
  const clock = vi.spyOn(Date, 'now').mockImplementation(() => original() + 10_000);
  try {
    const accepted = await submit('snake', { token: round.token, nickname: 'Alex', score: 30 });
    expect(accepted.status).toBe(201);
    const listing = await accepted.json();
    expect(listing.totalScores).toBe(1);
    expect(listing.allGamesTotal).toBe(1);
    expect(listing.top[0]).toMatchObject({ nickname: 'Alex', score: 30 });
    expect((await submit('snake', { token: round.token, nickname: 'Alex', score: 30 })).status).toBe(403);
    const cross = await start('bounce');
    expect((await submit('snake', { token: cross.token, nickname: 'Alex', score: 20 })).status).toBe(403);
    const saved = JSON.parse(await readFile(join(dataDir, 'scores.json'), 'utf8'));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ game: 'snake', nickname: 'Alex', score: 30 });
  } finally { clock.mockRestore(); }
});
it('requires clean nicknames and bounds scores', async () => {
  const { token } = await start('bounce');
  expect((await submit('bounce', { token, nickname: '<script>', score: 10 })).status).toBe(400);
  expect((await submit('bounce', { token, nickname: 'Player', score: 990 })).status).toBe(400);
  expect((await submit('bounce', { token, nickname: 'Player', score: 13 })).status).toBe(400);
  const listing = await (await fetch(`${base}/api/scores/bounce`)).json();
  expect(listing.totalScores).toBe(0);
});
it('accepts a genuinely elapsed quick Snake round with a positive score', async () => {
  const { token } = await start('snake');
  await new Promise(resolve => setTimeout(resolve, 1550));
  const accepted = await submit('snake', { token, nickname: 'QuickPlayer', score: 10 });
  expect(accepted.status).toBe(201);
  const listing = await accepted.json();
  expect(listing.top.some((entry: { nickname: string; score: number }) => entry.nickname === 'QuickPlayer' && entry.score === 10)).toBe(true);
});

async function complete(game: string, body: unknown) { return fetch(`${base}/api/scores/${game}/complete`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
it('keeps each normalized nickname’s best score across repeat submissions', async () => {
  let time = Date.now(); const clock = vi.spyOn(Date, 'now').mockImplementation(() => time);
  try {
    for (const [nickname, score] of [['  Ａｌｅｘ ', 40], ['aLEX', 20]] as const) {
      const { token } = await start('snake'); time += 10_000;
      expect((await submit('snake', { token, nickname, score })).status).toBe(201);
    }
    const board = await (await fetch(`${base}/api/scores/snake`)).json();
    expect(board.top.filter((entry: { nickname: string }) => entry.nickname.toLowerCase() === 'alex')).toEqual([expect.objectContaining({ nickname: 'Alex', score: 40 })]);
    expect(board.totalPlayers).toBe(2);
    expect(board.totalScores).toBe(4);
  } finally { clock.mockRestore(); }
});
it('requires successful classic completion, seals elapsed time, and allows delayed optional submission', async () => {
  let time = Date.now(); const clock = vi.spyOn(Date, 'now').mockImplementation(() => time);
  try {
    const { token } = await start('solitaire'); time += 30_000;
    const body = { token, nickname: 'CardPlayer', completed: true, durationMs: 30_000, score: 2290 };
    expect((await submit('solitaire', body)).status).toBe(422);
    expect((await complete('solitaire', { ...body, completed: false })).status).toBe(400);
    expect((await complete('solitaire', body)).status).toBe(200);
    expect((await (await fetch(`${base}/api/scores/solitaire`)).json()).totalScores).toBe(0);
    time += 120_000; // Human spends time choosing a nickname after winning.
    expect((await complete('solitaire', body)).status).toBe(200); // Lost-response retry is idempotent.
    expect((await complete('solitaire', { ...body, durationMs: 29_000 })).status).toBe(422);
    expect((await submit('solitaire', { ...body, score: 2320 })).status).toBe(400);
    expect((await submit('solitaire', { ...body, score: 2291, durationMs: 29_000 })).status).toBe(422);
    const saved = await submit('solitaire', body);
    expect(saved.status).toBe(201);
    expect((await saved.json()).entry).toMatchObject({ score: 2290, durationMs: 30_000 });
    expect((await submit('solitaire', body)).status).toBe(403);
  } finally { clock.mockRestore(); }
});
it('rejects both under-reported and over-reported classic completion times and expires rounds', async () => {
  let time = Date.now(); const clock = vi.spyOn(Date, 'now').mockImplementation(() => time);
  try {
    for (const durationMs of [1, 120_000]) {
      const { token } = await start('minesweeper', 'beginner'); time += 60_000;
      const body = { token, difficulty: 'beginner', completed: true, durationMs };
      expect((await complete('minesweeper', body)).status).toBe(422);
      expect((await complete('minesweeper', { ...body, durationMs: 60_000 })).status).toBe(403);
    }
    const { token } = await start('solitaire'); time += 1_800_001;
    expect((await complete('solitaire', { token, completed: true, durationMs: 1_800_000 })).status).toBe(422);
  } finally { clock.mockRestore(); }
});
it('separates Minesweeper difficulties, keeps fastest best per name, and rejects failed clears or wrong difficulty', async () => {
  let time = Date.now(); const clock = vi.spyOn(Date, 'now').mockImplementation(() => time);
  try {
    expect((await fetch(`${base}/api/scores/minesweeper?difficulty=unknown`)).status).toBe(400);
    for (const [difficulty, durationMs, nickname] of [['beginner', 30_000, 'Sweeper'], ['beginner', 20_000, 'sweeper'], ['expert', 60_000, 'Sweeper']] as const) {
      const { token } = await start('minesweeper', difficulty); time += durationMs;
      const body = { token, difficulty, nickname, completed: true, durationMs, score: durationMs / 1000 };
      expect((await complete('minesweeper', { ...body, difficulty: 'intermediate' })).status).toBe(403);
      expect((await submit('minesweeper', { ...body, completed: false })).status).toBe(400);
      expect((await complete('minesweeper', body)).status).toBe(200);
      expect((await submit('minesweeper', { ...body, score: body.score + 1 })).status).toBe(400);
      expect((await submit('minesweeper', body)).status).toBe(201);
    }
    const beginner = await (await fetch(`${base}/api/scores/minesweeper?difficulty=beginner`)).json();
    expect(beginner.top).toEqual([expect.objectContaining({ nickname: 'sweeper', score: 20 })]);
    expect(beginner.totalPlayers).toBe(1); expect(beginner.totalScores).toBe(2);
    const expert = await (await fetch(`${base}/api/scores/minesweeper?difficulty=expert`)).json();
    expect(expert.top).toEqual([expect.objectContaining({ nickname: 'Sweeper', score: 60 })]);
    expect((await (await fetch(`${base}/api/scores/minesweeper?difficulty=intermediate`)).json()).top).toEqual([]);
  } finally { clock.mockRestore(); }
});
it('caps the board at ten distinct names without deleting historical rounds', async () => {
  const path = join(dataDir, 'scores.json'); const previous = await readFile(path, 'utf8');
  try {
    // Isolated listing fixture, never written to application/public score data.
    const fixture = Array.from({ length: 14 }, (_, i) => ({ id: `test-${i}`, game: 'bounce', nickname: `Test ${i}`, score: i * 10, createdAt: '2026-01-01T00:00:00.000Z' }));
    fixture.push({ ...fixture[13]!, id: 'duplicate', nickname: 'TEST 13', score: 140 });
    await writeFile(path, JSON.stringify(fixture));
    const board = await (await fetch(`${base}/api/scores/bounce`)).json();
    expect(board.top).toHaveLength(10);
    expect(board.top.map((entry: { score: number }) => entry.score)).toEqual([140, 120, 110, 100, 90, 80, 70, 60, 50, 40]);
    expect(board.totalPlayers).toBe(14); expect(board.totalScores).toBe(15);
  } finally { await writeFile(path, previous); }
});
it('binds classic completion and score submission to the original client identity', async () => {
  const originalTime = Date.now();
  const { token } = await start('solitaire');
  const clock = vi.spyOn(Date, 'now').mockReturnValue(originalTime + 30_000);
  const identity = await import('./clientAddress');
  const body = { token, completed: true, durationMs: 30_000, nickname: 'BoundPlayer', score: 2290 };
  try {
    const different = vi.spyOn(identity, 'clientRateKey').mockReturnValue('different-client-key');
    try { expect((await complete('solitaire', body)).status).toBe(403); }
    finally { different.mockRestore(); }
    expect((await complete('solitaire', body)).status).toBe(200);
    const stolen = vi.spyOn(identity, 'clientRateKey').mockReturnValue('different-client-key');
    try { expect((await submit('solitaire', body)).status).toBe(403); }
    finally { stolen.mockRestore(); }
    expect((await submit('solitaire', body)).status).toBe(201);
  } finally { clock.mockRestore(); }
});
it('retains same-origin, score rate limits, and bounded round-start protection', async () => {
  expect((await fetch(`${base}/api/scores/solitaire/start`, { method: 'POST', headers: { origin: 'https://other.example' } })).status).toBe(403);
  let time = Date.now(); const clock = vi.spyOn(Date, 'now').mockImplementation(() => time);
  try {
    let rateLimited = false;
    for (let i = 0; i < 13; i++) {
      const { token } = await start('bounce'); time += 1000;
      const result = await submit('bounce', { token, nickname: 'RateTest', score: 10 });
      if (result.status === 429) { rateLimited = true; break; }
      expect(result.status).toBe(201);
    }
    expect(rateLimited).toBe(true);
    let startLimited = false;
    for (let i = 0; i < 121; i++) {
      const result = await fetch(`${base}/api/scores/solitaire/start`, { method: 'POST' });
      if (result.status === 429) { startLimited = true; break; }
      expect(result.status).toBe(200);
    }
    expect(startLimited).toBe(true);
  } finally { clock.mockRestore(); }
});
