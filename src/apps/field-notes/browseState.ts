import type {FieldNote} from '../../content/types';
export const NOTE_FILTERS=['All','Example Method','Internal Use Only','Product & Teams','Systems & Performance'] as const;
export type NoteFilter=typeof NOTE_FILTERS[number];
export type BrowseState={filter:NoteFilter;selectedId:string;listScroll:number;pageScroll:number;pocketScroll:number};
export const BROWSE_KEY='mendez-field-notes-browse-v1';
export function defaultSelection(notes:readonly FieldNote[]):string{return notes.find(note=>note.featured)?.id||notes[0]?.id||'collaboration-wins';}
export function restoreBrowseState(raw:string|null,notes:readonly FieldNote[]):BrowseState{
 const fallback:BrowseState={filter:'All',selectedId:defaultSelection(notes),listScroll:0,pageScroll:0,pocketScroll:0};
 try{const value:unknown=JSON.parse(raw||'null');if(!value||typeof value!=='object')return fallback;const data=value as Record<string,unknown>;return{filter:NOTE_FILTERS.includes(data.filter as NoteFilter)?data.filter as NoteFilter:'All',selectedId:typeof data.selectedId==='string'&&/^[a-z0-9-]{1,100}$/.test(data.selectedId)&&(notes.length===0||notes.some(note=>note.id===data.selectedId))?data.selectedId:fallback.selectedId,listScroll:typeof data.listScroll==='number'&&Number.isFinite(data.listScroll)?Math.max(0,data.listScroll):0,pageScroll:typeof data.pageScroll==='number'&&Number.isFinite(data.pageScroll)?Math.max(0,data.pageScroll):0,pocketScroll:typeof data.pocketScroll==='number'&&Number.isFinite(data.pocketScroll)?Math.max(0,data.pocketScroll):0};}catch{return fallback;}
}
export function notesForFilter(notes:readonly FieldNote[],filter:NoteFilter):FieldNote[]{return notes.filter(note=>filter==='All'||note.group===filter);}
export function selectFilter(state:BrowseState,filter:NoteFilter,notes:readonly FieldNote[]):BrowseState{
 const visible=notesForFilter(notes,filter);return{...state,filter,selectedId:visible.some(note=>note.id===state.selectedId)?state.selectedId:defaultSelection(visible),listScroll:0,pageScroll:0,pocketScroll:0};
}
/** Index excerpt intentionally leaves the full original summary for Quick look. */
export function indexExcerpt(note:FieldNote):string{return note.summary.match(/^.*?[.!?](?:\s|$)/)?.[0].trim()||note.summary;}
export type NoteShelf={label:string;kind:'series'|'editorial'|'other';filter?:NoteFilter;notes:FieldNote[]};
/** Older records and newly named groups remain visible without inventing series metadata. */
export function pocketShelves(notes:readonly FieldNote[],filter:NoteFilter):NoteShelf[]{
 const visible=notesForFilter(notes,filter);
 const shelves:NoteShelf[]=NOTE_FILTERS.slice(1).filter(group=>filter==='All'||filter===group).flatMap(group=>{const grouped=visible.filter(note=>note.group===group);return grouped.length?[{label:group,kind:group==='Example Method'||group==='Internal Use Only'?'series' as const:'editorial' as const,filter:group,notes:grouped}]:[];});
 const unmatched=visible.filter(note=>!NOTE_FILTERS.slice(1).some(group=>note.group===group));
 if(unmatched.length)shelves.push({label:'Other Field Notes',kind:'other',notes:unmatched});
 return shelves;
}
