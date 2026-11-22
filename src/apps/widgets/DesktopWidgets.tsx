import {useManagedSurface,useWindowManager,WindowControls} from '../../desktop/ManagedWindows';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './widgets.css';
import {fitWidgetColumns} from './widgetLayout';
import {PocketRadio} from './PocketRadio';
import {XPostCard,type PublicXPost} from './XPostCard';
import {validLocation,visitorTimezone,relativeHours,type WidgetLocation} from './location';
import {PersistentMusic,type MusicControls} from './PersistentMusic';
import {selectTopCities} from './visitorPanel';

type Location = WidgetLocation;
type Weather = { temperatureC: number; code: number; isDay: boolean; observedAt: string; source: string; forecast?: { date: string; code: number; highC: number; lowC: number }[] } | null;
type Place = { location: Location; weather: Weather; fallback?: boolean };
type Activity = {otherCities?:{city:string;country:string;count:number}[];unrankedTotal?:number;total:number;today:number;countries:{code:string;count:number}[];cities:{city:string;country:string;count:number}[];daily:{day:string;count:number}[];weekly:{day:string;count:number}[];monthly:{day:string;count:number}[]};
type WidgetData = { xPost?:PublicXPost|null; activity?: Activity; exampleCity: Place; local: Place; visitors: { total: number; countries: { code: string; count: number }[] }; xUrl: string; music: { url: string; canonicalUrl: string; title: string; embedUrl: string | null } };
const CITY_KEY = 'mendez-os-widget-city';
const EXAMPLE_CITY_FALLBACK: Place = { location: { city: 'London', country: 'United Kingdom', countryCode: 'GB', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London', approximate: false }, weather: null, fallback: true };
const CENTROIDS: Record<string, [number, number]> = { US: [-99, 39], CA: [-106, 57], DO: [-70.6, 19], MX: [-102, 23], GB: [-2, 54], FR: [2, 47], DE: [10, 51], ES: [-4, 40], BR: [-51, -10], AR: [-64, -35], CO: [-74, 4], IN: [79, 22], JP: [138, 37], AU: [134, -25], ZA: [25, -29], NG: [8, 9], KE: [38, 0], CN: [104, 35] };
function storedCity(): Location | null {
  try { const value: unknown = JSON.parse(localStorage.getItem(CITY_KEY) || 'null'); const city = value as Location | null; return validLocation(city)?city:null; }
  catch { return null; }
}
function summary(code: number) {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 67) return 'Rain or drizzle';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'Snow';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Mixed conditions';
}
function temp(weather: Weather, units: 'f' | 'c') { return weather ? `${Math.round(units === 'f' ? weather.temperatureC * 9 / 5 + 32 : weather.temperatureC)}°${units.toUpperCase()}` : '—'; }
function clock(zone: string, format24: boolean, now: number) {
  try { return new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit', hour12: !format24 }).format(now); }
  catch { return '—'; }
}
function countryName(code: string) {
  if (code === 'ZZ') return 'Unknown';
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code; }
  catch { return code; }
}
function Chrome({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="os-widget" data-widget={title}><div className="os-widget-title"><strong>{title}</strong></div><div className="os-widget-body">{children}</div></section>;
}
function VisitorMap({ countries }: { countries: { code: string; count: number }[] }) {
  return <div className="os-widget-map" role="img" aria-label="Schematic world map with country markers for illustrative display activity">
    <svg viewBox="0 0 300 150" aria-hidden="true">
      <rect x="1" y="1" width="298" height="148" rx="6" fill="none" stroke="currentColor" opacity=".45" />
      <g fill="currentColor" opacity=".2">
        <path d="M10 28 22 18 39 13 52 17 60 24 72 21 84 29 89 40 81 47 76 55 69 57 64 66 57 61 51 50 43 46 37 52 31 51 26 43 18 42 12 35Z" />
        <path d="M83 68 94 65 106 69 115 77 118 87 112 96 108 108 101 119 96 130 90 122 87 108 84 95 78 83Z" />
        <path d="M76 12 84 7 95 9 102 16 97 23 87 25 79 21Z" />
        <path d="M137 37 146 30 160 30 169 35 171 43 166 50 156 51 148 47 139 49 134 43Z" />
        <path d="M140 58 152 52 168 55 178 65 181 80 173 95 162 108 154 119 146 112 141 99 137 84 132 72Z" />
        <path d="M164 32 179 24 192 24 201 17 218 16 233 21 247 18 265 27 276 37 283 46 273 54 259 51 249 59 237 59 229 70 218 71 207 64 199 58 191 52 180 53 169 48Z" />
        <path d="M246 112 254 105 268 104 280 111 283 120 274 128 258 127 248 122Z" />
        <path d="M112 143 146 138 172 141 205 138 227 144 218 149 120 149Z" />
      </g>
      <path d="M0 37.5h300M0 75h300M0 112.5h300M75 0v150M150 0v150M225 0v150" stroke="currentColor" opacity=".12" />
      {countries.filter(item => CENTROIDS[item.code]).sort((a,b)=>b.count-a.count).map(item => {
        const [lon, lat] = CENTROIDS[item.code]!;
        return <circle key={item.code} cx={(lon + 180) / 360 * 300} cy={(90 - lat) / 180 * 150} r={Math.min(10, 3 + Math.sqrt(item.count))} fill="currentColor"><title>{countryName(item.code)}: {item.count}</title></circle>;
      })}
    </svg>
  </div>;
}
function WeatherIcon({ weather }: { weather: Weather }) {
  const code=weather?.code;
  const snow=code!==undefined&&((code>=71&&code<=77)||code===85||code===86);
  const rain=code!==undefined&&((code>=51&&code<=67)||(code>=80&&code<=82));
  const fog=code===45||code===48, thunder=code!==undefined&&code>=95;
  const clear=code===0, sun=clear||code===1||code===2;
  return <svg className="os-weather-icon" viewBox="0 0 64 48" role="img" aria-label={weather?summary(weather.code):'Weather unavailable'}>
    {code===undefined?<text x="25" y="32" fill="currentColor" fontSize="28">—</text>:<>
      {sun&&(weather?.isDay?<g stroke="#b57a19" strokeWidth="2" fill="#f4c65c"><circle cx="25" cy="20" r="10"/><path d="M25 2v5m0 26v5M7 20h5m26 0h5M12 7l4 4m18 18 4 4M12 33l4-4M34 11l4-4"/></g>:<path d="M29 5a15 15 0 1 0 17 23C32 32 21 18 29 5" fill="#b8c8e3" stroke="#526d7a"/>)}
      {!clear&&<path d="M15 31c-12-2-10-17 1-17 3-14 25-13 28 0 14-2 18 17 4 17Z" fill="#d6e4e7" stroke="#526d7a" strokeWidth="2"/>}
      {rain&&<path d="m21 36-3 8m14-8-3 8m14-8-3 8" stroke="#397ca8" strokeWidth="3"/>}
      {snow&&<g fill="#e4f8ff" stroke="#526d7a"><circle cx="21" cy="39" r="2"/><circle cx="32" cy="43" r="2"/><circle cx="43" cy="38" r="2"/></g>}
      {fog&&<path d="M11 35h43M8 40h40M16 45h39" stroke="#70858d" strokeWidth="3"/>}
      {thunder&&<path d="m32 28-10 12h9l-3 8 15-16h-11l4-4" fill="#f4c65c" stroke="#956f22"/>}
    </>}
  </svg>;
}
function WidgetDialog({ title, panel, close, children }: { title: string; panel: string; close: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="os-widget-dialog os-window is-active" data-widget-dialog={panel} aria-label={title} onCancel={event => { event.preventDefault(); close(); }}>
    <div className="os-titlebar"><strong>{title}</strong><button className="os-close" aria-label={`Close ${title}`} onClick={close}>×</button></div><div className="os-widget-expanded">{children}</div>
  </dialog>;
}
function WidgetWindow({title,panel,close,children,onRestore}:{title:string;panel:string;close:()=>void;children:React.ReactNode;onRestore?:()=>void}){
 const ref=useRef<HTMLElement>(null),frame=useManagedSurface({id:`widget-${panel}`,title,ref,onRestore,onClose:close});
 return <section ref={ref} tabIndex={-1} role="dialog" aria-modal="false" aria-label={title} data-managed="widget" data-widget-dialog={panel} data-minimized={frame.minimized} data-active={String(frame.active)} inert={frame.minimized} aria-hidden={frame.minimized} style={frame.style} className={`os-managed-widget os-window ${frame.active?'is-active':''}`} onPointerDown={frame.focus}>
 <div className="os-titlebar" {...frame.titlebar}><strong>{title}</strong><WindowControls title={title} minimize={frame.minimize} close={close}/></div><div className="os-widget-expanded">{children}</div></section>;
}
export function DesktopWidgets({ units, clock24, visible = true,pocket=false,route='/',navigate=()=>{},stopAudio=false,closeUtility=()=>{} }: { units: 'f' | 'c'; clock24: boolean; visible?: boolean;pocket?:boolean;route?:string;navigate?:(path:string)=>void;stopAudio?:boolean;closeUtility?:(id:string)=>void }) {
  const windowManager=useWindowManager();
  const widgetRoot=useRef<HTMLElement>(null);
  const [leftWidgets,setLeftWidgets]=useState(['Weather','World Clock','Music','Visitor Count']);
  useLayoutEffect(()=>{
    if(pocket||!visible)return;const root=widgetRoot.current;if(!root)return;let frame=0;
    const fit=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      const names=['Weather','World Clock','Music','Visitor Count','Signal Window','Around the World'];
      const heights=names.map(name=>root.querySelector<HTMLElement>(`[data-widget="${name}"]`)?.offsetHeight||0);if(heights.some(value=>!value))return;
      const taskbar=document.querySelector('.os-taskbar')?.getBoundingClientRect().top??window.innerHeight;const available=Math.min(root.parentElement!.clientHeight,taskbar-root.getBoundingClientRect().top-8);const chosen=fitWidgetColumns(names,heights,available);setLeftWidgets(current=>current.join('|')===chosen.join('|')?current:chosen);
    });};
    const observer=new ResizeObserver(fit);observer.observe(root.parentElement!);root.querySelectorAll('.os-widget').forEach(node=>observer.observe(node));fit();return()=>{observer.disconnect();cancelAnimationFrame(frame);};
  },[pocket,visible,leftWidgets]);
  const [data, setData] = useState<WidgetData | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [manual, setManual] = useState<Location | null>(storedCity);
  const [localWeather, setLocalWeather] = useState<Weather>(null);
  const [cityQuery, setCityQuery] = useState('');
  const [matches, setMatches] = useState<Location[]>([]);
  const [cityStatus, setCityStatus] = useState('');
  const [panel, setPanelState] = useState<'city'|'weather'|'clock'|'visitors'|'countries'|'music'|'signal'|null>(null);
  const [openPanels,setOpenPanels]=useState<string[]>([]);
  const setPanel=(value:typeof panel)=>{setPanelState(value);if(!pocket&&value&&value!=='city'){windowManager.restore(`widget-${value}`);setOpenPanels(current=>current.includes(value)?current:[...current,value]);}};
  const [period,setPeriod] = useState<'daily'|'weekly'|'monthly'>('daily');
  const musicController=useRef<MusicControls>(null);
  const [musicPlaying,setMusicPlaying]=useState(false),[musicStatus,setMusicStatus]=useState('');
  const musicState=useCallback((playing:boolean,status:string)=>{setMusicPlaying(playing);setMusicStatus(status);},[]);
  const refreshRef=useRef<()=>void>(()=>{});
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    let active=true,last=0,inflight=false;
    const refresh=()=>{if(document.visibilityState!=='visible'||inflight||Date.now()-last<20_000)return;inflight=true;last=Date.now();void fetch('/api/widgets',{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error();return r.json();}).then(value=>{if(active){setData(value);setError('');}}).catch(()=>{if(active)setError('Live widget data is unavailable right now.');}).finally(()=>{inflight=false;});};
    refreshRef.current=refresh;refresh();const timer=setInterval(refresh,20_000);const focus=()=>{if(document.visibilityState==='visible')refresh();};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};
  }, []);
  useEffect(()=>{if(panel==='weather'||panel==='clock')refreshRef.current();},[panel]);
  useEffect(() => {
    if (!manual) return;
    let active = true;
    const params = new URLSearchParams({ lat: String(manual.latitude), lon: String(manual.longitude), timezone: manual.timezone });
    fetch(`/api/widgets/weather?${params}`).then(async response => { if (!response.ok) throw new Error(); return response.json(); }).then(value => { if (active) setLocalWeather(value.weather); }).catch(() => { if (active) setLocalWeather(null); });
    return () => { active = false; };
  }, [manual,data]);
  const utilityMap:Record<string,'weather'|'clock'|'music'|'visitors'|'signal'>={'/weather':'weather','/world-time':'clock','/pocket-radio':'music','/visitor-log':'visitors','/signal':'signal'};
  const utility=utilityMap[route.split('?')[0]!.split('#')[0]!];
  useEffect(()=>{if(utility==='weather'||utility==='clock')refreshRef.current();},[utility]);
  const activePanel=panel==='city'||panel==='countries'?panel:utility||panel;
  useEffect(()=>{setPanelState(null);if(!pocket&&utility){windowManager.restore(`widget-${utility}`);setOpenPanels(current=>current.includes(utility)?current:[...current,utility]);}},[route,pocket,utility]);
  useEffect(()=>{if(stopAudio||pocket)musicController.current?.pause();},[stopAudio,pocket]);
  const closePanel=()=>{if(panel==='city'||panel==='countries')setPanelState(null);else if(utility)navigate('/tools');else setPanelState(null);};
  const closeDesktopPanel=(name:string)=>{setOpenPanels(current=>current.filter(item=>item!==name));if(panel===name)setPanelState(null);if(utility===name){const id=Object.entries(utilityMap).find(([,value])=>value===name)?.[0]?.slice(1);if(id)closeUtility(id);}};
  const activity=data?.activity;
  const visitors=activity || data?.visitors;
  const topCities=selectTopCities([...(activity?.cities || []),...(activity?.otherCities || [])]);
  const cityRemainders=(visitors?.countries||[]).map(country=>({...country,count:country.count-topCities.filter(city=>city.country===country.code).reduce((total,city)=>total+city.count,0)})).filter(country=>country.count>0);
  const exampleCity:Place = {location:EXAMPLE_CITY_FALLBACK.location,weather:data?.exampleCity?.weather||null};
  const local: Place = manual ? { location: manual, weather: localWeather, fallback: false } : (data?.local&&validLocation(data.local.location)&&data.local.fallback===false?data.local:{ ...exampleCity, fallback: true });
  const visitorZone=visitorTimezone(Boolean(local.fallback),local.location,Intl.DateTimeFormat().resolvedOptions().timeZone);
  async function searchCity(event: React.FormEvent) {
    event.preventDefault(); setCityStatus('Searching…'); setMatches([]);
    try {
      const response = await fetch(`/api/widgets/city?q=${encodeURIComponent(cityQuery.trim())}`);
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'City search failed.');
      const validMatches=Array.isArray(result.matches)?result.matches.filter(validLocation):[];setMatches(validMatches); setCityStatus(validMatches.length ? 'Choose a city.' : 'No matching city found.');
    } catch (cause) { setCityStatus(cause instanceof Error ? cause.message : 'City search failed.'); }
  }
  function chooseCity(city: Location) {
    if(!validLocation(city))return;
    city={...city,approximate:false};
    setManual(city); setLocalWeather(null); setMatches([]); setPanel(null); setCityStatus('');
    try { localStorage.setItem(CITY_KEY, JSON.stringify(city)); } catch { /* storage unavailable */ }
  }
  function resetCity() { setManual(null); setLocalWeather(null); refreshRef.current(); setPanel(null); try { localStorage.removeItem(CITY_KEY); } catch { /* storage unavailable */ } }
  const cityForm = <form className="os-widget-city" onSubmit={event => void searchCity(event)}><label htmlFor="widget-city">City name</label><div><input id="widget-city" value={cityQuery} onChange={event => setCityQuery(event.target.value)} minLength={2} maxLength={70} placeholder="City, country" required /><button type="submit">Find</button></div>{cityStatus && <p role="status">{cityStatus}</p>}{matches.length > 0 && <ul>{matches.map(city => <li key={`${city.city}:${city.countryCode}:${city.latitude}`}><button type="button" onClick={() => chooseCity(city)}>{city.city}, {city.country}</button></li>)}</ul>}{manual && <button type="button" onClick={resetCity}>Reset to automatic city</button>}<small>Automatic location is approximate. You can correct it here.</small></form>;
  const music = <><div className="os-widget-music"><div className="os-widget-disc" aria-hidden="true"><span /></div><div><strong>{data?.music.title || 'SoundCloud selection'}</strong><p aria-live={panel==='music'?'off':'polite'} aria-atomic="true">{musicStatus||'Chosen by Jordan. A little 1995 energy.'}</p></div></div><p>Press Play to start. No autoplay, no CD-ROM required.</p></>;
  const cities = [{city:'Los Angeles',zone:'America/Los_Angeles'},{city:'New York',zone:'America/New_York'},{city:'London',zone:'Europe/London'},{city:'Tokyo',zone:'Asia/Tokyo'}];
  const rows = [{city:'London',zone:exampleCity.location.timezone,label:'Jordan’s location'},{city:local.fallback?'City unavailable':local.location.city,zone:visitorZone,label:'You'},...cities.map(item=>({...item,label:''}))];
  const monthRange=activity?.monthly.length?new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).formatRange(new Date(activity.monthly[0]!.day+'-01T00:00:00Z'),new Date(activity.monthly.at(-1)!.day+'-01T00:00:00Z')):'';
  const expandedFor=(activePanel:string)=><>    {activePanel==='city' && cityForm}
    {activePanel==='weather' && <><button className="os-button" onClick={()=>setPanel('city')}>Change city</button><p>{manual?'Manual city selection':local.fallback?'Automatic city unavailable. London weather is a fallback; your clock uses time zone only.':'Approximate automatic location'}</p>{[exampleCity,local].map((place,index)=><section className="os-forecast-place" key={index}><h2>{index===0?'London — Jordan’s location':local.fallback?'Location unavailable — You':`${place.location.city} — You`}</h2><div className="os-weather-reading"><WeatherIcon weather={place.weather}/><strong>{temp(place.weather,units)}</strong></div>{place.weather?.forecast?.length?<div className="os-forecast-grid">{place.weather.forecast.map(day=><div key={day.date}><b>{new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:'UTC'}).format(new Date(`${day.date}T12:00:00Z`))}</b><WeatherIcon weather={{temperatureC:day.highC,code:day.code,isDay:true,observedAt:day.date,source:'Open-Meteo'}}/><span>{Math.round(units==='f'?day.highC*9/5+32:day.highC)}° / {Math.round(units==='f'?day.lowC*9/5+32:day.lowC)}°</span></div>)}</div>:<p>Forecast unavailable right now.</p>}</section>)}<small>Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>. Visitor location is approximate.</small></>}
    {activePanel==='clock' && <><h2>Time relative to yours</h2><div className="os-world-clock-list">{rows.map((item,index)=>{const difference=relativeHours(item.zone,visitorZone,now);return <div key={index}><span><b>{item.city}</b><small>{item.label&&`${item.label} · `}{difference===null?'Time unavailable':difference===0?'Same time':`${Math.abs(difference)} hours ${difference>0?'ahead':'behind'}`}</small></span><strong>{clock(item.zone,clock24,now)}</strong></div>;})}</div><button onClick={()=>setPanel('city')}>Change city</button></>}
    {activePanel==='visitors' && <><p className="os-widget-disclosure">Owner-approved illustrative baseline and daily display allocations, plus measured public visits. This is not a verified audience total. Actual analytics remain separate.</p><h2>{visitors?.total ?? '—'} all-time visitors</h2>{activity&&<><p>{activity.today} today</p><div className="os-widget-actions">{(['daily','weekly','monthly'] as const).map((value,i)=><button key={value} aria-pressed={period===value} onClick={()=>setPeriod(value)}>{['Last 7 days','Last 6 weeks','Monthly since launch'][i]}</button>)}</div>{period==='monthly'&&<h3>{monthRange}</h3>}<div className="os-traffic-chart" aria-label="Visitor history">{activity[period].map(bar=><div key={bar.day}><b>{bar.count}</b><span style={{height:`${Math.max(2,bar.count/Math.max(1,...activity[period].map(p=>p.count))*100)}px`}}/><small>{period==='monthly'?new Intl.DateTimeFormat('en-US',{month:'short',timeZone:'UTC'}).format(new Date(bar.day+'-01T00:00:00Z')):bar.day.slice(5)||bar.day}</small></div>)}</div></>}</>}
    {activePanel==='countries' && <><p className="os-widget-disclosure">Owner-approved illustrative baseline and daily display allocations, plus measured public visits. This is not a verified audience total. Actual analytics remain separate.</p><VisitorMap countries={visitors?.countries || []}/><p>{visitors?.total ?? '—'} visitors · {visitors?.countries.filter(item=>item.code!=='ZZ').length ?? '—'} countries{activity?` · ${activity.today} today`:''}</p><h3>Top cities</h3>{topCities.length>0?<ol className="os-city-ranking">{topCities.map(city=><li key={`${city.city}:${city.country}`}><span>{city.city}, {countryName(city.country)}</span><b>{city.count}</b></li>)}</ol>:<p>No city data available.</p>}{cityRemainders.length>0&&<small className="os-city-remainder">Outside the ranked cities: {cityRemainders.map(country=>`${countryName(country.code)} ${country.count}`).join(' · ')}. Included in country totals.</small>}</>}

    {activePanel==='signal'&&<XPostCard post={data?.xPost}/>}
