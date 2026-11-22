import {useEffect,useState} from 'react';
import {readPersonalBests,subscribePersonalBests} from './personalBest';
import {GameCartridgeArt} from './GameCartridgeArt';
import './games.css';
import {FolderBrowser} from '../../components/FolderBrowser';
import {usePocketMode} from '../../pocket/layout';
const GAMES=[{id:'snake',title:'Snake',copy:'Grow. Turn. Beat your best.',mark:'↝',color:'#66bc81',icon:'games'},{id:'bounce',title:'Bounce',copy:'Keep the ball in play.',mark:'●',color:'#77bfdb',icon:'games'},{id:'solitaire',title:'Solitaire',copy:'A classic card break.',mark:'♠',color:'#edcf69',icon:'solitaire'},{id:'minesweeper',title:'Minesweeper',copy:'Find every safe square.',mark:'✹',color:'#b7a0df',icon:'minesweeper'}] as const;

export default function GamesApp({navigate}:{navigate?:(path:string)=>void}){
 const [bests,setBests]=useState(readPersonalBests);useEffect(()=>subscribePersonalBests(()=>setBests(readPersonalBests())),[]);
 const pocket=usePocketMode();const open=(path:string)=>navigate?navigate(path):window.location.assign(path);
 if(!pocket)return <FolderBrowser title="Games" items={GAMES.map(game=>({id:game.id,title:game.title,icon:game.icon,open:()=>open(`/games/${game.id}`)}))}/>;

 return <section className="pocket-arcade"><header><span aria-hidden="true">✥</span><div><h2>Pocket Arcade</h2><p>A little room for play.</p></div></header><div className="arcade-banner" aria-hidden="true"><i/><span>PRESS PLAY</span><b>✦</b></div><div className="arcade-games">{GAMES.map(game=><button key={game.id} onClick={()=>open(`/games/${game.id}`)}><GameCartridgeArt game={game.id} color={game.color}/><span><strong>{game.title}</strong><small>{game.copy}</small></span><b aria-hidden="true">›</b></button>)}</div><section className="arcade-bests"><h3>♜ Your best scores</h3><dl>{GAMES.map(game=><div key={game.id}><dt>{game.title}</dt><dd>{game.id==='minesweeper'?(['beginner','intermediate','expert'] as const).filter(level=>bests[`minesweeper:${level}`]!==undefined).map(level=>`${level}: ${bests[`minesweeper:${level}`]}s`).join(' · ')||'No score yet':bests[game.id]??'No score yet'}</dd></div>)}</dl><p>Personal records on this browser for your selected identity. Minesweeper keeps fastest completed clears separately by difficulty.</p></section><button className="arcade-back" onClick={()=>open('/tools')}>‹ Back to Tools</button></section>;
}
