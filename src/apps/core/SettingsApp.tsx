import {useEffect,useState} from 'react';
import {tipsEnabled,setTipsEnabled,subscribeTips} from '../guide/tipPreferences';
import {VisitorIdentityControls} from '../../components/VisitorIdentityControls';
import {usePocketMode} from '../../pocket/layout';
import {usePocketPreferences} from '../../pocket/preferences';
import './pocketSettings.css';
import { useVisitorName } from '../../desktop/visitorIdentity';
import type { BootFrequency, ScreenSaverMinutes, ThemeName } from '../../desktop/useAppearance';

type Props = {
  navigate:(path:string)=>void; safeMode:()=>void; powerOff:()=>void;
  theme: ThemeName; setTheme: (v:ThemeName)=>void;
  reduceMotion:boolean; setReduceMotion:(v:boolean)=>void;
  shadows:boolean; setShadows:(v:boolean)=>void;
  screensaverMinutes:ScreenSaverMinutes; setScreensaverMinutes:(v:ScreenSaverMinutes)=>void;
  bootFrequency:BootFrequency; setBootFrequency:(v:BootFrequency)=>void;
  widgetsVisible:boolean; setWidgetsVisible:(v:boolean)=>void;
  units:'f'|'c'; setUnits:(v:'f'|'c')=>void;
  clock24:boolean; setClock24:(v:boolean)=>void;
  soundOn:boolean; setSoundOn:(v:boolean)=>void;
  resetAppearance:()=>void; forgetBrowser:()=>void; replayBoot:()=>void; startScreensaver:()=>void;
};
const themes: {id:ThemeName; name:string; description:string}[] = [
  {id:'retro',name:'Teal 95',description:'Teal wallpaper, blue chrome, and classic bevels.'},
  {id:'dark',name:'Noir Grid',description:'A quiet dark field with precise highlights.'},
  {id:'light',name:'Monochrome',description:'A bright, low-distraction reading surface.'},
];
function Switch({label, description, value, set}:{label:string;description:string;value:boolean;set:(value:boolean)=>void}) { return <section className="os-settings-row"><div><h2>{label}</h2><p>{description}</p></div><button type="button" className="os-button" role="switch" aria-label={label} aria-checked={value} onClick={()=>set(!value)}>{value?'On':'Off'}</button></section>; }
function PocketSettings({props,setName}:{props:Props;setName:(value:string)=>void}) {
  const pocket=usePocketPreferences();
  const forget=()=>{if(window.confirm('Forget this browser? This removes saved preferences, your local name and local game bests. Public notes, server scores and visitor counts stay.'))props.forgetBrowser();};
  return <div className="os-app pocket-settings"><h1>Settings</h1><p>Make Pocket Edition yours. Changes are saved on this browser.</p>
    <section className="pocket-settings-panel"><h2>Appearance</h2><div className="pocket-theme-choices" role="group" aria-label="Pocket theme">{([{id:'classic',label:'Classic'},{id:'teal',label:'Color'},{id:'midnight',label:'Midnight'}] as const).map(item=><button key={item.id} className={`pocket-theme-tile theme-${item.id}`} aria-pressed={pocket.theme===item.id} onClick={()=>pocket.setTheme(item.id)}><span className="pocket-theme-console" aria-hidden="true"><span>95</span><i className="pocket-device-cross">✚</i><i className="pocket-device-ab">● ●</i></span><strong>{item.label}</strong></button>)}</div></section>
    <VisitorIdentityControls/>
    <section className="pocket-settings-panel"><h2>Display</h2>
      <Switch label="Pixel styling" description="Pixel decoration and headings; body text stays readable." value={pocket.pixels} set={pocket.setPixels}/>
      <Switch label="Animations" description="Decorative movement, when reduced motion allows it." value={pocket.animations} set={pocket.setAnimations}/>
      <Switch label="Reduce motion" description="Takes priority over decorative animations." value={props.reduceMotion} set={props.setReduceMotion}/>
    </section>
    <section className="pocket-settings-panel"><h2>Sound</h2><Switch label="System sound" description="Interface chimes. Music starts only when you press Play." value={props.soundOn} set={props.setSoundOn}/></section>
    <section className="pocket-settings-panel"><h2>System</h2><div className="pocket-system-actions">
      <button onClick={()=>props.navigate('/system-update')}>System Update <span aria-hidden="true">›</span></button>
      <button onClick={props.replayBoot}>Restart <span aria-hidden="true">›</span></button>
      <button onClick={props.safeMode}>Restart in Safe Mode <span aria-hidden="true">›</span></button>
      <button onClick={props.powerOff}>Shut Down <span aria-hidden="true">›</span></button>
      <button onClick={()=>props.navigate('/system-about')}>About Mendez 95 <span aria-hidden="true">›</span></button>
      <button onClick={()=>props.navigate('/help')}>Help <span aria-hidden="true">›</span></button>
    </div></section>
    <details className="pocket-settings-panel pocket-settings-advanced"><summary>Advanced preferences</summary>
      <label className="os-settings-select"><span><strong>Startup sequence</strong><small>Restart always replays startup.</small></span><select value={props.bootFrequency} onChange={event=>props.setBootFrequency(event.target.value as BootFrequency)}><option value="once">Once per visit</option><option value="always">Every page load</option><option value="never">Never on ordinary visits</option></select></label>
      <fieldset><legend>Temperature units</legend><div className="os-segmented">{(['f','c'] as const).map(unit=><button key={unit} aria-pressed={props.units===unit} onClick={()=>props.setUnits(unit)}>{unit==='f'?'Fahrenheit':'Celsius'}</button>)}</div></fieldset>
      <fieldset><legend>Clock format</legend><div className="os-segmented"><button aria-pressed={!props.clock24} onClick={()=>props.setClock24(false)}>12-hour</button><button aria-pressed={props.clock24} onClick={()=>props.setClock24(true)}>24-hour</button></div></fieldset>

      <div className="os-actions"><button className="os-button" onClick={()=>{props.resetAppearance();pocket.reset();setName('');}}>Restore defaults</button><button className="os-button" onClick={forget}>Forget this browser</button></div><p>Restore defaults resets appearance and your local name. Forget this browser also removes local game bests and startup preferences. Neither removes public notes, server scores or visitor counts.</p>
    </details>
  </div>;
}

