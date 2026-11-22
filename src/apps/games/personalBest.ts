import {getVisitorName} from '../../desktop/visitorIdentity';
export type PersonalGame='snake'|'bounce'|'solitaire'|'minesweeper';
const KEY='mendez-95-personal-bests',EVENT='mendez-personal-bests-change';
export type MineLevel='beginner'|'intermediate'|'expert';
export type PersonalKey=Exclude<PersonalGame,'minesweeper'>|`minesweeper:${MineLevel}`;
export type PersonalScores=Partial<Record<PersonalKey,number>>;
const validKeys=['snake','bounce','solitaire','minesweeper:beginner','minesweeper:intermediate','minesweeper:expert'];
export function personalScoreKey(game:PersonalGame,level?:MineLevel):PersonalKey|null{return game==='minesweeper'?(level?`minesweeper:${level}`:null):game;}
export function improvedBest(game:PersonalGame,previous:number|undefined,value:number){if(!Number.isFinite(value)||value<=0)return previous;return previous===undefined?value:game==='minesweeper'?Math.min(previous,value):Math.max(previous,value);}
function player(){return getVisitorName().trim().toLocaleLowerCase();}
export function readPersonalBests():PersonalScores{try{const all=JSON.parse(localStorage.getItem(KEY)||'{}');const scores=Object.hasOwn(all,player())?all[player()]:null;if(!scores||typeof scores!=='object')return {};return Object.fromEntries(Object.entries(scores).filter(([game,value])=>validKeys.includes(game)&&typeof value==='number'&&Number.isFinite(value)&&value>0));}catch{return {};}}
export function recordPersonalBest(game:PersonalGame,score:number,level?:MineLevel){try{const all=JSON.parse(localStorage.getItem(KEY)||'{}');const key=player();const scores=readPersonalBests();const slot=personalScoreKey(game,level);if(!slot)return;const best=improvedBest(game,scores[slot],score);if(best===undefined)return;const next=Object.fromEntries([...Object.entries(all),[key,{...scores,[slot]:best}]]);localStorage.setItem(KEY,JSON.stringify(next));window.dispatchEvent(new Event(EVENT));}catch{/* Local records are optional; never substitute leaderboard/demo scores. */}}
export function subscribePersonalBests(callback:()=>void){window.addEventListener(EVENT,callback);window.addEventListener('storage',callback);window.addEventListener('mendez-95-visitor-name-change',callback);return()=>{window.removeEventListener(EVENT,callback);window.removeEventListener('storage',callback);window.removeEventListener('mendez-95-visitor-name-change',callback);};}