</>;
  const widgetCards:Record<string,React.ReactNode>={
    'Weather':<Chrome title="Weather"><div className="os-widget-weather">{[exampleCity,local].map((place,index)=><div key={index}><small>{index===0?'London — Jordan’s location':local.fallback?'Location unavailable — You':`${place.location.city} — You`}</small><div className="os-weather-reading"><WeatherIcon weather={place.weather}/><strong>{temp(place.weather,units)}</strong></div><span>{place.weather?summary(place.weather.code):'Weather unavailable'}</span></div>)}</div><small>{manual?'Your chosen city':local.fallback?'City unavailable · London weather fallback':'Your city · approximate'}</small><div className="os-widget-actions"><button onClick={()=>setPanel('city')}>Change city</button><button onClick={()=>setPanel('weather')}>Open</button></div></Chrome>,
    'World Clock':<Chrome title="World Clock"><div className="os-widget-clocks"><div><small>Jordan’s location · London</small><strong>{clock(exampleCity.location.timezone,clock24,now)}</strong></div><div><small>{local.fallback?'Timezone only':local.location.city} — You</small><strong>{clock(visitorZone,clock24,now)}</strong></div></div><div className="os-widget-actions"><button onClick={()=>setPanel('clock')}>Open</button></div></Chrome>,
    'Music':<Chrome title="Music">{music}<div className="os-widget-actions"><button onClick={()=>musicController.current?.toggle()} disabled={!data?.music.embedUrl}>{musicPlaying?'Pause':'Play'}</button><button onClick={()=>setPanel('music')}>Open player</button></div></Chrome>,
    'Visitor Count':<Chrome title="Visitor Count"><div className="os-passport-stamp"><span className="os-passport-label">MENDEZ 95 · VISITORS</span><strong className="os-widget-number">{visitors?.total ?? '—'}</strong><span>Thanks for stopping by</span></div><small className="os-passport-origin">Display activity · illustrative baseline</small><div className="os-widget-actions"><button onClick={()=>setPanel('visitors')}>Open</button></div></Chrome>,
    'Signal Window':<Chrome title="Signal Window"><XPostCard post={data?.xPost} compact open={()=>setPanel('signal')}/></Chrome>,
    'Around the World':<Chrome title="Around the World"><small>Illustrative display activity</small><VisitorMap countries={visitors?.countries || []}/><p>{visitors?.total ?? '—'} visitors · {visitors?.countries.filter(item=>item.code!=='ZZ').length ?? '—'} countries{activity?` · ${activity.today} today`:''}</p><button onClick={()=>setPanel('countries')}>Open</button></Chrome>
  };
  return <>
  {!pocket&&visible&&<aside ref={widgetRoot} className="os-widgets" aria-label="Desktop widgets">
    {error && <p className="os-widget-error" role="status">{error}</p>}
    {['left','right'].map(side=><div key={side} className={`os-widget-stack os-widget-stack--${side}`}>{Object.entries(widgetCards).filter(([name])=>leftWidgets.includes(name)===(side==='left')).map(([name,card])=><div className="os-widget-slot" key={name}>{card}</div>)}</div>)}</aside>}

  <PocketRadio open={pocket&&utility==='music'} enabled={pocket&&!stopAudio} navigate={navigate}/>
  <PersistentMusic src={data?.music.embedUrl||null} title={data?.music.title||'SoundCloud selection'} open={!pocket&&openPanels.includes('music')} pocket={pocket} controllerRef={musicController} status={musicStatus} close={()=>closeDesktopPanel('music')} onState={musicState}/>
  {pocket&&activePanel&&activePanel!=='music'&&activePanel!=='city'&&<main className="pocket-utility" data-utility={activePanel} aria-label={activePanel==='clock'?'World Time':activePanel==='weather'?'Weather Station':activePanel==='signal'?'Mendez Broadcast':'Visitor Count'}><button className="os-text-action" onClick={()=>navigate(activePanel==='signal'?'/tools?section=Mendez%20World':'/tools')}>{activePanel==='signal'?'← Mendez World':'← Tools'}</button><h1>{activePanel==='clock'?'World Time':activePanel==='weather'?'Weather Station':activePanel==='signal'?'Mendez Broadcast':'Visitor Count'}</h1>{expandedFor(activePanel)}{activePanel==='visitors'&&<button className="os-button" onClick={()=>setPanel('countries')}>Countries & Top Cities</button>}{activePanel==='countries'&&<button className="os-button" onClick={()=>setPanel(null)}>Visitor totals</button>}</main>}
  {!pocket&&openPanels.filter(name=>name!=='music').map(name=><WidgetWindow key={name} panel={name} title={name==='weather'?'Five-day weather':name==='clock'?'World Clock':name==='countries'?'Around the World':name==='signal'?'Signal Window':'Visitor Count'} close={()=>closeDesktopPanel(name)}>{expandedFor(name)}</WidgetWindow>)}
  {panel==='city'&&<WidgetDialog panel="city" title="Change city" close={()=>setPanelState(null)}>{cityForm}</WidgetDialog>}

  </>;
}
export default DesktopWidgets;
