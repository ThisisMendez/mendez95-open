import type {ReactNode} from 'react';
export function inline(text:string):ReactNode[]{
 return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^\s)]+\))/g).map((part,i)=>{
  if(part.startsWith('**')&&part.endsWith('**'))return <strong key={i}>{part.slice(2,-2)}</strong>;
  if(part.startsWith('*')&&part.endsWith('*'))return <em key={i}>{part.slice(1,-1)}</em>;
  const link=/^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(part);
  if(link&&/^https:\/\//.test(link[2]!))return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
  if(link&&/^\/downloads\/[a-z0-9-]+\.pdf$/.test(link[2]!))return <a key={i} href={link[2]} download>{link[1]}</a>;
  if(link&&/^\/(work|contact|side-projects)(?:\/|\?|$)/.test(link[2]!))return <a key={i} href={link[2]} onClick={event=>{event.preventDefault();window.dispatchEvent(new CustomEvent('mendez-navigate',{detail:link[2]}));}}>{link[1]}</a>;
  return part;
 });
}
