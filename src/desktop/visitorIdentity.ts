import {useSyncExternalStore} from 'react';
import {isCharacter,isColor,type Appearance} from '../apps/board/appearance';
const KEY='mendez-95-visitor-name',APPEARANCE_KEY='mendez-95-lounge-appearance',EVENT='mendez-95-visitor-name-change';
const DEFAULT_APPEARANCE=JSON.stringify({characterId:'scout',colorId:'teal'});
let memoryName='Visitor',memoryAppearance=DEFAULT_APPEARANCE,volatileName:string|null=null,volatileAppearance:string|null=null;
const cleanName=(value:string)=>value.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,30)||'Visitor';
export function getVisitorName():string{
 if(volatileName!==null)return volatileName;
 try{const saved=localStorage.getItem(KEY);if(saved!==null)return cleanName(saved);
  // Adopt the old game nickname once into the canonical key, retaining the old
  // bytes. Explicit reset stores Visitor and cannot resurrect the legacy name.
  const legacy=localStorage.getItem('mendez-os-player-name')?.trim();if(legacy){memoryName=cleanName(legacy);try{localStorage.setItem(KEY,memoryName);}catch{volatileName=memoryName;}return memoryName;}
  return 'Visitor';
 }catch{return memoryName;}
}
export function setVisitorName(value:string){memoryName=cleanName(value);try{localStorage.setItem(KEY,memoryName);volatileName=null;}catch{volatileName=memoryName;}window.dispatchEvent(new Event(EVENT));}
function appearanceSnapshot(){if(volatileAppearance!==null)return volatileAppearance;try{return localStorage.getItem(APPEARANCE_KEY)||DEFAULT_APPEARANCE;}catch{return memoryAppearance;}}
export function parseVisitorAppearance(value:string):Appearance{try{const v=JSON.parse(value);if(isCharacter(v?.characterId)&&isColor(v?.colorId))return{characterId:v.characterId,colorId:v.colorId};}catch{}return{characterId:'scout',colorId:'teal'};}
export function setVisitorAppearance(value:Appearance){if(!isCharacter(value.characterId)||!isColor(value.colorId))return;memoryAppearance=JSON.stringify(value);try{localStorage.setItem(APPEARANCE_KEY,memoryAppearance);volatileAppearance=null;}catch{volatileAppearance=memoryAppearance;}window.dispatchEvent(new Event(EVENT));}
function subscribe(callback:()=>void){const storage=(e:StorageEvent)=>{if(e.key===KEY||e.key===APPEARANCE_KEY||e.key===null){if(e.key===KEY||e.key===null)volatileName=null;if(e.key===APPEARANCE_KEY||e.key===null)volatileAppearance=null;callback();}};window.addEventListener(EVENT,callback);window.addEventListener('storage',storage);return()=>{window.removeEventListener(EVENT,callback);window.removeEventListener('storage',storage);};}
export function useVisitorName():[string,(value:string)=>void]{return[useSyncExternalStore(subscribe,getVisitorName,()=> 'Visitor'),setVisitorName];}
export function useVisitorAppearance():[Appearance,(value:Appearance)=>void]{const value=useSyncExternalStore(subscribe,appearanceSnapshot,()=>DEFAULT_APPEARANCE);return[parseVisitorAppearance(value),setVisitorAppearance];}
