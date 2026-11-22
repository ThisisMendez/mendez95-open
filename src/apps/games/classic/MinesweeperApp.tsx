import {recordPersonalBest} from '../personalBest';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {usePocketMode} from '../../../pocket/layout';
import { Scoreboard, useGameScores } from '../Scoreboard';
import { ClassicResult } from './ClassicResult';
import { useRoundClock } from './useRoundClock';
import { elapsedSeconds, MINE_DIFFICULTIES, type MineDifficulty } from './scoring';
import { chordCell, newMines, revealCell, toggleFlag } from './minesweeper';
import './classic.css';
import {ExpandPlay} from '../ExpandPlay';
import {useGameLifecycle} from '../useGameLifecycle';
export function MinesweeperApp() {
  const root=useRef<HTMLDivElement>(null);
  const [expanded,setExpanded]=useState(false);
  const [difficulty, setDifficulty] = useState<MineDifficulty>('beginner');
  const [state, setState] = useState(() => newMines('beginner'));
  const [flagMode, setFlagMode] = useState(false);
  const [focused, setFocused] = useState(0);
  const grid = useRef<HTMLDivElement>(null);
  const scroll=useRef<HTMLDivElement>(null);
  const pocket=usePocketMode();
  const [fieldHeight,setFieldHeight]=useState<number|null>(null);
  useEffect(()=>{
    if(!pocket){setFieldHeight(null);return;}
    const surface=scroll.current;if(!surface)return;
    const body=surface.closest('.os-window-body');
    const fit=()=>{const bottom=body?.getBoundingClientRect().bottom??window.innerHeight;setFieldHeight(Math.max(160,Math.floor(bottom-surface.getBoundingClientRect().top-44)));};
    const observer=body?new ResizeObserver(fit):null;if(body)observer?.observe(body);fit();window.addEventListener('resize',fit);
    return()=>{observer?.disconnect();window.removeEventListener('resize',fit);};
  },[pocket,expanded,difficulty]);
  const scores = useGameScores('minesweeper', difficulty);
  const clock = useRoundClock();
  useGameLifecycle(root,'/games/minesweeper',()=>{},clock.setVisible);
  const finished = state.status === 'won' || state.status === 'lost';
  function reset(nextDifficulty = difficulty) {
    if (scores.submitting) return;
    setDifficulty(nextDifficulty); setState(newMines(nextDifficulty)); setFocused(0); clock.reset(); scores.reset();
  }
  function reveal(index: number, chord = false) {
    if (finished) return;
    const next = chord || state.cells[index]?.revealed ? chordCell(state, index) : revealCell(state, index);
    if (next === state) return;
    if (state.status === 'ready' && next.status !== 'ready') { clock.start(); void scores.begin(); }
    if (next.status === 'won') {const duration=clock.stop();scores.complete(duration);recordPersonalBest('minesweeper',elapsedSeconds(duration),difficulty);}
    else if (next.status === 'lost') clock.stop();
    setState(next);
  }
  function flag(index: number) { setState(previous => toggleFlag(previous, index)); }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    const index = Number((event.target as HTMLElement).dataset.cell);
    if (!Number.isInteger(index) || index < 0 || index >= state.cells.length || event.metaKey || event.altKey || event.ctrlKey) return;
    const col = index % state.cols, row = Math.floor(index / state.cols);
    let next = index;
    if (event.key === 'ArrowLeft') next = row * state.cols + Math.max(0, col - 1);
    else if (event.key === 'ArrowRight') next = row * state.cols + Math.min(state.cols - 1, col + 1);
    else if (event.key === 'ArrowUp') next = Math.max(0, row - 1) * state.cols + col;
    else if (event.key === 'ArrowDown') next = Math.min(state.rows - 1, row + 1) * state.cols + col;
    else if (event.key === 'Home') next = row * state.cols;
    else if (event.key === 'End') next = row * state.cols + state.cols - 1;
    else if (event.key.toLowerCase() === 'f') flag(index);
    else if (event.key.toLowerCase() === 'c') reveal(index, true);
    else if (event.key === 'Enter' || event.key === ' ') reveal(index);
    else return;
    event.preventDefault(); event.stopPropagation();
    if (next !== index) { setFocused(next); grid.current?.querySelector<HTMLButtonElement>(`[data-cell="${next}"]`)?.focus(); }
  }
  const flags = state.cells.filter(cell => cell.flagged).length;
  const status = state.status === 'ready' ? 'Choose a cell to start. The first opening and its neighbors are safe.' : state.status === 'lost' ? 'Mine hit. New game starts a fresh field.' : state.status === 'won' ? 'Field cleared! Every safe cell is open.' : 'Clear every safe cell. Flags mark suspected mines.';
  return <div ref={root} className={`classic-game classic-mines classic-mines-${difficulty}${expanded?' m-game-is-expanded':''}`}>
    <header className="classic-head"><h2>Minesweeper</h2><ExpandPlay expanded={expanded} toggle={()=>setExpanded(!expanded)}/><button className="mine-reset-face" aria-label="Reset minefield" title="Reset minefield" onClick={() => reset()} disabled={scores.submitting}>{state.status === 'won' ? '☻' : state.status === 'lost' ? '×_×' : '☺'}</button><div>Mines <b>{state.mines - flags}</b> · Time <b>{finished ? elapsedSeconds(clock.durationMs) : Math.floor(clock.durationMs / 1000)}s</b></div></header>
    <p className="classic-help">{state.cols} × {state.rows} · {state.mines} mines · First opening safe · Fastest clear wins.</p>
    <div className="classic-layout"><main className="classic-play">
      <div className="classic-actions mines-options"><label>Difficulty <select aria-label="Difficulty" value={difficulty} disabled={scores.submitting} onChange={event => reset(event.target.value as MineDifficulty)}>{Object.entries(MINE_DIFFICULTIES).map(([key, value]) => <option key={key} value={key}>{key[0]!.toUpperCase() + key.slice(1)} · {value.mines} mines</option>)}</select></label><button onClick={() => reset()} disabled={scores.submitting}>New game</button><div className="mine-touch-modes" role="group" aria-label="Touch action"><button className={!flagMode?'active':''} aria-pressed={!flagMode} onClick={()=>setFlagMode(false)}>Reveal</button><button className={flagMode?'active':''} aria-pressed={flagMode} onClick={()=>setFlagMode(true)}>⚑ Flag</button></div></div>
      <p className="mine-pan-help">{difficulty==='beginner'?'Tap a cell using the selected action.':'Swipe inside the field to pan. Cells stay full size. Tap to use the selected action.'}</p><div ref={scroll} className="mine-scroll" style={fieldHeight===null?undefined:{maxHeight:fieldHeight}} aria-label="Minefield scroll area" tabIndex={0}><div ref={grid} className="mine-grid" role="grid" aria-label={`${difficulty} minefield`} aria-rowcount={state.rows} aria-colcount={state.cols} onKeyDown={keyboard} style={{ '--mine-cols': state.cols } as React.CSSProperties}>
        {Array.from({ length: state.rows }, (_, row) => <div role="row" className="mine-row" key={row}>{state.cells.slice(row * state.cols, (row + 1) * state.cols).map((cell, col) => {
          const index = row * state.cols + col;
          const showMine = cell.mine && (cell.revealed || state.status === 'lost');
          const wrongFlag = state.status === 'lost' && cell.flagged && !cell.mine;
          const description = showMine ? 'mine' : wrongFlag ? 'incorrect flag' : cell.flagged ? 'flagged' : cell.revealed ? cell.adjacent ? `${cell.adjacent} adjacent mines` : 'clear' : 'covered';
          return <button role="gridcell" key={index} data-cell={index} data-number={cell.revealed ? cell.adjacent : undefined} aria-label={`Row ${row + 1}, column ${col + 1}: ${description}`} aria-disabled={finished} tabIndex={focused === index ? 0 : -1} onFocus={() => setFocused(index)} className={`mine-cell${cell.revealed ? ' revealed' : ''}${state.exploded === index ? ' exploded' : ''}${wrongFlag ? ' wrong-flag' : ''}`} onClick={() => flagMode ? flag(index) : reveal(index)} onContextMenu={event => { event.preventDefault(); flag(index); }}>{wrongFlag ? '×' : cell.flagged ? '⚑' : showMine ? '✹' : cell.revealed && cell.adjacent ? cell.adjacent : ''}</button>;
        })}</div>)}
      </div></div>
      <p className="classic-status" role="status">{status}</p>
      {state.status === 'won' && <ClassicResult scores={scores} score={elapsedSeconds(clock.durationMs)} durationMs={clock.durationMs}>Cleared in {elapsedSeconds(clock.durationMs)} seconds</ClassicResult>}
      <p className="classic-help">Tap/click to reveal. Right-click or switch to Flag mode to mark. Click an open number to chord when its flags match. Wide fields scroll horizontally.</p>
      <details className="classic-rules"><summary>Keyboard & rules</summary><ul><li><b>Reveal:</b> click/tap a cell. The first opening and its neighbors are safe.</li><li><b>Flag:</b> right-click, use Flag mode, or press F.</li><li><b>Navigate:</b> arrows move; Home/End reach row edges; Enter/Space reveals.</li><li><b>Chord:</b> click an open number or press C when its flag count matches. Incorrect flags can cause a loss.</li><li><b>Score:</b> successful clears only, lowest time per difficulty. Submission is optional after a win, within 30 minutes.</li></ul></details>
    </main><Scoreboard scores={scores} /></div>
  </div>;
}
export default MinesweeperApp;
