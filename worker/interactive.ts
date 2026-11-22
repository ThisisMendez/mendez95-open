import { profanity } from '@2toad/profanity';
import { screenBoardNote } from '../server/boardScreening';
import { sampleNotes, sampleScores } from '../server/sampleData';
import { leaderboardDisplay, normalizedNickname } from '../server/leaderboardDisplay';
import { isCharacter, isColor, noteAppearance } from '../src/apps/board/appearance';
import { elapsedSeconds, isMineDifficulty, solitaireWinScore } from '../src/apps/games/classic/scoring';
import { body, fail, hash, json, randomToken, requireOrigin, type Env } from './env';
import { owner } from './security';
import { Repository } from './storage';
const plain = (v: unknown, max: number, multi = false) => { if (typeof v !== 'string')
    return null; const value = v.normalize('NFKC').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, ' ').replace(/<[^>]*>/g, '').replace(/[<>]/g, '').replace(multi ? /[^\S\n]+/g : /\s+/g, ' ').trim(); return value.length >= 2 && value.length <= max ? value : null; };
function publicNote(raw: any) { return { ...noteAppearance(raw), id: raw.id, name: raw.name || 'Visitor', text: raw.text, x: raw.x, y: raw.y, createdAt: raw.createdAt, ...(raw.sample ? { sample: true } : {}) }; }
export async function boardRoute(r: Request, env: Env, repo: Repository): Promise<Response | null> {
    const p = new URL(r.url).pathname;
    if (p === '/api/board' && r.method === 'GET') {
        const notes = (await env.DB.prepare('SELECT json,x,y,origin FROM notes WHERE status=? ORDER BY created_at LIMIT 2000').bind('published').all<{
            json: string;
            x: number;
            y: number;
            origin: string;
        }>()).results.map(row => publicNote({ ...JSON.parse(row.json), x: row.x, y: row.y, ...(row.origin === 'sample' ? { sample: true } : {}) }));
        return json({ publishedCount: notes.filter(n => !n.sample).length, notes });
    }
    if (p === '/api/board' && r.method === 'POST') {
        requireOrigin(r);
        const b = await body(r), name = b.name === undefined || b.name === '' ? 'Visitor' : plain(b.name, 30), text = plain(b.text, 280, true), characterId = b.characterId ?? 'scout', colorId = b.colorId ?? 'teal';
        if (!name || !text || !isCharacter(characterId) || !isColor(colorId))
            fail(400, 'Use a valid name, note, character and color.');
        const key = await repo.limit(r, 'board-post', 4, 3600000);
        let screened = false;
        try {
            screened = screenBoardNote(name, text);
        }
        catch {
            return json({ error: 'Screening is unavailable. Nothing was published; please retry later.' }, 503);
        }
        if (!screened)
            fail(422, 'This note needs a rewrite. Please avoid harmful language, links, or repeated text.');
        const now = new Date().toISOString(), clamp = (v: unknown, f: number) => typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(0, Math.min(1200, v))) : f;
        const note = { id: randomToken().slice(0, 24), name, text, characterId, colorId, x: clamp(b.x, 260), y: clamp(b.y, 240), status: 'published', createdAt: now, updatedAt: now };
        await env.DB.prepare('INSERT INTO notes VALUES(?,?,?,?,?,?,?,?)').bind(note.id, 'published', 'actual', note.x, note.y, now, JSON.stringify(note), key).run().catch(() => fail(503, 'Storage is unavailable. Nothing was published.'));
        return json({ note: publicNote(note) }, 201);
    }
    const position = new URL(r.url).pathname.match(/^\/api\/board\/([^/]+)\/position$/);
    if (position && r.method === 'PATCH') {
        requireOrigin(r);
        const b = await body(r);
        if (![b.x, b.y].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1200))
            fail(400, 'Use a position inside the board.');
        await repo.limit(r, 'board-move', 60, 60000);
        const row = await env.DB.prepare("UPDATE notes SET x=?,y=?,json=json_set(json,'$.updatedAt',?) WHERE id=? AND status=? RETURNING json,origin,x,y").bind(Math.round(b.x), Math.round(b.y), new Date().toISOString(), position[1], 'published').first<{
            json: string;
            origin: string;
            x: number;
            y: number;
        }>();
        if (!row)
            fail(404, 'Published note not found.');
        return json({ note: publicNote({ ...JSON.parse(row.json), x: row.x, y: row.y, sample: row.origin === 'sample' }) });
    }
    const report = p.match(/^\/api\/board\/([^/]+)\/report$/);
    if (report && r.method === 'POST') {
        requireOrigin(r);
        const { key } = await repo.identity(r);
        await repo.limit(r, `report:${report[1]}`, 1, 86400000);
        const now = new Date().toISOString();
        const result = await env.DB.prepare('INSERT OR IGNORE INTO reports SELECT ?,id,?,? FROM notes WHERE id=? AND status=? AND origin=?').bind(crypto.randomUUID(), now, key, report[1], 'published', 'actual').run();
        if (!result.meta.changes)
            fail(404, 'Note not found.');
        return json({ reported: true }, 202);
    }
    if (p === '/api/board/moderation' && r.method === 'GET') {
        await owner(r, env);
        const rows = (await env.DB.prepare("SELECT n.json,n.x,n.y,(SELECT count(*) FROM reports WHERE note_id=n.id) AS reports FROM notes n WHERE status='published' AND origin='actual' LIMIT 2000").all<{
            json: string;
            x: number;
            y: number;
            reports: number;
        }>()).results;
        return json({ notes: rows.map(v => ({ ...publicNote({ ...JSON.parse(v.json), x: v.x, y: v.y }), reports: v.reports })) });
    }
    const remove = p.match(/^\/api\/board\/moderation\/([^/]+)$/);
    if (remove && r.method === 'DELETE') {
        await owner(r, env, true);
        const result = await env.DB.prepare("UPDATE notes SET status='removed',json=json_set(json,'$.status','removed','$.updatedAt',?) WHERE id=? AND status='published' AND origin='actual'").bind(new Date().toISOString(), remove[1]).run();
        if (!result.meta.changes)
            fail(404, 'Published note not found.');
        return json({ removed: true });
    }
    return null;
}
const games = ['snake', 'bounce', 'solitaire', 'minesweeper'];
export async function scoreListing(env: Env, game: string, difficulty = '') {
    const lower = game === 'minesweeper';
    const rows = (await env.DB.prepare(`SELECT json FROM (SELECT json,score,created_at,ROW_NUMBER() OVER(PARTITION BY nickname_key ORDER BY score ${lower ? 'ASC' : 'DESC'},created_at,id) AS rank FROM scores WHERE game=? AND difficulty=? AND origin='actual') WHERE rank=1 ORDER BY score ${lower ? 'ASC' : 'DESC'},created_at LIMIT 10`).bind(game, difficulty).all<{
        json: string;
    }>()).results;
    const top = rows.map(row => { const v = JSON.parse(row.json); return { id: v.id, nickname: v.nickname, score: v.score, createdAt: v.createdAt }; });
    const stats = await env.DB.prepare("SELECT count(*) AS totalScores,count(DISTINCT nickname_key) AS totalPlayers FROM scores WHERE game=? AND difficulty=? AND origin='actual'").bind(game, difficulty).first<{
        totalScores: number;
        totalPlayers: number;
    }>();
    const all = await env.DB.prepare("SELECT count(*) AS count FROM scores WHERE origin='actual'").first<{
        count: number;
    }>();
    const samples = (await env.DB.prepare("SELECT json FROM scores WHERE game=? AND difficulty=? AND origin='sample' ORDER BY score LIMIT 10").bind(game, difficulty).all<{
        json: string;
    }>()).results.map(v => JSON.parse(v.json));
    return { top, sampleTop: samples, displayTop: leaderboardDisplay(top, samples, lower), ...stats, allGamesTotal: all!.count };
}
export async function scoresRoute(r: Request, env: Env, repo: Repository): Promise<Response | null> {
    const m = new URL(r.url).pathname.match(/^\/api\/scores\/([^/]+)(?:\/(start|complete))?$/);
    if (!m)
        return null;
    const game = m[1], action = m[2];
    if (!games.includes(game))
        fail(404, 'Game not found.');
    if (r.method === 'GET' && !action) {
        const d = new URL(r.url).searchParams.get('difficulty') ?? undefined;
        if (game === 'minesweeper' ? !isMineDifficulty(d) : d !== undefined)
            fail(400, 'Choose beginner, intermediate, or expert difficulty.');
        return json(await scoreListing(env, game, d || ''));
    }
    if (r.method !== 'POST')
        return null;
    requireOrigin(r);
    const b = await body(r), difficulty = b.difficulty ?? '';
    if (game === 'minesweeper' ? !isMineDifficulty(difficulty) : difficulty !== '')
        fail(400, 'Choose a valid difficulty.');
    const { key } = await repo.identity(r), now = Date.now();
    if (action === 'start') {
        await repo.limit(r, 'round-start', 120, 3600000);
        const token = randomToken();
        await env.DB.prepare('INSERT INTO rounds(token_hash,game,difficulty,visitor_hash,started_at,expires_at) VALUES(?,?,?,?,?,?)').bind(await hash(token), game, difficulty, key, now, now + 1800000).run();
        return json({ token });
    }
    if (typeof b.token !== 'string' || b.token.length > 100)
        fail(400, 'Start a round first.');
    const tokenHash = await hash(b.token);
    const round = await env.DB.prepare('SELECT started_at,completed_duration FROM rounds WHERE token_hash=? AND game=? AND difficulty=? AND visitor_hash=? AND consumed=0 AND expires_at>?').bind(tokenHash, game, difficulty, key, now).first<{
        started_at: number;
        completed_duration: number | null;
    }>();
    if (!round)
        fail(403, 'Round token is invalid or already used.');
    const elapsed = now - round.started_at, classic = game === 'solitaire' || game === 'minesweeper';
    const durationValid = b.completed === true && Number.isInteger(b.durationMs) && b.durationMs >= 1 && b.durationMs <= 1800000;
    if (action === 'complete') {
        if (!classic)
            fail(404, 'Game not found.');
        if (!durationValid)
            fail(400, 'A completed round and valid duration are required.');
        if (round.completed_duration !== null) {
            if (round.completed_duration === b.durationMs)
                return json({ completed: true });
            fail(422, 'This round is already complete.');
        }
        if (elapsed < 250 || Math.abs(b.durationMs - elapsed) > 5000)
            fail(422, 'Completion time does not match this round.');
        const changed = await env.DB.prepare('UPDATE rounds SET completed_duration=? WHERE token_hash=? AND consumed=0 AND completed_duration IS NULL RETURNING token_hash').bind(b.durationMs, tokenHash).first();
        if (!changed)
            fail(409, 'Round changed. Retry once.');
        return json({ completed: true });
    }
    const name = plain(b.nickname, 20);
    let nameAllowed = false;
    try {
        nameAllowed = Boolean(name && /^[\p{L}\p{N} _.-]+$/u.test(name) && !/[<>]/.test(b.nickname) && !profanity.exists(name));
    }
    catch { /* fail closed */ }
    const value = b.score;
    if (!nameAllowed || !Number.isInteger(value) || value < 0 || (classic ? (!durationValid || value !== (game === 'minesweeper' ? elapsedSeconds(b.durationMs) : solitaireWinScore(b.durationMs))) : value % 10 !== 0 || value > (game === 'snake' ? 3970 : 320)))
        fail(400, 'Enter a valid nickname and completed score.');
    if (classic && round.completed_duration !== b.durationMs)
        fail(422, 'Complete this round before submitting its score.');
    if (elapsed < (game === 'bounce' && value > 0 ? 500 : 250) || elapsed > 1800000 || (game === 'snake' && value > Math.floor(elapsed / 125) * 10))
        fail(422, 'Score does not match a completed round.');
    await repo.limit(r, 'score-submit', 12, 3600000);
    const entry = { id: randomToken().slice(0, 24), game, nickname: name!, score: value, createdAt: new Date().toISOString(), ...(difficulty ? { difficulty } : {}), ...(classic ? { durationMs: b.durationMs } : {}) };
    // A UNIQUE round hash + INSERT..SELECT inside an atomic D1 batch owns consumption.
    const result = await env.DB.batch([env.DB.prepare("INSERT INTO scores(id,round_hash,game,difficulty,nickname_key,score,created_at,origin,json) SELECT ?,token_hash,game,difficulty,?,?,?,'actual',? FROM rounds WHERE token_hash=? AND consumed=0 AND expires_at>? ON CONFLICT(round_hash) DO NOTHING").bind(entry.id, normalizedNickname(name!), value, entry.createdAt, JSON.stringify(entry), tokenHash, now), env.DB.prepare('UPDATE rounds SET consumed=1 WHERE token_hash=? AND EXISTS(SELECT 1 FROM scores WHERE round_hash=?)').bind(tokenHash, tokenHash)]);
    if (!result[0].meta.changes)
        fail(403, 'Round token is invalid or already used.');
    return json({ ...await scoreListing(env, game, difficulty), entry }, 201);
}
