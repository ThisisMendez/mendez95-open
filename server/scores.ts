import {leaderboardDisplay} from './leaderboardDisplay';
import {sampleScores} from './sampleData';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { profanity } from '@2toad/profanity';
import type { Express, Request } from 'express';
import { sameOrigin } from './origin';
import { clientRateKey } from './clientAddress';
import { elapsedSeconds, isMineDifficulty, solitaireWinScore, type MineDifficulty } from '../src/apps/games/classic/scoring';

type GameId = 'snake' | 'bounce' | 'solitaire' | 'minesweeper';
type Score = { id: string; game: GameId; nickname: string; score: number; createdAt: string; difficulty?: MineDifficulty; durationMs?: number };
type Round = { game: GameId; start: number; address: string; difficulty?: MineDifficulty; completedDuration?: number };
const dir = resolve(process.env.MENDEZ_OS_DATA_DIR || join(process.cwd(), '.local'));
const file = join(dir, 'scores.json');
const rounds = new Map<string, Round>();
const attempts = new Map<string, { count: number; reset: number }>();
const starts = new Map<string, { count: number; reset: number }>();
const rateSalt = randomBytes(24);
let queue: Promise<unknown> = Promise.resolve();
const validGame = (value: string): value is GameId => value === 'snake' || value === 'bounce' || value === 'solitaire' || value === 'minesweeper';
async function readScores(): Promise<Score[]> {
  try { const data: unknown = JSON.parse(await readFile(file, 'utf8')); if (!Array.isArray(data)) throw new Error('Malformed score data'); return data as Score[]; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}
async function persist(scores: Score[]) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const temp = `${file}.${randomBytes(8).toString('hex')}.tmp`;
  await writeFile(temp, JSON.stringify(scores, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(temp, file);
}
function transact<T>(fn: (scores: Score[]) => Promise<T>): Promise<T> {
  const operation = queue.then(async () => fn(await readScores()));
  queue = operation.catch(() => undefined);
  return operation;
}
function address(req: Request) { return clientRateKey(req, rateSalt); }
function rateLimit(req: Request, bucket = attempts, maximum = 12) {
  const key = address(req), now = Date.now();
  for (const [client, item] of bucket) if (item.reset <= now) bucket.delete(client);
  if (!bucket.has(key) && bucket.size >= 10_000) return false;
  const item = bucket.get(key) || { count: 0, reset: now + 3_600_000 };
  if (now >= item.reset) { item.count = 0; item.reset = now + 3_600_000; }
  if (item.count >= maximum) return false;
  item.count++; bucket.set(key, item);
  return true;
}
function nickname(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (/[<>]/.test(value)) return null;
  const name = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 20 || !/^[\p{L}\p{N} _.-]+$/u.test(name)) return null;
  try { if (profanity.exists(name)) return null; } catch { return null; }
  return name;
}
function listing(scores: Score[], game: GameId, difficulty?: MineDifficulty) {
  const matching = scores.filter(item => item.game === game && (game !== 'minesweeper' || item.difficulty === difficulty));
  const sorted = [...matching].sort((a, b) => (game === 'minesweeper' ? a.score - b.score : b.score - a.score) || a.createdAt.localeCompare(b.createdAt));
  const seen = new Set<string>();
  const players = sorted.filter(entry => {
    const key = entry.nickname.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const top=players.slice(0,10).map(({id,nickname,score,createdAt})=>({id,nickname,score,createdAt})),demo=sampleScores(game,difficulty);
  return { displayTop:leaderboardDisplay(top,demo,game==='minesweeper'),sampleTop:demo, top, totalScores: matching.length, totalPlayers: players.length, allGamesTotal: scores.length };
}
function difficultyFor(game: GameId, value: unknown): MineDifficulty | undefined | null {
  if (game !== 'minesweeper') return value === undefined ? undefined : null;
  return isMineDifficulty(value) ? value : null;
}
function completedScore(game: GameId, body: Record<string, unknown>): boolean {
  const value = body.score;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return false;
  if (game === 'snake' || game === 'bounce') return value % 10 === 0 && value <= (game === 'snake' ? 3970 : 320);
  const duration = body.durationMs;
  if (body.completed !== true || typeof duration !== 'number' || !Number.isInteger(duration) || duration < 1 || duration > 30 * 60_000) return false;
  return value === (game === 'minesweeper' ? elapsedSeconds(duration) : solitaireWinScore(duration));
}
export function mountScoreRoutes(app: Express) {
  app.get('/api/scores/:game', async (req, res) => {
    if (!validGame(req.params.game)) { res.status(404).json({ error: 'Game not found.' }); return; }
    const difficulty = difficultyFor(req.params.game, req.query.difficulty);
    if (difficulty === null) { res.status(400).json({ error: 'Choose beginner, intermediate, or expert difficulty.' }); return; }
    try { res.setHeader('Cache-Control', 'no-store'); res.json(listing(await readScores(), req.params.game, difficulty)); }
    catch { res.status(500).json({ error: 'Scores are unavailable.' }); }
  });
  app.post('/api/scores/:game/start', (req, res) => {
    if (!validGame(req.params.game)) { res.status(404).json({ error: 'Game not found.' }); return; }
    if (!sameOrigin(req)) { res.status(403).json({ error: 'Origin not allowed.' }); return; }
    const difficulty = difficultyFor(req.params.game, req.body?.difficulty);
    if (difficulty === null) { res.status(400).json({ error: 'Choose beginner, intermediate, or expert difficulty.' }); return; }
    const now = Date.now();
    for (const [token, round] of rounds) if (now - round.start > 30 * 60_000) rounds.delete(token);
    if (rounds.size >= 10_000) { res.status(503).json({ error: 'Score service is busy.' }); return; }
    if (!rateLimit(req, starts, 120)) { res.status(429).json({ error: 'Too many round starts. Try again later.' }); return; }
    const token = randomBytes(24).toString('base64url');
    rounds.set(token, { game: req.params.game, start: now, address: address(req), difficulty });
    res.setHeader('Cache-Control', 'no-store'); res.json({ token });
  });
  // A completion checkpoint freezes timing without publishing a score or nickname.
  app.post('/api/scores/:game/complete', (req, res) => {
    if (req.params.game !== 'solitaire' && req.params.game !== 'minesweeper') { res.status(404).json({ error: 'Game not found.' }); return; }
    if (!sameOrigin(req)) { res.status(403).json({ error: 'Origin not allowed.' }); return; }
    const duration = req.body?.durationMs, token = req.body?.token;
    const difficulty = difficultyFor(req.params.game, req.body?.difficulty);
    if (difficulty === null || req.body?.completed !== true || typeof duration !== 'number' || !Number.isInteger(duration) || duration < 1 || duration > 30 * 60_000) {
      res.status(400).json({ error: 'A completed round and valid duration are required.' }); return;
    }
    const round = typeof token === 'string' ? rounds.get(token) : undefined;
    if (!round || round.game !== req.params.game || round.address !== address(req) || round.difficulty !== difficulty) { res.status(403).json({ error: 'Round token is invalid or already used.' }); return; }
    const elapsed = Date.now() - round.start;
    if (round.completedDuration !== undefined) {
      if (round.completedDuration === duration && elapsed <= 30 * 60_000) { res.json({ completed: true }); return; }
      res.status(422).json({ error: 'This round is already complete.' }); return;
    }
    if (elapsed < 250 || elapsed > 30 * 60_000 || Math.abs(duration - elapsed) > 5000) {
      rounds.delete(token); res.status(422).json({ error: 'Completion time does not match this round.' }); return;
    }
    round.completedDuration = duration;
    res.setHeader('Cache-Control', 'no-store'); res.json({ completed: true });
  });
  app.post('/api/scores/:game', async (req, res) => {
    if (!validGame(req.params.game)) { res.status(404).json({ error: 'Game not found.' }); return; }
    if (!sameOrigin(req)) { res.status(403).json({ error: 'Origin not allowed.' }); return; }
    const name = nickname(req.body?.nickname), value = req.body?.score, token = req.body?.token;
    const difficulty = difficultyFor(req.params.game, req.body?.difficulty);
    if (!name || difficulty === null || !completedScore(req.params.game, req.body || {})) {
      res.status(400).json({ error: 'Enter a valid nickname and completed score.' }); return;
    }
    if (typeof token !== 'string') { res.status(400).json({ error: 'Start a round first.' }); return; }
    const round = rounds.get(token);
    if (!round || round.game !== req.params.game || round.address !== address(req) || round.difficulty !== difficulty) { res.status(403).json({ error: 'Round token is invalid or already used.' }); return; }
    if ((req.params.game === 'solitaire' || req.params.game === 'minesweeper') && round.completedDuration !== req.body.durationMs) { res.status(422).json({ error: 'Complete this round before submitting its score.' }); return; }
    rounds.delete(token);
    const elapsed = Date.now() - round.start;
    const minimum = value > 0 && req.params.game === 'bounce' ? 500 : 250;
    if (elapsed < minimum || elapsed > 30 * 60_000 || (req.params.game === 'snake' && value > Math.floor(elapsed / 125) * 10)) {
      res.status(422).json({ error: 'Score does not match a completed round.' }); return;
    }
    if (!rateLimit(req)) { res.status(429).json({ error: 'Too many scores. Play again later.' }); return; }
    const entry: Score = { id: randomBytes(12).toString('hex'), game: req.params.game, nickname: name, score: value, createdAt: new Date().toISOString(), ...(difficulty ? { difficulty } : {}), ...((req.params.game === 'solitaire' || req.params.game === 'minesweeper') ? { durationMs: req.body.durationMs } : {}) };
    try {
      const result = await transact(async scores => { scores.push(entry); await persist(scores); return listing(scores, req.params.game as GameId, difficulty); });
      res.status(201).json({ ...result, entry });
    } catch { res.status(500).json({ error: 'Score could not be saved.' }); }
  });
}
