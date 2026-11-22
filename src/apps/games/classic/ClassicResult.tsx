import { useId } from 'react';
import { useGameScores } from '../Scoreboard';
export function ClassicResult({ scores, score, durationMs, children }: { scores: ReturnType<typeof useGameScores>; score: number; durationMs: number; children: React.ReactNode }) {
  const id = useId();
  return <section className="classic-result" aria-label="Completed game"><strong role="status">{children}</strong><p role="status">{scores.submitted ? 'Score submitted.' : scores.completionStatus}</p>{scores.completionState === 'retry' && <button type="button" onClick={scores.retryCompletion}>Retry completion</button>}<form onSubmit={event => { event.preventDefault(); void scores.finish(score, { completed: true, durationMs }); }}><label htmlFor={id}>Name (optional)</label><div><input id={id} autoComplete="nickname" maxLength={20} value={scores.nickname} placeholder="Player" onChange={event => scores.setNickname(event.target.value)} disabled={scores.submitted || scores.submitting} /><button type="submit" disabled={!scores.canSubmit || scores.submitted || scores.submitting}>{scores.submitted ? 'Submitted' : scores.submitting ? 'Saving…' : 'Submit score'}</button></div></form></section>;
}
