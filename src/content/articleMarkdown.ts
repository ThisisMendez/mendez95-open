/** Small, text-preserving parser for the authored article format. No HTML execution. */
export type ArticleBlock =
  | { type:'heading'; level:number; text:string; id:string }
  | { type:'paragraph'; text:string }
  | { type:'quote'; text:string }
  | { type:'image'; alt:string; src:string }
  | { type:'list'; items:string[] }
  | { type:'table'; rows:string[][] }
  | { type:'rule' };
export function parseArticle(markdown:string, namespace=''):ArticleBlock[] {
  const scope=namespace.toLowerCase().replace(/[^a-z0-9-]/g,'');
  const lines=markdown.replace(/\r\n/g,'\n').split('\n'), blocks:ArticleBlock[]=[], ids=new Map<string,number>();
  let paragraph:string[]=[];
  const flush=()=>{if(paragraph.length){blocks.push({type:'paragraph',text:paragraph.join(' ')});paragraph=[];}};
  for(let i=0;i<lines.length;i++){
    const line=lines[i]!.trim();
    if(!line){flush();continue;}
    const heading=/^(#{1,6})\s+(.+)$/.exec(line),image=/^!\[([^\]]*)\]\(([^\s)]+)\)$/.exec(line);
    if(heading){flush();const text=heading[2]!,base=text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'section',count=(ids.get(base)||0)+1;ids.set(base,count);blocks.push({type:'heading',level:heading[1]!.length,text,id:`${scope?`${scope}-`:''}${base}${count>1?`-${count}`:''}`});}
    else if(image){flush();blocks.push({type:'image',alt:image[1]!,src:image[2]!});}
    else if(/^---+$/.test(line)){flush();blocks.push({type:'rule'});}
    else if(line.startsWith('> ')){flush();const quotes=[line.slice(2)];while(lines[i+1]?.trim().startsWith('> '))quotes.push(lines[++i]!.trim().slice(2));blocks.push({type:'quote',text:quotes.join(' ')});}
    else if(line.startsWith('- ')){flush();const items=[line.slice(2)];while(lines[i+1]?.trim().startsWith('- '))items.push(lines[++i]!.trim().slice(2));blocks.push({type:'list',items});}
    else if(line.startsWith('|')&&line.endsWith('|')){flush();const rows:string[][]=[];do{const row=lines[i]!.trim().slice(1,-1).split('|').map(s=>s.trim());if(!row.every(cell=>/^:?-{3,}:?$/.test(cell)))rows.push(row);if(!lines[i+1]?.trim().startsWith('|'))break;i++;}while(i<lines.length);blocks.push({type:'table',rows});}
    else paragraph.push(line);
  }
  flush();return blocks;
}
/** Shared by search/Guide. Image paths and Markdown syntax are not narration. */
export function articleText(markdown:string):string {
  return parseArticle(markdown).flatMap(block=>block.type==='image'||block.type==='rule'?[]:block.type==='table'?block.rows.flat():block.type==='list'?block.items:[block.text]).filter(Boolean).join('\n\n').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\*([^*]+)\*/g,'$1');
}
