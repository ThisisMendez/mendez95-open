import {useSyncExternalStore} from 'react';
export const POCKET_BREAKPOINT=768;
export const POCKET_QUERY=`(max-width: ${POCKET_BREAKPOINT-1}px)`;
const snapshot=()=>matchMedia(POCKET_QUERY).matches;
const subscribe=(changed:()=>void)=>{const query=matchMedia(POCKET_QUERY);query.addEventListener('change',changed);return()=>query.removeEventListener('change',changed);};
/** React rechecks after subscribing, including a resize between render/effect. */
export function usePocketMode(){return useSyncExternalStore(subscribe,snapshot,()=>false);}

/** Desktop-only command routes have one intentional Pocket counterpart. */
export function pathForLayout(path:string,pocket:boolean){if(!pocket)return path;const url=new URL(path,'http://mendez.local');return url.pathname==='/run'?`/find${url.search}${url.hash}`:path;}

/** Route-backed selectors keep Tools tab links and browser Back in one model. */
export const TOOL_TABS=['Explore & Create','Utilities','Mendez World','Help & Navigation'] as const;
export type ToolTab=typeof TOOL_TABS[number];
export function toolTabForRoute(path:string):ToolTab{const url=new URL(path,'http://mendez.local');if(['/mendez-world','/photos','/signal'].includes(url.pathname)||url.pathname.startsWith('/photos/'))return 'Mendez World';const tab=url.searchParams.get('tab');return tab==='utilities'?'Utilities':tab==='help'?'Help & Navigation':tab==='world'?'Mendez World':'Explore & Create';}
export function toolTabPath(tab:ToolTab){return tab==='Mendez World'?'/mendez-world':tab==='Utilities'?'/tools?tab=utilities':tab==='Help & Navigation'?'/tools?tab=help':'/tools';}
export function pocketDockGroup(path:string){const base=new URL(path,'http://mendez.local').pathname.split('/')[1];return base==='work'||base==='ai-lab'?'Portfolio':base==='guide'?'PIP':base==='contact'?'Contact':['tools','weather','world-time','pocket-radio','visitor-log','paint','games','find','help','run','accessories','mendez-world','photos','signal'].includes(base||'')?'Tools':'Home';}
