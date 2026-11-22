import { useEffect, useRef } from 'react';
import './maze.css';

const map = [
  '111111111111',
  '100000000001',
  '101110110101',
  '101000010101',
  '101011010101',
  '100010000001',
  '101010111101',
  '100000000001',
  '101111010101',
  '100000000001',
  '111111111111',
];
const path = [[1.5,1.5],[10.5,1.5],[10.5,9.5],[1.5,9.5],[1.5,1.5]] as const;
const W = 440, H = 270;

function makeTexture(): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width=128; canvas.height=128;
  const c=canvas.getContext('2d')!;
  c.fillStyle='#d7cab3'; c.fillRect(0,0,128,128);
  for (let row=0;row<8;row++) for (let col=-1;col<4;col++) {
    const x=col*42+(row%2)*21+2, y=row*16+2;
    const variants=['#8b2526','#9d2b2c','#af3630','#842125','#a8332e'];
    c.fillStyle=variants[(row*7+col*3+20)%variants.length] ?? '#922a29'; c.fillRect(x,y,40,14);
    c.fillStyle='rgba(255,255,255,.13)'; c.fillRect(x+1,y+1,38,2);
    c.fillStyle='rgba(0,0,0,.19)'; c.fillRect(x+1,y+12,38,2);
  }
  return canvas;
}
function positionAt(t: number) {
  const speed=.00064; const progress=(t*speed)%34;
  let remaining=progress;
  for (let i=0;i<path.length-1;i++) {
    const a=path[i]!, b=path[i+1]!;
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if (remaining <= length) {
      const q=remaining/length;
      return {x:a[0]+(b[0]-a[0])*q,y:a[1]+(b[1]-a[1])*q, angle:Math.atan2(b[1]-a[1],b[0]-a[0])};
    }
    remaining-=length;
  }
  return {x:1.5,y:1.5,angle:0};
}
function draw(c: CanvasRenderingContext2D, texture: HTMLCanvasElement, time: number) {
  const position=positionAt(time);
  const fov=Math.PI/2.7;
  // Original procedural surfaces, projected into world space so the pattern
  // travels with the camera rather than staying fixed on the screen.
  const surfaces=c.createImageData(W,H), pixels=surfaces.data;
  const forwardX=Math.cos(position.angle), forwardY=Math.sin(position.angle);
  const planeX=-forwardY*Math.tan(fov/2), planeY=forwardX*Math.tan(fov/2);
  for(let y=0;y<H;y++) {
    const distance=(H*.5)/Math.max(1,Math.abs(y-H/2));
    const shade=Math.max(.25,1-distance*.065);
    for(let x=0;x<W;x++) {
      const camera=2*x/W-1;
      const worldX=position.x+distance*(forwardX+planeX*camera);
      const worldY=position.y+distance*(forwardY+planeY*camera);
      const grain=((Math.floor(worldX*94)*17 ^ Math.floor(worldY*94)*31)&15)-7;
      const tileX=worldX-Math.floor(worldX), tileY=worldY-Math.floor(worldY);
      const seam=tileX<.025 || tileY<.025;
      const ceiling=y<H/2;
      const checker=(Math.floor(worldX*4)+Math.floor(worldY*4))&1;
      let red=143+grain, green=103+grain, blue=62+grain;
      if(ceiling) {
        red=seam?74:checker?179:146; green=seam?83:checker?188:159; blue=seam?79:checker?172:147;
      } else if(seam) { red=88; green=60; blue=35; }
      const i=(y*W+x)*4;
      pixels[i]=red*shade; pixels[i+1]=green*shade; pixels[i+2]=blue*shade; pixels[i+3]=255;
    }
  }
  c.putImageData(surfaces,0,0);
  for (let x=0;x<W;x+=2) {
    const rayAngle=position.angle+Math.atan((2*x/W-1)*Math.tan(fov/2));
    const dx=Math.cos(rayAngle), dy=Math.sin(rayAngle);
    let mapX=Math.floor(position.x), mapY=Math.floor(position.y);
    const deltaX=Math.abs(1/dx), deltaY=Math.abs(1/dy);
    const stepX=dx<0?-1:1, stepY=dy<0?-1:1;
    let sideX=(dx<0?position.x-mapX:mapX+1-position.x)*deltaX;
    let sideY=(dy<0?position.y-mapY:mapY+1-position.y)*deltaY;
    let side=0, distance=0;
    for (let i=0;i<24;i++) {
      if (sideX<sideY) { distance=sideX; sideX+=deltaX; mapX+=stepX; side=0; }
      else { distance=sideY; sideY+=deltaY; mapY+=stepY; side=1; }
      if (map[mapY]?.[mapX] !== '0') break;
    }
    const corrected=Math.max(.15,distance*Math.cos(rayAngle-position.angle));
    const height=Math.min(H*3,H/(corrected*.64));
    const top=(H-height)/2;
    const wallX=side===0 ? position.y+distance*dy : position.x+distance*dx;
    let tx=Math.floor((wallX-Math.floor(wallX))*texture.width);
    if ((side===0 && dx>0)||(side===1 && dy<0)) tx=texture.width-tx-1;
    c.drawImage(texture,tx,0,1,128,x,top,2,height);
    const shade=Math.min(.72,corrected*.058+(side?.14:0));
    c.fillStyle=`rgba(18,20,24,${shade})`; c.fillRect(x,top,2,height);
    c.fillStyle='rgba(13,16,18,.25)'; c.fillRect(x,top+height-2,2,2);
  }
  const fade=c.createLinearGradient(0,0,W,0);fade.addColorStop(0,'rgba(0,0,0,.25)');fade.addColorStop(.5,'rgba(0,0,0,0)');fade.addColorStop(1,'rgba(0,0,0,.25)');c.fillStyle=fade;c.fillRect(0,0,W,H);
}

export default function MazeSaver({ exit, reducedMotion }: { exit: () => void; reducedMotion: boolean }) {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas=canvasRef.current; const c=canvas?.getContext('2d'); if(!c) return;
    const texture=makeTexture(); let frame=0, last=-Infinity;
    const render=(time:number)=>{ if (time-last>33) { draw(c,texture,reducedMotion?0:time); last=time; } if(!reducedMotion) frame=requestAnimationFrame(render); };
    render(0);
    const mounted=performance.now();
    const leave=()=>exit();
    const pointerMove=()=>{ if(performance.now()-mounted>=400) leave(); };
    window.addEventListener('keydown',leave); window.addEventListener('pointerdown',leave); window.addEventListener('touchstart',leave); window.addEventListener('pointermove',pointerMove);
    return ()=>{ cancelAnimationFrame(frame); window.removeEventListener('keydown',leave); window.removeEventListener('pointerdown',leave); window.removeEventListener('touchstart',leave); window.removeEventListener('pointermove',pointerMove); };
  },[exit,reducedMotion]);
  return <div className="os-maze-saver" role="dialog" aria-modal="true" aria-label="Animated Mendez 95 maze screensaver"><canvas ref={canvasRef} width={W} height={H} aria-hidden="true"/><div className="os-maze-overlay"><span className="os-eyebrow">Mendez 95 / Maze</span>{reducedMotion && <p>Still view. Motion is reduced in Settings.</p>}<button className="os-button" onClick={exit}>Exit screensaver</button></div><p className="os-maze-hint">Move the pointer, press any key, or touch to return.</p></div>;
}
