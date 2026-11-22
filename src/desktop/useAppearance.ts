import { useEffect, useState } from 'react';

export type ThemeName = 'dark' | 'light' | 'retro';
export type BootFrequency = 'once' | 'always' | 'never';
export type ScreenSaverMinutes = 0 | 1 | 3 | 5 | 10;
const prefix = 'mendez-95-';
const read = (key: string) => { try { return localStorage.getItem(`${prefix}${key}`); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(`${prefix}${key}`, value); } catch { /* private mode */ } };
const validTheme = (value: string | null): value is ThemeName => value === 'dark' || value === 'light' || value === 'retro';
const validBoot = (value: string | null): value is BootFrequency => value === 'once' || value === 'always' || value === 'never';

export function useAppearance() {
  const [theme, setTheme] = useState<ThemeName>(() => validTheme(read('theme')) ? read('theme') as ThemeName : 'retro');
  const [reduceMotion, setReduceMotion] = useState(() => read('reduce-motion') === null ? matchMedia('(prefers-reduced-motion: reduce)').matches : read('reduce-motion') === 'true');
  const [shadows, setShadows] = useState(() => read('shadows') !== 'false');
  const [screensaverMinutes, setScreensaverMinutes] = useState<ScreenSaverMinutes>(() => { const stored = read('screensaver-minutes'); const value = stored === null ? 3 : Number(stored); return [0,1,3,5,10].includes(value) ? value as ScreenSaverMinutes : 3; });
  const [bootFrequency, setBootFrequency] = useState<BootFrequency>(() => validBoot(read('boot-frequency')) ? read('boot-frequency') as BootFrequency : 'once');
  const [widgetsVisible, setWidgetsVisible] = useState(() => read('widgets-visible') !== 'false');
  const [units, setUnits] = useState<'f'|'c'>(() => read('units') === 'c' ? 'c' : 'f');
  const [clock24, setClock24] = useState(() => read('clock24') === 'true');
  const [soundOn, setSoundOn] = useState(() => read('sound') === 'true');
  useEffect(() => { document.documentElement.dataset.theme = theme; document.title = theme === 'dark' ? 'Mendez OS — Jordan Example' : 'Mendez 95 — Jordan Example'; write('theme', theme); }, [theme]);
  useEffect(() => { document.documentElement.dataset.motion = reduceMotion ? 'reduced' : 'standard'; write('reduce-motion', String(reduceMotion)); }, [reduceMotion]);
  useEffect(() => { document.documentElement.dataset.shadows = shadows ? 'on' : 'off'; write('shadows', String(shadows)); }, [shadows]);
  useEffect(() => { write('screensaver-minutes', String(screensaverMinutes)); }, [screensaverMinutes]);
  useEffect(() => { write('boot-frequency', bootFrequency); }, [bootFrequency]);
  useEffect(() => { write('widgets-visible', String(widgetsVisible)); }, [widgetsVisible]);
  useEffect(() => { write('units', units); }, [units]);
  useEffect(() => { write('clock24', String(clock24)); }, [clock24]);
  useEffect(() => { write('sound', String(soundOn)); }, [soundOn]);
  const resetAppearance = () => { setTheme('retro'); setReduceMotion(matchMedia('(prefers-reduced-motion: reduce)').matches); setShadows(true); setScreensaverMinutes(3); setBootFrequency('once'); setWidgetsVisible(true); setUnits('f'); setClock24(false); setSoundOn(false); };
  const forgetBrowser = () => { try { for (const key of Object.keys(localStorage)) if (key.startsWith('mendez-')) localStorage.removeItem(key); for (const key of Object.keys(sessionStorage)) if (key.startsWith('mendez-')) sessionStorage.removeItem(key); } catch { /* storage unavailable */ } window.location.assign('/'); };
  return { theme, setTheme, reduceMotion, setReduceMotion, shadows, setShadows, screensaverMinutes, setScreensaverMinutes, bootFrequency, setBootFrequency, widgetsVisible, setWidgetsVisible, units, setUnits, clock24, setClock24, soundOn, setSoundOn, resetAppearance, forgetBrowser };
}
