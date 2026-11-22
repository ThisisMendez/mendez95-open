/** Owner-approved illustrative snapshot, separate from authenticated measured analytics.
 * One deterministic ledger owns chronology AND geography; persisted daily allocations stay display-only. */
export type Visit={dayHash:string;country:string;day?:string;city?:string;recordedAt?:string};
export const DISPLAY_START='2026-06-18';
export const SNAPSHOT_CUTOFF='2026-10-29T20:07:47.000Z';
export const SNAPSHOT_MONTHS=[['2026-06',25],['2026-07',32],['2026-08',125],['2026-09',200],['2026-10',267]] as const;
const DAY=86_400_000;
const places=[{city:'New York',country:'US',weight:280},{city:'Los Angeles',country:'US',weight:170},{city:'Chicago',country:'US',weight:140},{city:'Barcelona',country:'ES',weight:130},{city:'Santo Domingo',country:'DO',weight:125},{city:'Mexico City',country:'MX',weight:120},{city:'London',country:'GB',weight:110},{city:'Toronto',country:'CA',weight:100},{city:'Paris',country:'FR',weight:75}];
const dateKey=(stamp:number)=>new Date(stamp).toISOString().slice(0,10);
const sum=(items:{count:number}[])=>items.reduce((total,item)=>total+item.count,0);
/** Largest remainders retain the established geography's proportions using exact integers. */
function allocations(total:number,weights:number[]){const denominator=weights.reduce((a,b)=>a+b,0),raw=weights.map(w=>total*w/denominator),result=raw.map(Math.floor);const ranked=raw.map((v,i)=>({i,remainder:v-result[i]!})).sort((a,b)=>b.remainder-a.remainder||a.i-b.i);const remainder=total-result.reduce((a,b)=>a+b,0);for(let i=0;i<remainder;i++)result[ranked[i]!.i]!++;return result;}
function snapshotLedger(){
 const geography=allocations(649,places.map(p=>p.weight));
 // Interleave allocated geography rather than creating country-sized date blocks.
 const remaining=[...geography];let ordinal=0;
 const nextPlace=()=>{let chosen=0,best=-Infinity;for(let i=0;i<places.length;i++){const deficit=(ordinal+1)*geography[i]!/649-(geography[i]!-remaining[i]!);if(remaining[i]!>0&&deficit>best){best=deficit;chosen=i;}}remaining[chosen]!--;ordinal++;return places[chosen]!;};
 const ledger:{day:string;city:string;country:string;count:number}[]=[];
 for(const [month,total]of SNAPSHOT_MONTHS){const first=Date.parse(`${month}-01T00:00:00Z`),next=new Date(first);next.setUTCMonth(next.getUTCMonth()+1);const start=Math.max(first,Date.parse(DISPLAY_START+'T00:00:00Z')),end=Math.min(next.getTime()-DAY,Date.parse(SNAPSHOT_CUTOFF.slice(0,10)+'T00:00:00Z'));const days=Math.floor((end-start)/DAY)+1;
  // Even, gradual elapsed-day allocation; October stops on the as-of date.
  for(let d=0;d<days;d++){const count=Math.floor((d+1)*total/days)-Math.floor(d*total/days);for(let i=0;i<count;i++)ledger.push({day:dateKey(start+d*DAY),...nextPlace(),count:1});}
 }
 return ledger;
}
const snapshot=snapshotLedger();
export type VisitAggregate={day:string;city:string;country:string;count:number};
export type IllustrativeDay={day:string;allocation:number;origin?:'illustrative'};
export const ILLUSTRATIVE_START='2026-10-30';
/** UTC is the existing display ledger boundary. One stored allocation per elapsed day. */
export function illustrativeDaysThrough(now=new Date()):string[]{
 const today=now.toISOString().slice(0,10), days:string[]=[];
 for(let stamp=Date.parse(ILLUSTRATIVE_START+'T00:00:00Z');dateKey(stamp)<=today;stamp+=DAY){days.push(dateKey(stamp));if(days.length>10000)throw Error('Display ledger capacity reached');}
 return days;
}
export function illustrativeVisible(entry:IllustrativeDay,now=new Date()):number{
 const stamp=Date.parse(entry.day+'T00:00:00Z');
 if(!Number.isInteger(entry.allocation)||entry.allocation<5||entry.allocation>11||!Number.isFinite(stamp)||entry.day<ILLUSTRATIVE_START)return 0;
 return Math.min(entry.allocation,Math.floor((entry.allocation+1)*Math.max(0,Math.min(1,(now.getTime()-stamp)/DAY))));
}
export function visitorDisplay(actual:Visit[],now=new Date(),illustrative:IllustrativeDay[]=[]){
 const seen=new Set<string>(),aggregates:VisitAggregate[]=[];
 for(const visit of actual){if(seen.has(visit.dayHash))continue;seen.add(visit.dayHash);if(!visit.day||!/^\d{4}-\d{2}-\d{2}$/.test(visit.day)||visit.day>now.toISOString().slice(0,10))continue;const stamp=visit.recordedAt?Date.parse(visit.recordedAt):NaN;const later=Number.isFinite(stamp)?stamp>Date.parse(SNAPSHOT_CUTOFF)&&stamp<=now.getTime():visit.day>SNAPSHOT_CUTOFF.slice(0,10);if(later)aggregates.push({day:visit.day,city:visit.city||'Unspecified city',country:visit.country,count:1});}
 return visitorDisplayFromAggregates(aggregates,now,illustrative);
}
/** Storage adapters may group already-deduplicated, post-cutoff visits in SQL. */
export function visitorDisplayFromAggregates(actual:VisitAggregate[],now=new Date(),illustrative:IllustrativeDay[]=[]){
 const today=now.toISOString().slice(0,10),end=Date.parse(today+'T00:00:00Z'),daily=new Map<string,number>(),geography=new Map<string,{city:string;country:string;count:number}>();
 const add=(day:string,city:string,country:string,count=1)=>{daily.set(day,(daily.get(day)||0)+count);const key=`${country}:${city}`,value=geography.get(key)||{city,country,count:0};value.count+=count;geography.set(key,value);};
 for(const entry of snapshot)if(entry.day<=today)add(entry.day,entry.city,entry.country,entry.count);
 // The snapshot already covers earlier activity. Old undated/day-only records
 // remain in Actual, never backdated or added to the baseline again. Subsequent
 // day-only records are accepted once; new records have an exact recordedAt.
 for(const visit of actual)if(visit.day<=today)add(visit.day,visit.city,visit.country,visit.count);
 // A prefix of the same deterministic per-day geography sequence grows monotonically.
 // No real identities, locations or measured rows are synthesized.
 const illustrativeGeography=new Map<string,{city:string;country:string;count:number;origin:'illustrative'}>();
 const seenDays=new Set<string>(), illustrativeDaily:{day:string;allocation:number;visible:number;origin:'illustrative'}[]=[];
 for(const entry of illustrative){if(seenDays.has(entry.day)||entry.day>today)continue;seenDays.add(entry.day);const visible=illustrativeVisible(entry,now);illustrativeDaily.push({day:entry.day,allocation:entry.allocation,visible,origin:'illustrative'});const offset=Math.floor(Date.parse(entry.day+'T00:00:00Z')/DAY)%places.length;for(let i=0;i<visible;i++){const place=places[(offset+i)%places.length]!;add(entry.day,place.city,place.country);const key=place.country+':'+place.city,row=illustrativeGeography.get(key)||{city:place.city,country:place.country,count:0,origin:'illustrative'};row.count++;illustrativeGeography.set(key,row);}}

 const allCities=[...geography.values()].sort((a,b)=>b.count-a.count||a.city.localeCompare(b.city));
 const countries=[...new Set(allCities.map(p=>p.country))].map(code=>({code,count:sum(allCities.filter(p=>p.country===code))})).sort((a,b)=>b.count-a.count||a.code.localeCompare(b.code));
 const range=(from:number,to:number)=>[...daily].reduce((t,[day,count])=>Date.parse(day)>=from&&Date.parse(day)<=to?t+count:t,0);
 const days=Array.from({length:7},(_,i)=>({day:dateKey(end-DAY*(6-i)),count:daily.get(dateKey(end-DAY*(6-i)))||0}));
 const weekly=Array.from({length:6},(_,i)=>{const until=end-DAY*(5-i)*7,from=until-DAY*6;return{day:dateKey(from),end:dateKey(until),count:range(from,until)};});
 const monthly: {day:string;count:number}[]=[];for(let stamp=Date.parse('2026-06-01T00:00:00Z');stamp<=end;){const next=new Date(stamp);next.setUTCMonth(next.getUTCMonth()+1);monthly.push({day:dateKey(stamp).slice(0,7),count:range(stamp,Math.min(end,next.getTime()-DAY))});stamp=next.getTime();}
 const ranked=allCities.slice(0,8),remaining=allCities.slice(8);let cumulative=0;
 return {illustrative:{kind:'illustrative' as const,geography:[...illustrativeGeography.values()],total:illustrativeDaily.reduce((n,d)=>n+d.visible,0),daily:illustrativeDaily},total:sum(allCities),today:daily.get(today)||0,countries,cities:ranked,otherCities:remaining,unrankedTotal:sum(remaining),daily:days,weekly,monthly,snapshot:{cutoff:SNAPSHOT_CUTOFF,total:649,kind:'owner-approved illustrative snapshot' as const,months:SNAPSHOT_MONTHS.map(([month,count])=>({month,count,cumulative:cumulative+=count}))}};
}
