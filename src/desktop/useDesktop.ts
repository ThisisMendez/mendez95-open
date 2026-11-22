import {POCKET_QUERY,pathForLayout} from '../pocket/layout';
import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveRoute, type RouteMatch } from './router';

export type WindowRecord = { key: string; path: string; appId: NonNullable<RouteMatch['appId']>; z: number; transition?:'navigate'|'history' };
type DesktopState = { route: string; windows: WindowRecord[]; activeKey: string | null; nextZ: number };

function fromPath(path: string, previous?: DesktopState, transition:'navigate'|'history'='navigate'): DesktopState {
  path=pathForLayout(path,matchMedia(POCKET_QUERY).matches);
  const route = resolveRoute(path);
  const url = new URL(path, window.location.origin);
  const fullPath = `${route.path}${url.search}${url.hash}`;
  const next = previous ?? { route: '/', windows: [], activeKey: null, nextZ: 20 };
  if (!route.appId) return { ...next, route: route.path, windows: next.windows, activeKey: null };
  let windows = [...next.windows];
  let nextZ = next.nextZ;
  // Folder, overview and full article share one identity and scroll owner.
  const key = `/${route.appId}`;
  const existing = windows.find(item => item.key === key);
  if (existing) windows = windows.map(item => item.key === key ? { ...item, path: fullPath, z: nextZ, transition } : item);
  else windows.push({ key, path: fullPath, appId: route.appId, z: nextZ, transition });
  return { route: fullPath, windows, activeKey: key, nextZ: nextZ + 1 };
}

export function useDesktop() {
  const [state, setState] = useState<DesktopState>(() => fromPath(window.location.pathname+window.location.search+window.location.hash));
  useEffect(()=>{const query=matchMedia(POCKET_QUERY);const reconcile=()=>{const current=window.location.pathname+window.location.search+window.location.hash,next=pathForLayout(current,query.matches);if(next!==current){window.history.replaceState({},'',next);setState(state=>fromPath(next,state));}};query.addEventListener('change',reconcile);reconcile();return()=>query.removeEventListener('change',reconcile);},[]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [preview, setPreview] = useState(() => new URLSearchParams(window.location.search).get('preview') === '1');
  const [publicMode, setPublicMode] = useState(() => new URLSearchParams(window.location.search).get('public') === '1');

  const urlFor = useCallback((path: string) => {
    const target = new URL(path, window.location.origin);
    if (preview) target.searchParams.set('preview', '1');
    if (publicMode) target.searchParams.set('public', '1');
    return `${target.pathname}${target.search}${target.hash}`;
  }, [preview, publicMode]);

  const navigate = useCallback((path: string) => {
    const target = new URL(pathForLayout(path,matchMedia(POCKET_QUERY).matches), window.location.origin);
    const nextPublic = target.searchParams.get('public') === '1' || publicMode;
    const nextPreview = !nextPublic && (target.searchParams.get('preview') === '1' || preview);
    const route = resolveRoute(target.pathname);
    if(nextPreview)target.searchParams.set('preview','1');else target.searchParams.delete('preview');
    if(nextPublic)target.searchParams.set('public','1');else target.searchParams.delete('public');
    const url = `${route.path}${target.search}${target.hash}`;
    window.history.pushState({}, '', url);
    if (target.hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
    setPreview(nextPreview);
    setPublicMode(nextPublic);
    setState(current => fromPath(url, current));
  }, [preview, publicMode]);
  useEffect(()=>{const handle=(event:Event)=>{const path=(event as CustomEvent<unknown>).detail;if(typeof path==='string'&&/^\/(?:work|contact|side-projects)(?:\/|\?|$)/.test(path))navigate(path);};window.addEventListener('mendez-navigate',handle);return()=>window.removeEventListener('mendez-navigate',handle);},[navigate]);

  const showDesktop = useCallback(() => {
    window.history.pushState({}, '', urlFor('/'));
    setState(current => ({ ...current, route: '/', activeKey: null }));
  }, [urlFor]);

  const focusWindow = useCallback((key: string) => {
    const target = stateRef.current.windows.find(item => item.key === key);
    if (!target) return;
    window.history.pushState({}, '', urlFor(target.path));
    setState(current => {
      return { ...current, route: target.path, activeKey: key, nextZ: current.nextZ + 1, windows: current.windows.map(item => item.key === key ? { ...item, z: current.nextZ } : item) };
    });
  }, [urlFor]);

  const closeWindow = useCallback((key: string) => {
    const visible=new Set([...document.querySelectorAll<HTMLElement>('.os-window[data-window-key][data-minimized="false"]')].map(node=>node.dataset.windowKey));
    const remainingNow = stateRef.current.windows.filter(item => item.key !== key);
    if (remainingNow.length === stateRef.current.windows.length) return;
    const preferredNow = key.startsWith('/work/') ? remainingNow.find(item => item.key === '/work') : undefined;
    const topNow = preferredNow ?? remainingNow.filter(item=>visible.has(item.key)).sort((a, b) => b.z - a.z)[0];
    window.history.pushState({}, '', urlFor(topNow?.path ?? '/'));
    setState(current => {
      const remaining = current.windows.filter(item => item.key !== key);
      const preferred = key.startsWith('/work/') ? remaining.find(item => item.key === '/work') : undefined;
      const top = preferred ?? remaining.filter(item=>visible.has(item.key)).sort((a, b) => b.z - a.z)[0];
      const target = top?.path ?? '/';
      return { ...current, route: target, windows: remaining, activeKey: top?.key ?? null };
    });
  }, [urlFor]);

  useEffect(() => {
    const onPop = () => {
      setPreview(new URLSearchParams(window.location.search).get('preview') === '1');
      setPublicMode(new URLSearchParams(window.location.search).get('public') === '1');
      const currentPath=window.location.pathname+window.location.search+window.location.hash,nextPath=pathForLayout(currentPath,matchMedia(POCKET_QUERY).matches);
      if(nextPath!==currentPath)window.history.replaceState({},'',nextPath);
      setState(current => fromPath(nextPath, current,'history'));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);


  return { ...state, preview, publicMode, navigate, focusWindow, closeWindow, showDesktop, urlFor };
}
