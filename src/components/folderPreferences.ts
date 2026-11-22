export type FolderPreferences = { view: 'list' | 'icons'; sort: 'order' | 'name' };
export type FolderStorage = Pick<Storage, 'getItem' | 'setItem'>;
const defaults = (): FolderPreferences => ({ view: 'list', sort: 'order' });
function storage(value?: FolderStorage | null) { if(value!==undefined)return value;try{return globalThis.localStorage;}catch{return null;} }
export function readFolderPreferences(key?: string, supplied?: FolderStorage | null): FolderPreferences {
  if(!key)return defaults();try{const value:unknown=JSON.parse(storage(supplied)?.getItem(key)||'null');if(!value||typeof value!=='object')return defaults();const p=value as Record<string,unknown>;if(p.version!==1)return defaults();return {view:p.view==='icons'?'icons':'list',sort:p.sort==='name'?'name':'order'};}catch{return defaults();}
}
export function writeFolderPreferences(key: string | undefined, value: FolderPreferences, supplied?: FolderStorage | null) {
  if(!key)return;try{storage(supplied)?.setItem(key,JSON.stringify({version:1,view:value.view,sort:value.sort}));}catch{/* Browser persistence is optional. */}
}
