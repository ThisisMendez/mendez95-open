import {useEffect,useState} from 'react';
export type OwnerSession={authenticated:boolean;csrfToken?:string;authMode?:'operator';configured?:boolean};
/** A privileged local helper sends its one-use grant only to this expected popup.
 * The token never enters a URL, localStorage, terminal output or rendered text. */
export function OwnerSignIn({onSession,configured}:{onSession:(s:OwnerSession)=>void;configured:boolean}){
 const [message,setMessage]=useState('');
 useEffect(()=>{
  const port=new URLSearchParams(location.search).get('owner-bridge');if(!configured||!port||!/^\d{1,5}$/.test(port)||Number(port)<1||Number(port)>65535||!window.opener)return;
  const origin=`http://127.0.0.1:${port}`,opener=window.opener;let used=false,active=true;
  const receive=async(event:MessageEvent)=>{if(event.origin!==origin||event.source!==opener||event.data?.type!=='mendez-owner-grant'||used)return;const grant=event.data.grant;if(typeof grant!=='string'||!/^[a-f0-9]{64}$/.test(grant))return;used=true;setMessage('Verifying private owner sign-in…');
   try{const response=await fetch('/api/owner/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({grant})});const result=await response.json();if(!response.ok)throw Error(result.error||'Sign-in failed.');if(!active)return;history.replaceState(null,'',location.pathname);onSession(result);opener.postMessage({type:'mendez-owner-signed-in'},origin);}catch(error){if(active)setMessage(error instanceof Error?error.message:'Sign-in failed.');}
  };
  window.addEventListener('message',receive);opener.postMessage({type:'mendez-owner-ready'},origin);return()=>{active=false;window.removeEventListener('message',receive);};
 },[configured,onSession]);
 return <><p>{configured?'Owner sign-in uses the authorized Cloudflare login on your Mac. No website password or paid identity service is required.':'Secure owner sign-in is not configured for this environment. The editor remains private.'}</p><p>From this project on your Mac, run:</p><code>npm run owner:sign-in -- --env staging</code><p>Use <code>--env production</code> after launch, or <code>--env local</code> for this local review. The helper opens a private sign-in button; credentials are never pasted here.</p>{message&&<p role="status">{message}</p>}</>;
}
