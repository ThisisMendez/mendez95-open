import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
export type PocketTheme='teal'|'classic'|'midnight';
const read=(key:string,fallback:string)=>{try{return localStorage.getItem('mendez-pocket-'+key)||fallback;}catch{return fallback;}};
const write=(key:string,value:string)=>{try{localStorage.setItem('mendez-pocket-'+key,value);}catch{/* optional storage */}};
const useStateValue=()=>{const [theme,setThemeState]=useState<PocketTheme>(()=>{const v=read('theme','teal');return v==='classic'||v==='midnight'?v:'teal';}),[pixels,setPixelsState]=useState(()=>read('pixels','1')==='1'),[animations,setAnimationsState]=useState(()=>read('animations','1')==='1');
 const setTheme=(v:PocketTheme)=>{setThemeState(v);write('theme',v);};const setPixels=(v:boolean)=>{setPixelsState(v);write('pixels',v?'1':'0');};const setAnimations=(v:boolean)=>{setAnimationsState(v);write('animations',v?'1':'0');};
 useEffect(()=>{document.documentElement.dataset.pocketTheme=theme;document.documentElement.dataset.pocketPixels=String(pixels);document.documentElement.dataset.pocketAnimations=String(animations);},[theme,pixels,animations]);return{theme,setTheme,pixels,setPixels,animations,setAnimations,reset:()=>{setTheme('teal');setPixels(true);setAnimations(true);}};};
type State=ReturnType<typeof useStateValue>;const Context=createContext<State|null>(null);
export function PocketPreferencesProvider({children}:{children:ReactNode}){const value=useStateValue();return <Context.Provider value={value}>{children}</Context.Provider>;}
export function usePocketPreferences(){const value=useContext(Context);if(!value)throw new Error('Pocket preference provider unavailable');return value;}
