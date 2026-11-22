import {afterAll,beforeAll,expect,it} from 'vitest';
import express from 'express';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {Server} from 'node:http';
import {CHARACTERS,COLORS,noteAppearance} from '../src/apps/board/appearance';
let server:Server,base='',dir='';
const legacy={id:'1234567890abcdef12345678',name:'Old author',text:'An old multiline\nnote stays intact.',x:813,y:26,status:'published',createdAt:'2024-02-03T10:20:00.000Z',updatedAt:'2024-02-03T10:20:00.000Z'};
beforeAll(async()=>{
 dir=await mkdtemp(join(tmpdir(),'mendez-lounge-test-'));process.env.MENDEZ_OS_DATA_DIR=dir;
 await writeFile(join(dir,'board.json'),JSON.stringify([legacy,{...legacy,id:'pending',status:'pending'},{...legacy,id:'removed',status:'removed'}]));
 const {mountBoardRoutes}=await import('./board');const app=express();app.use(express.json());mountBoardRoutes(app);
 server=await new Promise<Server>(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});const address=server.address();if(!address||typeof address==='string')throw new Error('No port');base=`http://127.0.0.1:${address.port}`;
});
afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(dir,{recursive:true,force:true});});
const feed=async()=>(await(await fetch(`${base}/api/board`)).json());
const post=(body:unknown)=>fetch(`${base}/api/board`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
it('projects deterministic legacy decoration without modifying records; counts only published real notes',async()=>{
 const before=await readFile(join(dir,'board.json'),'utf8');const a=await feed(),b=await feed();expect(a.publishedCount).toBe(1);expect(a.notes).toEqual(b.notes);expect(a.notes[0]).toMatchObject({...noteAppearance(legacy),id:legacy.id,name:legacy.name,text:legacy.text,x:813,y:26,createdAt:legacy.createdAt});expect(a.notes).toHaveLength(21);expect(a.notes.some((n:{id:string})=>n.id==='pending'||n.id==='removed')).toBe(false);expect(await readFile(join(dir,'board.json'),'utf8')).toBe(before);
});
it('validates the complete character/color allowlists before rate counting or persistence',async()=>{
 expect(CHARACTERS).toHaveLength(20);expect(new Set(CHARACTERS).size).toBe(20);expect(COLORS).toHaveLength(6);
 for(const invalid of [{characterId:'mario'},{colorId:'red'},{characterId:null},{colorId:[]},{characterId:4},{colorId:'TEAL'}]){expect((await post({text:'A friendly note.',...invalid})).status).toBe(400);}
 expect((await feed()).publishedCount).toBe(1);
});
it('defaults blank/omitted names on the server and persists chosen appearance; keeps legacy bytes unchanged',async()=>{
 const first=await post({name:'  ',text:'Hello there!\nA little wave.',characterId:'echo',colorId:'violet'});expect(first.status).toBe(201);const {note}=await first.json();expect(note).toMatchObject({name:'Visitor',text:'Hello there!\nA little wave.',characterId:'echo',colorId:'violet',x:260,y:240});
 const second=await post({text:'Dropped by to say hello.'});expect(second.status).toBe(201);expect((await second.json()).note).toMatchObject({name:'Visitor',characterId:'scout',colorId:'teal'});
 for(const name of [null,8,{},'a'])expect((await post({name,text:'A note stays a note.'})).status).toBe(400);
 const stored=JSON.parse(await readFile(join(dir,'board.json'),'utf8'));expect(stored[0]).toEqual(legacy);expect(stored.find((n:{id:string})=>n.id===note.id)).toMatchObject({name:'Visitor',characterId:'echo',colorId:'violet',status:'published'});expect((await feed()).publishedCount).toBe(3);
});
it('accepts an added portrait through the public screened submission boundary',async()=>{
 const response=await post({name:'API Fixture',text:'A friendly hello from a local fixture.',characterId:'indigo',colorId:'amber'});
 expect(response.status).toBe(201);const {note}=await response.json();expect(note).toMatchObject({name:'API Fixture',characterId:'indigo',colorId:'amber'});expect(note).not.toHaveProperty('sample');
 const stored=JSON.parse(await readFile(join(dir,'board.json'),'utf8'));expect(stored[0]).toEqual(legacy);expect(stored.find((item:{id:string})=>item.id===note.id)).toMatchObject({characterId:'indigo',colorId:'amber',status:'published'});
});
