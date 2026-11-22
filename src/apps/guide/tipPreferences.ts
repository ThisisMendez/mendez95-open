const ENABLED='mendez-95-snip-appearances', DISMISSALS='mendez-95-snip-tip-dismissals', EVENT='mendez-snip-tips-change';
let enabledMemory=true,countMemory=0;
export function tipsEnabled(){try{return localStorage.getItem(ENABLED)!=='0';}catch{return enabledMemory;}}
export function tipDismissals(){try{return Math.min(2,Math.max(0,Number(localStorage.getItem(DISMISSALS))||0));}catch{return countMemory;}}
export function setTipsEnabled(value:boolean){enabledMemory=value;if(value)countMemory=0;try{localStorage.setItem(ENABLED,value?'1':'0');if(value)localStorage.setItem(DISMISSALS,'0');}catch{}window.dispatchEvent(new Event(EVENT));}
export function dismissPreparedTip(){countMemory=Math.min(2,tipDismissals()+1);try{localStorage.setItem(DISMISSALS,String(countMemory));}catch{}if(countMemory>=2)setTipsEnabled(false);return countMemory;}
export function subscribeTips(callback:()=>void){const storage=(e:StorageEvent)=>{if(e.key===ENABLED||e.key===DISMISSALS||e.key===null)callback();};window.addEventListener(EVENT,callback);window.addEventListener('storage',storage);return()=>{window.removeEventListener(EVENT,callback);window.removeEventListener('storage',storage);};}
