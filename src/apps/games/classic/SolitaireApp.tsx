import {recordPersonalBest} from '../personalBest';
import { useRef, useState, type PointerEvent } from 'react';
import {ExpandPlay} from '../ExpandPlay';
import {useGameLifecycle} from '../useGameLifecycle';
import { Scoreboard, useGameScores } from '../Scoreboard';
import { ClassicResult } from './ClassicResult';
import { useRoundClock } from './useRoundClock';
import { solitaireWinScore } from './scoring';
import { SUITS, cardName, drawCard, moveCards, newSolitaire, solitaireWon, sourceCards, type Card, type CardSource, type CardTarget, type SolitaireState } from './solitaire';
import './classic.css';
const symbols = { clubs: '♣', diamonds: '♦', spades: '♠', hearts: '♥' };
const face = (card: Card) => `${['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][card.rank]}${symbols[card.suit]}`;
const color = (card: Card) => card.suit === 'diamonds' || card.suit === 'hearts' ? ' red' : '';
const sameSource = (a: CardSource | null, b: CardSource) => JSON.stringify(a) === JSON.stringify(b);
export function SolitaireApp() {
  const root=useRef<HTMLDivElement>(null);
  const [expanded,setExpanded]=useState(false);
  const [dragPoint,setDragPoint]=useState<{x:number;y:number}|null>(null);
  const drag=useRef<{id:number;x:number;y:number;source:CardSource;moved:boolean}|null>(null);
  const suppressClick=useRef(false);
  const [state, setState] = useState(newSolitaire);
  const initial = useRef(state);
  const [history, setHistory] = useState<SolitaireState[]>([]);
  const [selected, setSelected] = useState<CardSource | null>(null);
  const [notice, setNotice] = useState('Select a face-up card, then its destination.');
  const started = useRef(false);
  const scores = useGameScores('solitaire');
  const clock = useRoundClock();
  const won = solitaireWon(state);
  const points = won ? solitaireWinScore(clock.durationMs) : state.foundations.reduce((sum, pile) => sum + pile.length * 10, 0);
  function apply(next: SolitaireState | null) {
    if (!next || won) return false;
    if (!started.current) { started.current = true; clock.start(); void scores.begin(); }
    setHistory(previous => [...previous, state]); setState(next); setSelected(null);
    if (solitaireWon(next)) { const duration=clock.stop(); scores.complete(duration); recordPersonalBest('solitaire',solitaireWinScore(duration)); setNotice('All four foundations complete. You won!'); }
    else setNotice('Move complete.');
    return true;
  }
  function move(target: CardTarget) {
    if (!selected) { setNotice('Select a face-up card first.'); return; }
    if (!apply(moveCards(state, selected, target))) setNotice(target.kind === 'foundation' ? 'Foundations build by suit from Ace to King, one card at a time.' : 'Build down in alternating colors. Only a King can fill an empty column.');
  }
  function select(source: CardSource) {
    if (won) return;
    if (selected && source.kind === 'tableau' && !(selected.kind === 'tableau' && selected.pile === source.pile)) { move({ kind: 'tableau', pile: source.pile }); return; }
    if (!sourceCards(state, source).length) return;
    setSelected(sameSource(selected, source) ? null : source);
    setNotice(`${cardName(sourceCards(state, source)[0]!)} selected. Choose a column or foundation.`);
  }
  function draw() { if (apply(drawCard(state))) setNotice(state.stock.length ? 'One card drawn to the waste.' : 'Waste recycled into the stock.'); }
  function undo() {
    const previous = history.at(-1);
    if (!previous || won) return;
    setState(previous); setHistory(items => items.slice(0, -1)); setSelected(null); setNotice('Move undone. The timer continues.');
  }
  function reset(fresh: boolean) {
    if (scores.submitting) return;
    const next = fresh ? newSolitaire() : initial.current;
    initial.current = next; setState(next); setHistory([]); setSelected(null); setNotice(fresh ? 'New shuffled deal.' : 'Same deal restarted.');
    started.current = false; clock.reset(); scores.reset();
  }
  useGameLifecycle(root,'/games/solitaire',()=>{drag.current=null;setDragPoint(null);},clock.setVisible);
  function pointerDown(event:PointerEvent<HTMLDivElement>){
    const item=(event.target as HTMLElement).closest<HTMLElement>('[data-source]');
    if(!item||won||event.button!==0)return;
    const source=JSON.parse(item.dataset.source!) as CardSource;
    if(!sourceCards(state,source).length)return;
    suppressClick.current=false;drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,source,moved:false};
  }
  function pointerMove(event:PointerEvent<HTMLDivElement>){
    const current=drag.current;if(!current||current.id!==event.pointerId)return;
    if(!current.moved&&Math.hypot(event.clientX-current.x,event.clientY-current.y)<8)return;
    if(!current.moved)event.currentTarget.setPointerCapture(event.pointerId);
    current.moved=true;setSelected(current.source);setDragPoint({x:event.clientX,y:event.clientY});
  }
  function pointerUp(event:PointerEvent<HTMLDivElement>){
    const current=drag.current;drag.current=null;setDragPoint(null);
    if(!current||!current.moved||current.id!==event.pointerId)return;
    suppressClick.current=true;
    const destination=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-target]');
    const target=destination?JSON.parse(destination.dataset.target!) as CardTarget:null;
    if(!target||!apply(moveCards(state,current.source,target)))setNotice('That move does not fit. Cards returned; choose a highlighted destination.');
  }
  const validTarget=(target:CardTarget)=>selected&&moveCards(state,selected,target)!==null?' sol-valid-target':'';
  const selectedCards = selected ? sourceCards(state, selected) : [];
  return <div ref={root} className={`classic-game classic-solitaire${expanded?' m-game-is-expanded':''}`} onKeyDown={event => {
    if ((event.target as HTMLElement).matches('input,select,textarea') || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() === 'd') { event.preventDefault(); draw(); }
    if (event.key.toLowerCase() === 'u') { event.preventDefault(); undo(); }
    if (event.key === 'Escape' && selected) { event.stopPropagation(); setSelected(null); setNotice('Selection cleared.'); }
  }}>
    <header className="classic-head"><h2>Solitaire</h2><ExpandPlay expanded={expanded} toggle={()=>setExpanded(!expanded)}/><div>Score <b>{points}</b> · Time <b>{won ? Math.ceil(clock.durationMs / 1000) : Math.floor(clock.durationMs / 1000)}s</b> · Moves <b>{state.moves}</b></div></header>
    <p className="classic-help">Klondike · draw one · unlimited stock passes. Build down in alternating colors; foundations up by suit.</p>
    <div className="classic-layout"><main className="classic-play">
      <div className={`solitaire-table${dragPoint?' is-dragging':''}`} aria-label="Klondike card table" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>{drag.current=null;setDragPoint(null);}} onLostPointerCapture={event=>{if(event.target===event.currentTarget){drag.current=null;setDragPoint(null);}}} onClickCapture={event=>{if(suppressClick.current){event.preventDefault();event.stopPropagation();suppressClick.current=false;}}}>
        <div className="solitaire-top">
          <button className={`sol-card sol-stock${state.stock.length ? ' sol-back' : ''}`} onClick={draw} disabled={won || (!state.stock.length && !state.waste.length)} aria-label={state.stock.length ? `Draw one card, ${state.stock.length} remaining` : 'Recycle waste into stock'}>{state.stock.length ? <><span>✦</span><small>{state.stock.length}</small></> : '↻'}</button>
          <button data-source={JSON.stringify({kind:'waste'})} className={`sol-card${state.waste.length ? color(state.waste.at(-1)!) : ' sol-slot'}${selected?.kind === 'waste' ? ' selected' : ''}`} aria-label={state.waste.length ? `Waste: ${cardName(state.waste.at(-1)!)}` : 'Waste empty'} aria-pressed={selected?.kind === 'waste'} disabled={!state.waste.length || won} onClick={() => select({ kind: 'waste' })}>{state.waste.length ? face(state.waste.at(-1)!) : 'Waste'}</button>
          <span />
          {SUITS.map((suit, pile) => <button key={suit} data-source={JSON.stringify({kind:'foundation',pile})} data-target={JSON.stringify({kind:'foundation',pile})} className={`sol-card${validTarget({kind:'foundation',pile})}${state.foundations[pile]!.length ? color(state.foundations[pile]!.at(-1)!) : ' sol-slot'}${selected?.kind === 'foundation' && selected.pile === pile ? ' selected' : ''}`} aria-label={`${suit} foundation: ${state.foundations[pile]!.at(-1) ? cardName(state.foundations[pile]!.at(-1)!) : 'empty'}${selected ? ', move selected card here' : ''}`} onClick={() => selected ? move({ kind: 'foundation', pile }) : select({ kind: 'foundation', pile })} disabled={won}>{state.foundations[pile]!.length ? face(state.foundations[pile]!.at(-1)!) : symbols[suit]}</button>)}
        </div>
        <div className="solitaire-columns">{state.tableau.map((pile, column) => <div className={`sol-column${validTarget({kind:'tableau',pile:column})}`} data-target={JSON.stringify({kind:'tableau',pile:column})} key={column} style={{ height: `max(110px, calc(${pile.length} * var(--sol-step, 22px) + var(--card-height, 72px)))` }}>
          <button className="sol-column-label" onClick={() => move({ kind: 'tableau', pile: column })} disabled={!selected || won} aria-label={`Move selected cards to tableau ${column + 1}`}>{column + 1}</button>
          {!pile.length && <button className="sol-card sol-slot" style={{ top: 22 }} aria-label={`Empty tableau ${column + 1}, King only`} onClick={() => move({ kind: 'tableau', pile: column })} disabled={!selected || won}>K</button>}
          {pile.map((card, index) => <button key={`${card.suit}-${card.rank}`} data-source={card.faceUp?JSON.stringify({kind:'tableau',pile:column,index}):undefined} className={`sol-card${card.faceUp ? color(card) : ' sol-back'}${selected?.kind === 'tableau' && selected.pile === column && index >= selected.index ? ' selected' : ''}`} style={{ top: `calc(22px + ${index} * var(--sol-step, 22px))` }} disabled={!card.faceUp || won} aria-label={`Tableau ${column + 1}: ${card.faceUp ? cardName(card) + (pile.length - index > 1 ? `, move sequence of ${pile.length - index}` : '') : 'face-down card'}`} aria-pressed={selected?.kind === 'tableau' && selected.pile === column && selected.index === index} onClick={() => select({ kind: 'tableau', pile: column, index })}>{card.faceUp ? face(card) : '✦'}</button>)}
        </div>)}</div>
      </div>
      {dragPoint&&selectedCards.length>0&&<div className="sol-drag-preview" aria-hidden="true" style={{left:dragPoint.x+12,top:dragPoint.y-65}}>{face(selectedCards[0]!)}{selectedCards.length>1?<small> +{selectedCards.length-1}</small>:null}</div>}
      <div className="classic-actions"><button onClick={draw} disabled={won}>Draw / recycle (D)</button><button onClick={undo} disabled={!history.length || won}>Undo (U)</button><button onClick={() => reset(false)} disabled={scores.submitting}>Restart deal</button><button onClick={() => reset(true)} disabled={scores.submitting}>New game</button></div>
      <p className="classic-status" role="status">{notice}</p>
      {selectedCards.length > 0 && <p className="classic-selection">{cardName(selectedCards[0]!)}{selectedCards.length > 1 ? ` + ${selectedCards.length - 1} cards` : ''} · <button onClick={() => setSelected(null)}>Cancel selection</button></p>}
      {won && <ClassicResult scores={scores} score={points} durationMs={clock.durationMs}>You won · {points} points · {Math.ceil(clock.durationMs / 1000)} seconds</ClassicResult>}
      <details className="classic-rules"><summary>Controls & scoring</summary><strong>Controls</strong><ul><li>Tap a card, then its highlighted destination, or drag a face-up card. Tab and Enter/Space also select and move.</li><li>D draws; U undoes; Escape clears selection.</li><li>Move face-up alternating-color sequences downward. Empty columns accept Kings; suited foundations start with Aces.</li><li>Undo restores cards and revealed faces; time continues. Restart repeats the deal; New game shuffles.</li></ul><strong>Scoring</strong><ul><li>10 points per foundation card; a win adds one point per second remaining of 30 minutes.</li><li>Only wins can be submitted, optionally, within 30 minutes. Some deals cannot be solved.</li></ul></details>
    </main><Scoreboard scores={scores} /></div>
  </div>;
}
export default SolitaireApp;
