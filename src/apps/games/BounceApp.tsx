import {recordPersonalBest} from './personalBest';
import { useCallback, useEffect, useRef, useState } from 'react';
import './games.css';
import {paddlePosition} from './input';
import {useGameLifecycle} from './useGameLifecycle';
import {ExpandPlay} from './ExpandPlay';
import { RoundOver, Scoreboard, useGameScores } from './Scoreboard';

type Phase = 'ready' | 'playing' | 'paused' | 'lost' | 'won';
type Brick = { x: number; y: number; alive: boolean };
type Game = { ballX: number; ballY: number; vx: number; vy: number; paddleX: number; bricks: Brick[]; score: number };
const W = 480, H = 340, PADDLE_W = 76, PADDLE_Y = 316;
const rows = 4, columns = 8;
function initial(): Game {
  return { ballX: W / 2, ballY: 248, vx: 2.5, vy: -3.2, paddleX: (W - PADDLE_W) / 2, score: 0,
    bricks: Array.from({ length: rows * columns }, (_, index) => ({ x: 17 + (index % columns) * 57, y: 44 + Math.floor(index / columns) * 22, alive: true })) };
}
function readBest() { try { return Number(window.localStorage.getItem('mendez-os-bounce-best')) || 0; } catch { return 0; } }

export default function BounceApp() {
  const root=useRef<HTMLElement>(null);
  const [expanded,setExpanded]=useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game>(initial());
  const inputs=useRef(new Map<string,number>());
  const held=useRef(0);
  const syncHeld=()=>{const values=[...inputs.current.values()];held.current=(values.includes(1)?1:0)-(values.includes(-1)?1:0);};
  const clearHeld=()=>{inputs.current.clear();held.current=0;};
  const touch = useRef<number | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(readBest);
  const [frame, setFrame] = useState(0);
  const scoreService = useGameScores('bounce');

  const canPlay=useGameLifecycle(root,'/games/bounce',()=>{setPhase(value=>value==='playing'?'paused':value);clearHeld();touch.current=null;});
  const restart = useCallback(() => { if(!canPlay())return; void scoreService.begin(); game.current = initial(); clearHeld(); touch.current=null; setScore(0); setFrame(n => n + 1); setPhase('playing'); }, [scoreService.begin]);
  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      if(!canPlay())return;
      const windowElement = canvas.current?.closest('.os-window');
      if (windowElement && windowElement.getAttribute('data-active') !== 'true') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,[contenteditable="true"]')) return;
      if(event.key===' '&&target?.closest('button'))return; // native button activation owns Space
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') { event.preventDefault(); inputs.current.set(event.key.toLowerCase(),-1);syncHeld(); }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') { event.preventDefault(); inputs.current.set(event.key.toLowerCase(),1);syncHeld(); }
      if (event.key === ' ' && !event.repeat) { event.preventDefault(); setPhase(p => p === 'playing' ? 'paused' : p === 'paused' ? 'playing' : p); }
    }
    function keyUp(event: KeyboardEvent) {inputs.current.delete(event.key.toLowerCase());syncHeld();}
    window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp);
    return () => { window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); };
  }, []);

  useEffect(() => {
    if (phase !== 'playing') {clearHeld();return;}
    let id = 0, last = 0;
    function step(now: number) {
      if (!last) last = now;
      const delta = Math.min(2.25, (now - last) / 16.667); last = now;
      const g = game.current;
      g.paddleX = Math.max(0, Math.min(W - PADDLE_W, g.paddleX + held.current * 6.2 * delta));
      g.ballX += g.vx * delta; g.ballY += g.vy * delta;
      if (g.ballX <= 7) { g.ballX = 7; g.vx = Math.abs(g.vx); }
      if (g.ballX >= W - 7) { g.ballX = W - 7; g.vx = -Math.abs(g.vx); }
      if (g.ballY <= 7) { g.ballY = 7; g.vy = Math.abs(g.vy); }
      if (g.vy > 0 && g.ballY + 7 >= PADDLE_Y && g.ballY < PADDLE_Y + 12 && g.ballX >= g.paddleX - 7 && g.ballX <= g.paddleX + PADDLE_W + 7) {
        g.ballY = PADDLE_Y - 7; g.vy = -Math.abs(g.vy);
        g.vx = ((g.ballX - (g.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2)) * 3.6;
      }
      if (g.ballY > H + 8) { setPhase('lost'); return; }
      for (const brick of g.bricks) {
        if (!brick.alive || g.ballX + 7 < brick.x || g.ballX - 7 > brick.x + 50 || g.ballY + 7 < brick.y || g.ballY - 7 > brick.y + 15) continue;
        brick.alive = false; g.vy *= -1; g.score += 10; setScore(g.score); recordPersonalBest('bounce',g.score);
        if (g.score > best) { setBest(g.score); try { localStorage.setItem('mendez-os-bounce-best', String(g.score)); } catch { /* storage unavailable */ } }
        if (g.bricks.every(item => !item.alive)) { setPhase('won'); return; }
        break;
      }
      setFrame(value => value + 1); id = requestAnimationFrame(step);
    }
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [phase, best]);
  useEffect(() => {
    const context = canvas.current?.getContext('2d'); if (!context) return;
    const g = game.current;
    context.fillStyle = '#10202a'; context.fillRect(0, 0, W, H);
    context.strokeStyle = 'rgba(167,230,213,.12)'; context.lineWidth = 1;
    for (let y = 20; y < H; y += 20) { context.beginPath(); context.moveTo(0, y); context.lineTo(W, y); context.stroke(); }
    g.bricks.forEach((brick, index) => { if (!brick.alive) return; context.fillStyle = ['#f0c577', '#b3dfcf', '#c9bcf4', '#eaafbd'][Math.floor(index / columns)] || '#f0c577'; context.fillRect(brick.x, brick.y, 50, 15); });
    context.fillStyle = '#d7fff1'; context.fillRect(g.paddleX, PADDLE_Y, PADDLE_W, 9);
    context.beginPath(); context.arc(g.ballX, g.ballY, 7, 0, Math.PI * 2); context.fillStyle = '#f9d381'; context.fill();
  }, [frame, phase]);
  function aim(clientX: number) { const bounds = canvas.current?.getBoundingClientRect(); if (!bounds) return; game.current.paddleX = paddlePosition(clientX,bounds.left,bounds.width,W,PADDLE_W); setFrame(n => n + 1); }
  const status = phase === 'ready' ? 'Ready to play' : phase === 'playing' ? 'Playing' : phase === 'paused' ? 'Paused' : phase === 'won' ? 'All markers cleared' : 'Round over';
  return <section ref={root} className={`m-game m-game--bounce${expanded?' m-game-is-expanded':''}`} aria-label="Bounce game">
    <div className="m-game-head"><div><h2>Bounce</h2></div><ExpandPlay expanded={expanded} toggle={()=>{setExpanded(!expanded);clearHeld();touch.current=null;setPhase(value=>value==='playing'?'paused':value);}}/><div className="m-game-score"><span>Score <b>{score}</b></span><span>Best <b>{best}</b></span></div></div>
    <p className="m-game-copy">Drag anywhere on the field to aim the paddle. ← → / A D · Space pauses.</p>
    <div className="m-game-layout"><div className="m-game-play"><div className="m-game-stage"><canvas ref={canvas} width={W} height={H} aria-label={`Bounce field. ${status}. Score ${score}.`} onPointerDown={event => { if(!canPlay())return; event.currentTarget.setPointerCapture(event.pointerId); touch.current = event.pointerId; aim(event.clientX); }} onPointerMove={event => { if (canPlay()&&(event.pointerType === 'mouse' || touch.current === event.pointerId)) aim(event.clientX); }} onPointerUp={() => { touch.current = null; }} onPointerCancel={()=>{touch.current=null;held.current=0;}} onLostPointerCapture={()=>{touch.current=null;}} />{(phase === 'lost' || phase === 'won') && <RoundOver scores={scoreService} score={score} status={status} restart={restart} />}</div>
    <div className="m-game-controls"><strong role="status" aria-live="polite">{status}</strong><div className="m-game-actions">{phase === 'ready' ? <button type="button" onClick={restart}>Start</button> : phase === 'playing' || phase === 'paused' ? <><button type="button" onClick={() => {if(canPlay())setPhase(p => p === 'playing' ? 'paused' : 'playing');}}>{phase === 'playing' ? 'Pause' : 'Resume'}</button><button type="button" onClick={restart}>Restart</button></> : null}</div></div>
    <div className="m-game-touch" role="group" aria-label="Paddle controls">{([{label:'Left',value:-1},{label:'Right',value:1}]).map(d=><button type="button" key={d.label} onPointerDown={event=>{if(!canPlay()||phase!=='playing')return;event.preventDefault();event.currentTarget.focus({preventScroll:true});event.currentTarget.setPointerCapture(event.pointerId);inputs.current.set(`pointer-${event.pointerId}`,d.value);syncHeld();}} onPointerUp={event=>{inputs.current.delete(`pointer-${event.pointerId}`);syncHeld();}} onPointerCancel={event=>{inputs.current.delete(`pointer-${event.pointerId}`);syncHeld();}} onLostPointerCapture={event=>{inputs.current.delete(`pointer-${event.pointerId}`);syncHeld();}} onKeyDown={event=>{if((event.key===' '||event.key==='Enter')&&!event.repeat&&canPlay()&&phase==='playing'){event.preventDefault();event.stopPropagation();inputs.current.set(`button-${d.label}`,d.value);syncHeld();}}} onKeyUp={event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();inputs.current.delete(`button-${d.label}`);syncHeld();}}} onBlur={()=>{inputs.current.delete(`button-${d.label}`);syncHeld();}}>{d.value<0?'← Left':'Right →'}</button>)}</div>
    </div><Scoreboard scores={scoreService} /></div>
  </section>;
}
