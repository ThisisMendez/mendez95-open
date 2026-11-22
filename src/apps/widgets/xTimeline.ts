/** Official free X for Websites SDK only. No API token, scraper or paid endpoint. */
export const X_PROFILE = 'https://x.com/exampleowner';
export const X_WIDGET_SCRIPT = 'https://platform.twitter.com/widgets.js';
export type XWidgets = {widgets:{load:(target:HTMLElement)=>void}};
let loading:Promise<XWidgets>|undefined;
function existing(){const api=(window as Window&{twttr?:XWidgets}).twttr;return typeof api?.widgets?.load==='function'?api:undefined;}
export function loadXWidgets():Promise<XWidgets>{
 const ready=existing();if(ready)return Promise.resolve(ready);
 if(loading)return loading;
 loading=new Promise<XWidgets>((resolve,reject)=>{
  const script=document.createElement('script');script.src=X_WIDGET_SCRIPT;script.async=true;script.referrerPolicy='strict-origin-when-cross-origin';
  const cleanup=()=>{clearTimeout(timeout);script.onload=null;script.onerror=null;};
  const fail=()=>{cleanup();script.remove();loading=undefined;reject(new Error('X timeline unavailable.'));};
  const timeout=setTimeout(fail,12000);
  script.onload=()=>{const api=existing();if(!api){fail();return;}cleanup();resolve(api);};script.onerror=fail;
  document.head.append(script);
 });
 return loading;
}
