import {recordPersonalBest} from './personalBest';
import { useCallback, useEffect, useRef, useState } from 'react';
import './games.css';
import {queueTurn,swipeTurn} from './input';
import {useGameLifecycle} from './useGameLifecycle';
import {ExpandPlay} from './ExpandPlay';
import { RoundOver, Scoreboard, useGameScores } from './Scoreboard';

type Point = { x: number; y: number };
type Phase = 'ready' | 'playing' | 'paused' | 'over' | 'won';
const SIZE = 20;
const INITIAL: Point[] = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
const RIGHT: Point = { x: 1, y: 0 };

function same(a: Point, b: Point) { return a.x === b.x && a.y === b.y; }
function foodFor(snake: Point[]): Point | null {
  const empty: Point[] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (!snake.some(part => part.x === x && part.y === y)) empty.push({ x, y });
  }
  return empty.length ? empty[Math.floor(Math.random() * empty.length)] ?? null : null;
}
function readBest() {
  try { return Number(window.localStorage.getItem('mendez-os-snake-best')) || 0; } catch { return 0; }
}

export default function SnakeApp() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const snake = useRef<Point[]>(INITIAL.map(p => ({ ...p })));
  const direction = useRef<Point>(RIGHT);
  const queued = useRef<Point[]>([]);
  const root=useRef<HTMLElement>(null);
  const [expanded,setExpanded]=useState(false);
  const food = useRef<Point | null>({ x: 14, y: 10 });
  const touchStart = useRef<(Point & {id:number}) | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const phaseRef=useRef<Phase>(phase);phaseRef.current=phase;
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(readBest);
  const [tick, setTick] = useState(0);
  const scoreService = useGameScores('snake');
  useEffect(()=>{if(phase!=='playing'){queued.current=[];touchStart.current=null;}},[phase]);

  const canPlay=useGameLifecycle(root,'/games/snake',()=>{setPhase(value=>value==='playing'?'paused':value);touchStart.current=null;queued.current=[];});
  const restart = useCallback(() => {
    if(!canPlay()||document.querySelector('dialog[open], [aria-modal="true"]'))return;
    phaseRef.current='playing';
    void scoreService.begin();
    snake.current = INITIAL.map(p => ({ ...p })); direction.current = RIGHT; queued.current = []; touchStart.current=null;
    food.current = foodFor(snake.current); setScore(0); setTick(v => v + 1); setPhase('playing');
  }, [scoreService.begin]);
  const startReady=useCallback(()=>{if(phaseRef.current==='ready')restart();},[restart]);
  const turn = useCallback((next: Point) => {
    if (phase !== 'playing') return;
    queued.current = queueTurn(queued.current,direction.current,next);
  }, [phase]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if(!canPlay())return;
      const windowElement = canvas.current?.closest('.os-window');
      if (windowElement && windowElement.getAttribute('data-active') !== 'true') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,[contenteditable="true"]')) return;
      if(event.key===' '&&target?.closest('button'))return; // native button activation owns Space
      const dirs: Record<string, Point> = { ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 } };
      const next = dirs[event.key];
      if (next) { event.preventDefault(); turn(next); }
      if (event.key === ' ' && !next && !event.repeat) { event.preventDefault(); if(phaseRef.current==='ready')startReady();else setPhase(p => p === 'playing' ? 'paused' : p === 'paused' ? 'playing' : p); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [turn,startReady]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = window.setInterval(() => {
      direction.current = queued.current.shift() || direction.current;
      const head = snake.current[0];
      if (!head) { setPhase('over'); return; }
      const next = { x: head.x + direction.current.x, y: head.y + direction.current.y };
      const eats = food.current && same(next, food.current);
      const body = eats ? snake.current : snake.current.slice(0, -1);
      if (next.x < 0 || next.x >= SIZE || next.y < 0 || next.y >= SIZE || body.some(part => same(part, next))) {
        setPhase('over'); return;
      }
      snake.current = [next, ...snake.current.slice(0, eats ? undefined : -1)];
      if (eats) {
        setScore(value => {
          const nextScore = value + 10;
          recordPersonalBest('snake',nextScore);
          setBest(previous => {
            if (nextScore > previous) {
              try { window.localStorage.setItem('mendez-os-snake-best', String(nextScore)); } catch { /* storage unavailable */ }
              return nextScore;
            }
            return previous;
          });
          return nextScore;
        });
        food.current = foodFor(snake.current);
        if (!food.current) setPhase('won');
      }
      setTick(value => value + 1);
    }, 125);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#101f27'; ctx.fillRect(0, 0, 400, 400);
    ctx.strokeStyle = 'rgba(185,215,210,.08)'; ctx.lineWidth = 1;
    for (let i = 1; i < SIZE; i++) { ctx.beginPath(); ctx.moveTo(i * 20, 0); ctx.lineTo(i * 20, 400); ctx.moveTo(0, i * 20); ctx.lineTo(400, i * 20); ctx.stroke(); }
    if (food.current) { ctx.fillStyle = '#f9c36b'; ctx.beginPath(); ctx.arc(food.current.x * 20 + 10, food.current.y * 20 + 10, 7, 0, Math.PI * 2); ctx.fill(); }
    snake.current.forEach((part, index) => { ctx.fillStyle = index ? '#85c9b9' : '#d4fff1'; ctx.fillRect(part.x * 20 + 2, part.y * 20 + 2, 16, 16); });
  }, [tick, phase]);

  const status = phase === 'ready' ? 'Ready to play' : phase === 'playing' ? 'Playing' : phase === 'paused' ? 'Paused' : phase === 'won' ? 'Board cleared' : 'Game over';
  return <section ref={root} className={`m-game m-game--snake${expanded?' m-game-is-expanded':''}`} aria-label="Snake game">
    <div className="m-game-head"><div><h2>Snake</h2></div><ExpandPlay expanded={expanded} toggle={()=>{setExpanded(!expanded);touchStart.current=null;queued.current=[];setPhase(value=>value==='playing'?'paused':value);}}/><div className="m-game-score"><span>Score <b>{score}</b></span><span>Best <b>{best}</b></span></div></div>
    <p className="m-game-copy">Swipe to steer; avoid walls and your trail. Arrows / WASD · Space starts or pauses.</p>
    <div className="m-game-layout"><div className="m-game-play"><div className="m-game-stage"><canvas ref={canvas} width={400} height={400} tabIndex={0} role="button" onClick={startReady} onKeyDown={event=>{if(event.key==='Enter'&&!event.repeat){event.preventDefault();startReady();}}} aria-label={`Snake field. ${status}. Score ${score}.`} onPointerDown={event=>{if(!canPlay())return;event.currentTarget.setPointerCapture(event.pointerId);touchStart.current={x:event.clientX,y:event.clientY,id:event.pointerId};}} onPointerMove={event=>{const start=touchStart.current;if(!start||start.id!==event.pointerId)return;const point={x:event.clientX,y:event.clientY};const next=swipeTurn(start,point);if(next){turn(next);touchStart.current={...point,id:event.pointerId};}}} onPointerUp={()=>{touchStart.current=null;}} onPointerCancel={()=>{touchStart.current=null;}} onLostPointerCapture={()=>{touchStart.current=null;}} />{(phase === 'over' || phase === 'won') && <RoundOver scores={scoreService} score={score} status={status} restart={restart} />}</div>
    <div className="m-game-controls"><strong role="status" aria-live="polite">{status}</strong><div className="m-game-actions">{phase === 'ready' ? <button type="button" onClick={restart}>Start</button> : phase === 'playing' || phase === 'paused' ? <><button type="button" onClick={() => {if(canPlay())setPhase(p => p === 'playing' ? 'paused' : 'playing');}}>{phase === 'playing' ? 'Pause' : 'Resume'}</button><button type="button" onClick={restart}>Restart</button></> : null}</div></div>
    <div className="m-game-dpad" role="group" aria-label="Direction pad">{([{label:'up',x:0,y:-1,glyph:'↑'},{label:'left',x:-1,y:0,glyph:'←'},{label:'down',x:0,y:1,glyph:'↓'},{label:'right',x:1,y:0,glyph:'→'}]).map(d=><button type="button" key={d.label} className={`dpad-${d.label}`} aria-label={`Move ${d.label}`} onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.currentTarget.focus({preventScroll:true});turn({x:d.x,y:d.y});}} onClick={event=>{if(event.detail===0)turn({x:d.x,y:d.y});}}>{d.glyph}</button>)}</div>
    </div><Scoreboard scores={scoreService} /></div>
  </section>;
}
