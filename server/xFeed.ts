/** Official read-only API only; credentials never leave the server. */
export type XPost={text:string;url:string;createdAt:string;media:{url:string;alt:string}[]};
let cached:{post:XPost|null;until:number}|undefined;
export async function latestXPost():Promise<XPost|null>{
 if(cached&&cached.until>Date.now())return cached.post;
 const token=process.env.MENDEZ_OS_X_BEARER_TOKEN; if(process.env.MENDEZ_OS_X_ENABLED!=='true'||!token)return null;
 let post:XPost|null=null;
 try{const headers={Authorization:`Bearer ${token}`};const get=async(url:string)=>{const r=await fetch(url,{headers,signal:AbortSignal.timeout(3500)});if(!r.ok)throw new Error('X access unavailable');return r.json();};
 const user=await get('https://api.x.com/2/users/by/username/exampleowner');if(!/^\d+$/.test(user.data?.id))throw new Error('Account unavailable');
 const result=await get(`https://api.x.com/2/users/${user.data.id}/tweets?max_results=5&exclude=retweets,replies&tweet.fields=created_at&expansions=attachments.media_keys&media.fields=url,preview_image_url,alt_text`);const t=result.data?.[0];
 if(t&&/^\d+$/.test(t.id)&&typeof t.text==='string'&&typeof t.created_at==='string'&&Number.isFinite(Date.parse(t.created_at))){const keys=t.attachments?.media_keys||[];post={text:t.text.slice(0,10000),url:`https://x.com/exampleowner/status/${t.id}`,createdAt:t.created_at,media:(result.includes?.media||[]).filter((m:{media_key:string})=>keys.includes(m.media_key)).flatMap((m:{url?:string;preview_image_url?:string;alt_text?:string})=>{const url=m.url||m.preview_image_url;return url&&/^https:\/\/pbs\.twimg\.com\//.test(url)?[{url,alt:m.alt_text||'Post media'}]:[];})};}
 }catch{/* Missing entitlement, deleted post, quota or failure: truthful profile fallback. */}
 cached={post,until:Date.now()+(post?10*60_000:60_000)};return post;
}
