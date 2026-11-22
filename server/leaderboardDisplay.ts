export type LeaderEntry={id:string;nickname:string;score:number;createdAt:string;sample?:boolean};
export const normalizedNickname=(name:string)=>name.normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
/** Real results own their nickname; demos only fill otherwise vacant rows.
 * Display composition never writes to actual score storage or actual counters. */
export function leaderboardDisplay(real:LeaderEntry[],demo:LeaderEntry[],lowerWins:boolean):LeaderEntry[]{const used=new Set(real.map(e=>normalizedNickname(e.nickname)));const fill=demo.filter(e=>!used.has(normalizedNickname(e.nickname))).slice(0,Math.max(0,10-real.length));return [...real,...fill].sort((a,b)=>(lowerWins?a.score-b.score:b.score-a.score)||a.nickname.localeCompare(b.nickname)).slice(0,10);}
