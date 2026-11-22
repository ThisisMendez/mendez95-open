import {body,fail,hash,json,randomToken,requireOrigin,type Env} from './env';
import {Repository} from './storage';
const cookie='mendez_os_owner';
/** Owner identity is delegated from the already-authorized Cloudflare control plane.
 * Only a privileged local CLI may insert a 256-bit one-use grant into D1.
 * There is no public grant issuer, website password, Access or bootstrap bypass. */
export function authConfigured(env:Env){try{const u=new URL(env.OWNER_ORIGIN||'');return env.OWNER_AUTH_MODE==='operator'&&Boolean(env.AUTH_EPOCH)&&u.origin===env.OWNER_ORIGIN&&(u.protocol==='https:'||(env.RUNTIME_ENV==='local'&&u.protocol==='http:'&&u.hostname==='127.0.0.1'));}catch{return false;}}
export async function owner(r:Request,env:Env,csrf=false){
 if(!authConfigured(env)||new URL(r.url).origin!==env.OWNER_ORIGIN)fail(401,'Owner authentication is not configured for this origin.');
 const token=r.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookie+'='))?.slice(cookie.length+1);if(!token||!/^[a-f0-9]{64}$/.test(token))fail(401,'Owner sign-in required.');
 const session=await env.DB.prepare('SELECT * FROM sessions WHERE token_hash=? AND revoked=0 AND expires_at>? AND epoch=?').bind(await hash(token),Date.now(),env.AUTH_EPOCH).first<{token_hash:string;csrf_hash:string;subject:string;expires_at:number}>();if(!session)fail(401,'Owner session expired.');
 if(csrf){requireOrigin(r);const t=r.headers.get('x-mendez-csrf');if(!t||await hash(t)!==session.csrf_hash)fail(403,'Invalid request token.');}return session;
}
export async function authRoute(r:Request,env:Env,repo:Repository):Promise<Response|null>{
 const path=new URL(r.url).pathname;
 if(path==='/api/owner/session'&&r.method==='GET'){
  try{const session=await owner(r,env),csrf=r.headers.get('cookie')?.match(/(?:^|;\s*)mendez_os_csrf=([a-f0-9]{64})/)?.[1];if(!csrf||await hash(csrf)!==session.csrf_hash)return json({authenticated:false,authMode:'operator',configured:authConfigured(env)});return json({authenticated:true,csrfToken:csrf,authMode:'operator'});}catch{return json({authenticated:false,authMode:'operator',configured:authConfigured(env)});}
 }
 if(path==='/api/owner/login'&&r.method==='POST'){
  requireOrigin(r);if(!authConfigured(env)||new URL(r.url).origin!==env.OWNER_ORIGIN)fail(503,'Secure owner sign-in is unavailable for this origin.');await repo.limit(r,'login',8,900000);
  const b=await body(r);if(typeof b.grant!=='string'||!/^[a-f0-9]{64}$/.test(b.grant))fail(401,'Use a fresh private owner sign-in from the authorized Mac.');
  const now=Date.now(),token=randomToken(),csrf=randomToken(),tokenHash=await hash(token),grantHash=await hash(b.grant),expiry=now+12*3600000;
  const result=await env.DB.batch([
   env.DB.prepare('INSERT INTO sessions(token_hash,csrf_hash,subject,created_at,expires_at,epoch,revoked) SELECT ?,?,subject,?,?,epoch,0 FROM auth_grants WHERE token_hash=? AND used_at IS NULL AND expires_at>? AND epoch=? AND origin=?').bind(tokenHash,await hash(csrf),now,expiry,grantHash,now,env.AUTH_EPOCH,env.OWNER_ORIGIN),
   env.DB.prepare('UPDATE auth_grants SET used_at=? WHERE token_hash=? AND EXISTS(SELECT 1 FROM sessions WHERE token_hash=?)').bind(now,grantHash,tokenHash)
  ]);if(!result[0].meta.changes)fail(401,'This private sign-in expired or was already used. Generate a new one.');
  const headers=new Headers({'Cache-Control':'private, no-store','Content-Type':'application/json'});headers.append('Set-Cookie',`${cookie}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);headers.append('Set-Cookie',`mendez_os_csrf=${csrf}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);return new Response(JSON.stringify({authenticated:true,csrfToken:csrf,authMode:'operator'}),{headers});
 }
 if(path==='/api/owner/logout'&&r.method==='POST'){const s=await owner(r,env,true);await env.DB.prepare('UPDATE sessions SET revoked=1 WHERE token_hash=?').bind(s.token_hash).run();const headers=new Headers({'Content-Type':'application/json','Cache-Control':'private, no-store'});for(const name of [cookie,'mendez_os_csrf'])headers.append('Set-Cookie',`${name}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`);return new Response(JSON.stringify({authenticated:false}),{headers});}
 return null;
}
