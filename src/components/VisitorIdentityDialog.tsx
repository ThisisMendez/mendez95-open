import {useEffect,useId,useRef,type KeyboardEvent} from 'react';
import {VisitorIdentityControls} from './VisitorIdentityControls';
/** Native modal makes the current feature inert without navigation or remounting. */
export function VisitorIdentityDialog({close}:{close:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),title=useId();
  useEffect(()=>{
    const node=dialog.current;if(!node)return;
    const viewport=window.visualViewport;
    const fit=()=>{
      const height=viewport?.height??window.innerHeight,top=viewport?.offsetTop??0;
      node.style.setProperty('--identity-viewport-height',`${height}px`);
      node.style.setProperty('--identity-viewport-top',`${top}px`);
      node.style.setProperty('--identity-viewport-bottom',`${Math.max(0,window.innerHeight-height-top)}px`);
    };
    fit();if(!node.open)node.showModal();
    viewport?.addEventListener('resize',fit);viewport?.addEventListener('scroll',fit);window.addEventListener('resize',fit);
    return()=>{viewport?.removeEventListener('resize',fit);viewport?.removeEventListener('scroll',fit);window.removeEventListener('resize',fit);};
  },[]);
  const done=()=>{
    // Escape can close a focused name field without a browser blur. Commit through
    // the controls' existing blur contract before removing the dialog.
    const focused=document.activeElement;
    if(focused instanceof HTMLElement&&dialog.current?.contains(focused))focused.blur();
    dialog.current?.close();close();
  };
  const keepFocus=(event:KeyboardEvent<HTMLDialogElement>)=>{
    if(event.key!=='Tab')return;
    const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]')).filter(element=>element.getClientRects().length>0);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  };
  return <dialog ref={dialog} className="visitor-identity-dialog" aria-labelledby={title} onKeyDown={keepFocus} onCancel={event=>{event.preventDefault();done();}}>
    <header><h2 id={title}>Edit identity</h2><button type="button" className="os-button" onClick={done}>Done</button></header>
    <VisitorIdentityControls id={`${title}-controls`}/>
  </dialog>;
}
