import {getVisitorName,setVisitorName,useVisitorName} from '../../desktop/visitorIdentity';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import type { MineDifficulty } from './classic/scoring';
export type GameId = 'snake' | 'bounce' | 'solitaire' | 'minesweeper';
type CompletionState = 'idle' | 'waiting' | 'confirming' | 'retry' | 'confirmed' | 'local';
type Completion = { completed: true; durationMs: number };
type Entry = { id: string; nickname: string; score: number; createdAt: string; sample?:boolean };
type Listing = { displayTop?:Entry[]; sampleTop?:Entry[]; top: Entry[]; totalScores: number; totalPlayers?: number; allGamesTotal: number };
function initialName(){const name=getVisitorName();return name==='Visitor'?'':name.slice(0,20);}

export function useGameScores(game: GameId, difficulty?: MineDifficulty) {
  const [visitorName]=useVisitorName();
  const [nickname, setNicknameState] = useState(initialName);
  const setNickname=(value:string)=>{setNicknameState(value);setVisitorName(value);};
  useEffect(()=>setNicknameState(current=>(current.trim()||'Visitor')===visitorName?current:visitorName==='Visitor'?'':visitorName.slice(0,20)),[visitorName]);
  const [listing, setListing] = useState<Listing | null>(null);
  const [status, setStatus] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [completionState, setCompletionState] = useState<CompletionState>('idle');
  const [completionStatus, setCompletionStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const token = useRef<string | null>(null);
  const startRequest = useRef(0);
  const startAbort = useRef<AbortController | null>(null);
  const completionAbort = useRef<AbortController | null>(null);
  const sealingEpoch = useRef<number | null>(null);
  const tokenReadyAt = useRef(0);
  const pendingCompletion = useRef<number | null>(null);
  const listingRequest = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++listingRequest.current;
    try {
      const response = await fetch(`/api/scores/${game}${difficulty ? `?difficulty=${difficulty}` : ''}`, { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (request === listingRequest.current) setListing(result);
    } catch { if (request === listingRequest.current) setStatus('Global scores are unavailable; you can still play locally.'); }
  }, [game, difficulty]);
  useEffect(() => { setListing(null); void refresh(); }, [refresh]);
  const reset = useCallback(() => { startRequest.current++; startAbort.current?.abort(); completionAbort.current?.abort(); sealingEpoch.current = null; token.current = null; pendingCompletion.current = null; setStatus(''); setCompletionState('idle'); setCompletionStatus(''); setSubmitted(false); setCanSubmit(false); }, []);
  useEffect(() => { reset(); }, [game, difficulty, reset]);
  useEffect(() => () => { startRequest.current++; listingRequest.current++; startAbort.current?.abort(); completionAbort.current?.abort(); }, []);
  const sealRound = useCallback(async (roundToken: string, durationMs: number, requestId: number) => {
    if (requestId !== startRequest.current || sealingEpoch.current === requestId) return;
    sealingEpoch.current = requestId;
    setCanSubmit(false); setCompletionState('confirming'); setCompletionStatus('Confirming your completed round. No score has been submitted.');
    // Every retry uses the exact original token and frozen duration. The server's
    // idempotent checkpoint can recover a response lost after it accepted the win.
    const body = JSON.stringify({ token: roundToken, completed: true, durationMs, ...(difficulty ? { difficulty } : {}) });
    try {
      const delay = Math.max(0, 300 - (performance.now() - tokenReadyAt.current));
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      for (let attempt = 0; attempt < 2; attempt++) {
        if (requestId !== startRequest.current) return;
        const controller = new AbortController(); completionAbort.current = controller;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const request = fetch(`/api/scores/${game}/complete`, { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: controller.signal }).then(async response => ({ response, data: await response.json() }));
          const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Completion confirmation timed out.')); }, 2000); });
          const { response, data } = await Promise.race([request, timeout]);
          if (requestId !== startRequest.current) return;
          if (response.ok && data?.completed === true) {
            setCanSubmit(true); setCompletionState('confirmed'); setCompletionStatus('Completion confirmed. Submit your score only if you wish.'); return;
          }
          if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
            setCompletionState('local'); setCompletionStatus(`${typeof data?.error === 'string' ? data.error : 'Completion was not accepted.'} Your win remains local; no score was submitted.`); return;
          }
          throw new Error('Completion confirmation is unavailable.');
        } catch {
          if (requestId !== startRequest.current) return;
          if (attempt === 1) {
            setCompletionState('retry'); setCompletionStatus('Completion could not be confirmed. No score was submitted. Retry confirmation to check this same round.'); return;
          }
        } finally {
          if (timer) clearTimeout(timer);
          if (completionAbort.current === controller) completionAbort.current = null;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    } finally { if (sealingEpoch.current === requestId) sealingEpoch.current = null; }
  }, [game, difficulty]);
  const complete = useCallback((durationMs: number) => {
    if (pendingCompletion.current !== null) return;
    pendingCompletion.current = durationMs;
    if (token.current) void sealRound(token.current, durationMs, startRequest.current);
    else if (startAbort.current) { setCompletionState('waiting'); setCompletionStatus('Connecting to confirm your completed round. No score has been submitted.'); }
    else { setCompletionState('local'); setCompletionStatus('This win is local only because the score service was unavailable at the start.'); }
  }, [sealRound]);
  const retryCompletion = useCallback(() => {
    if (completionState === 'retry' && token.current && pendingCompletion.current !== null) void sealRound(token.current, pendingCompletion.current, startRequest.current);
  }, [completionState, sealRound]);
  const begin = useCallback(async () => {
    const requestId = ++startRequest.current;
    startAbort.current?.abort(); completionAbort.current?.abort(); sealingEpoch.current = null; pendingCompletion.current = null; setCompletionState('idle'); setCompletionStatus('');
    const controller = new AbortController();
    startAbort.current = controller;
    token.current = null; setStatus(''); setSubmitted(false); setCanSubmit(false);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = fetch(`/api/scores/${game}/start`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(difficulty ? { difficulty } : {}), signal: controller.signal }).then(async response => {
        if (!response.ok) throw new Error('Score service unavailable');
        const data: unknown = await response.json();
        return data && typeof data === 'object' && typeof (data as { token?: unknown }).token === 'string' ? (data as { token: string }).token : null;
      });
      const timeout = new Promise<null>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(null); }, 3000); });
      const roundToken = await Promise.race([request, timeout]);
      if (requestId !== startRequest.current) return false;
      if (roundToken && /^[A-Za-z0-9_-]{20,80}$/.test(roundToken)) { token.current = roundToken; tokenReadyAt.current = performance.now();
        if (game === 'snake' || game === 'bounce') setCanSubmit(true);
        else if (pendingCompletion.current !== null) void sealRound(roundToken, pendingCompletion.current, requestId); }
      else { setStatus('Global scores are unavailable; local play continues.'); if (pendingCompletion.current !== null) { setCompletionState('local'); setCompletionStatus('This win is local only because the score service was unavailable at the start.'); } }
      return true;
    } catch {
      if (requestId !== startRequest.current) return false;
      setStatus('Global scores are unavailable; local play continues.');
      if (pendingCompletion.current !== null) { setCompletionState('local'); setCompletionStatus('This win is local only because the score service was unavailable at the start.'); }
      return true;
    } finally {
      if (timer) clearTimeout(timer);
      if (startAbort.current === controller) startAbort.current = null;
    }
  }, [game, difficulty, sealRound]);
  const finish = useCallback(async (score: number, completion?: Completion) => {
    const requestId = startRequest.current;
    const roundToken = token.current;
    if (submittingRef.current || submitted) return;
    if ((game === 'solitaire' || game === 'minesweeper') && !canSubmit) return;
    if (!roundToken) { setStatus('This round is local only. Play again to reconnect to global scores.'); return; }
    if (nickname.trim() && nickname.trim().length < 2) { setStatus('Use at least two characters, or leave the name blank.'); return; }
    submittingRef.current = true; setSubmitting(true);
    try {
      const response = await fetch(`/api/scores/${game}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: roundToken, nickname: nickname.trim() || 'Player', score, ...completion, ...(difficulty ? { difficulty } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Global score could not be saved.');
      if (requestId === startRequest.current) { token.current = null; listingRequest.current++; setListing(data); setSubmitted(true); setStatus('Score saved to the global board.'); }
    } catch (error) { if (requestId === startRequest.current) setStatus(error instanceof Error ? error.message : 'Global score could not be saved.'); }
    finally { submittingRef.current = false; setSubmitting(false); }
  }, [game, difficulty, nickname, submitted, canSubmit]);
  return { nickname, setNickname, listing, status, submitted, submitting, canSubmit, begin, finish, refresh, reset, complete, retryCompletion, completionState, completionStatus, game, difficulty };
}

export function RoundOver({ scores, score, status, restart }: { scores: ReturnType<typeof useGameScores>; score: number; status: string; restart: () => void }) {
  const id = useId();
  return <div className="m-game-over"><strong>{status}</strong><b>{score}</b><form onSubmit={event => { event.preventDefault(); void scores.finish(score); }}><label htmlFor={id}>Name (optional)</label><div><input id={id} value={scores.nickname} onChange={event => scores.setNickname(event.target.value)} maxLength={20} autoComplete="nickname" placeholder="Player" disabled={scores.submitted || scores.submitting} /><button type="submit" disabled={scores.submitted || scores.submitting || !scores.canSubmit}>{scores.submitted ? 'Submitted' : scores.submitting ? 'Saving…' : 'Submit'}</button></div></form>{scores.status && <p role="status">{scores.status}</p>}<button type="button" onClick={restart} disabled={scores.submitting}>Play Again</button></div>;
}

export function Scoreboard({ scores }: { scores: ReturnType<typeof useGameScores> }) {
  const rows=scores.listing?.displayTop||scores.listing?.top;
  return <section className="m-game-leaderboard" aria-label="High Scores"><div className="m-game-leaderboard-head"><h3>High Scores</h3><button type="button" aria-label="Refresh scores" onClick={()=>void scores.refresh()}>↻</button></div>{rows?.length?<ol>{rows.map(entry=><li key={entry.id}><span>{entry.nickname}</span><strong>{entry.score}{scores.game==='minesweeper'?'s':''}</strong></li>)}</ol>:<p>No scores yet. Finish a round to start the board.</p>}{scores.status&&<p role="status">{scores.status}</p>}<small>Best per name{scores.game==='minesweeper'?' · lowest clear time':''}. Names are unverified.</small></section>;
}