export function SettingsApp(props:Props) {
  const pocket=usePocketMode();
  const [preparedTips,setPreparedTips]=useState(tipsEnabled);
  useEffect(()=>subscribeTips(()=>setPreparedTips(tipsEnabled())),[]);
  const [,setName]=useVisitorName();
  if(pocket)return <PocketSettings props={props} setName={setName}/>;
  return <div className="os-app os-settings"><div className="os-eyebrow">Control Panel</div><h1>Settings</h1><p>Make the desktop comfortable for this browser. Changes apply immediately.</p>
    <section><h2>Appearance</h2><div className="os-theme-grid">{themes.map(item=><button className={`os-card os-theme-choice os-theme-choice-${item.id}`} key={item.id} aria-pressed={props.theme===item.id} onClick={()=>props.setTheme(item.id)}><strong>{item.name}</strong><span>{item.description}</span></button>)}</div></section>
    <Switch label="Window shadows" description="Show depth around open windows." value={props.shadows} set={props.setShadows}/>
    <Switch label="Reduced motion" description="Quiet decorative movement and use a still maze view." value={props.reduceMotion} set={props.setReduceMotion}/>
    <label className="os-settings-select"><span><strong>Screensaver</strong><small>Start the maze after this much inactivity.</small></span><select value={props.screensaverMinutes} onChange={event=>props.setScreensaverMinutes(Number(event.target.value) as ScreenSaverMinutes)}><option value={0}>Off</option><option value={1}>1 minute</option><option value={3}>3 minutes</option><option value={5}>5 minutes</option><option value={10}>10 minutes</option></select></label>
    <button className="os-text-action" onClick={props.startScreensaver}>Start maze now →</button>
    <label className="os-settings-select"><span><strong>Startup sequence</strong><small>Restart always plays startup, regardless of this setting.</small></span><select value={props.bootFrequency} onChange={event=>props.setBootFrequency(event.target.value as BootFrequency)}><option value="once">Once per visit</option><option value="always">Every page load</option><option value="never">Never on ordinary visits</option></select></label>
    <button className="os-text-action" onClick={props.replayBoot}>Restart now →</button>
    <Switch label="Desktop widgets" description="Show the live information column on wide screens." value={props.widgetsVisible} set={props.setWidgetsVisible}/>
    <section className="os-settings-row"><div><h2>Temperature units</h2><p>For desktop weather and forecasts.</p></div><div className="os-segmented" role="group" aria-label="Temperature units">{(['f','c'] as const).map(unit=><button key={unit} aria-pressed={props.units===unit} onClick={()=>props.setUnits(unit)}>{unit==='f'?'Fahrenheit':'Celsius'}</button>)}</div></section>
    <section className="os-settings-row"><div><h2>Clock format</h2><p>For widgets and taskbar.</p></div><div className="os-segmented" role="group" aria-label="Clock format"><button aria-pressed={!props.clock24} onClick={()=>props.setClock24(false)}>12-hour</button><button aria-pressed={props.clock24} onClick={()=>props.setClock24(true)}>24-hour</button></div></section>
    <VisitorIdentityControls/>
    <Switch label="SNIP-E prepared tips" description="Show occasional prepared tips. Two tip dismissals turn them off; switching on starts a new dismissal cycle." value={preparedTips} set={setTipsEnabled}/>
    <Switch label="System sound" description="Play a small chime for desktop actions. Off by default." value={props.soundOn} set={props.setSoundOn}/>
    <section className="os-settings-danger"><h2>Reset and privacy</h2><div className="os-actions"><button className="os-button" onClick={()=>{props.resetAppearance();setName('');}}>Restore defaults</button><button className="os-button" onClick={()=>{if(window.confirm('Forget this browser? This removes saved preferences, your local name and local game bests. Public notes, server scores and visitor counts stay.'))props.forgetBrowser();}}>Forget this browser</button></div><p>Restore defaults resets these settings. Forget this browser also removes local game bests, saved nickname, and startup preference. It cannot remove public notes, score records, or server counts.</p></section>
  </div>;
}
