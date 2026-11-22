import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { canvasPoint, fitImage, floodFill, parseDraft, RasterHistory, validSize, type PaintDraft, type Point, type Raster } from './engine';
import './paint.css';

type Tool = 'pencil' | 'brush' | 'eraser' | 'fill' | 'line' | 'rectangle' | 'ellipse';
type Gesture = { start: Point; last: Point; before: ImageData; tool: Tool; color: string; size: number; filled: boolean; pointerId: number | null };
const TOOLS: { id: Tool; name: string; key: string; path: string }[] = [
  { id: 'pencil', name: 'Pencil', key: 'P', path: 'M5 19l2-6L17 3l4 4L11 17z M7 13l4 4 M5 19l6-2 M15 5l4 4' },
  { id: 'brush', name: 'Brush', key: 'B', path: 'M10 14L19 3l3 3-11 9 M11 15c-7-5-3 7-9 5 5 4 11 1 9-5' },
  { id: 'eraser', name: 'Eraser', key: 'E', path: 'M3 14l10-11 8 8-9 10H9z M7 10l9 8 M12 21h9' },
  { id: 'fill', name: 'Fill', key: 'F', path: 'M4 10l8-7 8 8-8 8z M4 10h16 M8 2l7 8 M21 16c-4 5-1 7 1 5 1-1 0-3-1-5' },
  { id: 'line', name: 'Line', key: 'L', path: 'M4 20L20 4' },
  { id: 'rectangle', name: 'Rectangle', key: 'R', path: 'M4 5h16v14H4z' },
  { id: 'ellipse', name: 'Ellipse', key: 'O', path: 'M21 12a9 7 0 1 1-18 0 9 7 0 1 1 18 0' },
];
const COLORS = ['#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00a94f', '#00d5d5', '#2468ff', '#ff55cc'];
const STORAGE_KEY = 'mendez-os-paint-draft-v1';
let memoryDraft: PaintDraft | null = null;

function context(canvas: HTMLCanvasElement | null) { return canvas?.getContext('2d', { willReadFrequently: true }) ?? null; }
function capture(ctx: CanvasRenderingContext2D) { return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height); }
function restore(ctx: CanvasRenderingContext2D, frame: Raster) {
  if (ctx.canvas.width !== frame.width) ctx.canvas.width = frame.width;
  if (ctx.canvas.height !== frame.height) ctx.canvas.height = frame.height;
  const pixels = ctx.createImageData(frame.width, frame.height); pixels.data.set(frame.data); ctx.putImageData(pixels, 0, 0);
}
function whiteCanvas(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.canvas.width = width; ctx.canvas.height = height; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
}
function stroke(ctx: CanvasRenderingContext2D, gesture: Gesture, point: Point) {
  const shape = ['line', 'rectangle', 'ellipse'].includes(gesture.tool);
  if (shape) ctx.putImageData(gesture.before, 0, 0);
  const from = shape ? gesture.start : gesture.last;
  ctx.strokeStyle = ctx.fillStyle = gesture.tool === 'eraser' ? '#ffffff' : gesture.color;
  ctx.lineWidth = gesture.tool === 'eraser' ? Math.max(8, gesture.size * 2) : gesture.size;
  ctx.lineCap = gesture.tool === 'pencil' ? 'square' : 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (gesture.tool === 'rectangle') {
    ctx.rect(Math.min(from.x, point.x) + .5, Math.min(from.y, point.y) + .5, Math.abs(point.x - from.x), Math.abs(point.y - from.y));
  } else if (gesture.tool === 'ellipse') {
    ctx.ellipse((from.x + point.x) / 2 + .5, (from.y + point.y) / 2 + .5, Math.max(.5, Math.abs(point.x - from.x) / 2), Math.max(.5, Math.abs(point.y - from.y) / 2), 0, 0, Math.PI * 2);
  } else if (from.x === point.x && from.y === point.y) {
    if (gesture.tool === 'pencil') ctx.fillRect(point.x, point.y, gesture.size, gesture.size);
    else { ctx.arc(point.x + .5, point.y + .5, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); }
    gesture.last = point; return;
  } else { ctx.moveTo(from.x + .5, from.y + .5); ctx.lineTo(point.x + .5, point.y + .5); }
  if (gesture.filled && (gesture.tool === 'rectangle' || gesture.tool === 'ellipse')) ctx.fill();
  ctx.stroke(); gesture.last = point;
}

export function PaintApp() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const history = useRef(new RasterHistory());
  const gesture = useRef<Gesture | null>(null);
  const meta = useRef({ name: 'Untitled', dirty: false, revision: 0 });
  const mounted = useRef(false);
  const cursor = useRef<Point>({ x: 24, y: 24 });
  const [cursorPosition, setCursorPosition] = useState(cursor.current);
  const [keyboardCursor, setKeyboardCursor] = useState(false);
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(3);
  const [filled, setFilled] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 640, height: 400 });
  const [requestedWidth, setRequestedWidth] = useState('640');
  const [requestedHeight, setRequestedHeight] = useState('400');
  const [zoom, setZoom] = useState('fit');
  const [fitWidth, setFitWidth] = useState(640);
  const viewport = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('Untitled');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(true);
  const [historyState, setHistoryState] = useState({ undo: false, redo: false });
  const [message, setMessage] = useState('Opening canvas…');
  const [recovery, setRecovery] = useState('Kept in this tab');
  const [drawing, setDrawing] = useState(false);

  const sync = () => {
    const c = canvas.current; if (!c) return;
    setDimensions({ width: c.width, height: c.height }); setRequestedWidth(String(c.width)); setRequestedHeight(String(c.height));
    setHistoryState({ undo: history.current.canUndo, redo: history.current.canRedo });
    cursor.current = { x: Math.min(cursor.current.x, c.width - 1), y: Math.min(cursor.current.y, c.height - 1) }; setCursorPosition(cursor.current);
  };
  const persist = () => {
    const c = canvas.current; if (!c) return;
    try {
      const draft: PaintDraft = { version: 1, width: c.width, height: c.height, png: c.toDataURL('image/png'), name: meta.current.name, dirty: meta.current.dirty };
      memoryDraft = draft;
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); setRecovery('Kept in this tab'); }
      catch { setRecovery('Recovery unavailable after reload — export a PNG'); }
    } catch { setRecovery('Recovery unavailable — export a PNG'); }
  };
  const commit = (notice?: string) => {
    const ctx = context(canvas.current); if (!ctx) return;
    history.current.push(capture(ctx)); meta.current.dirty = true; meta.current.revision++; setDirty(true); sync(); persist();
    if (notice) setMessage(notice);
  };
  const finish = (cancel = false) => {
    const active = gesture.current; const ctx = context(canvas.current); if (!active || !ctx) return;
    gesture.current = null; setDrawing(false);
    if (cancel) { ctx.putImageData(active.before, 0, 0); setMessage('Stroke canceled.'); }
    else commit(`${TOOLS.find(t => t.id === active.tool)?.name} applied.`);
  };
  const begin = (point: Point, pointerId: number | null) => {
    const ctx = context(canvas.current); if (!ctx || busy || gesture.current) return;
    if (tool === 'fill') {
      const pixels = capture(ctx); const count = floodFill(pixels, point.x, point.y, color);
      if (count) { ctx.putImageData(pixels, 0, 0); commit('Area filled.'); } else setMessage('This area already has the selected color.');
      return;
    }
    gesture.current = { start: point, last: point, before: capture(ctx), tool, color, size, filled, pointerId };
    setDrawing(true); stroke(ctx, gesture.current, point);
  };
  const move = (point: Point) => { const ctx = context(canvas.current); if (ctx && gesture.current) stroke(ctx, gesture.current, point); };
  const undo = (redo = false) => {
    if (busy) return;
    if (gesture.current) { finish(true); return; }
    if (redo ? !history.current.canRedo : !history.current.canUndo) return;
    const frame = redo ? history.current.redo() : history.current.undo(); const ctx = context(canvas.current);
    if (frame && ctx) { restore(ctx, frame); meta.current.dirty = true; meta.current.revision++; setDirty(true); sync(); persist(); setMessage(redo ? 'Redone.' : 'Undone.'); }
  };
  const confirmReplace = () => !meta.current.dirty || window.confirm('This drawing has changes that have not been exported. Replace it? You can undo this while Paint stays open.');
  const newDrawing = () => {
    if (busy || drawing || !confirmReplace()) return;
    const ctx = context(canvas.current); if (!ctx) return;
    whiteCanvas(ctx, 640, 400); meta.current.name = 'Untitled'; setName('Untitled'); commit('New canvas. Undo restores the previous drawing.');
  };
  const clear = () => {
    const ctx = context(canvas.current); if (!ctx || busy || drawing) return;
    whiteCanvas(ctx, ctx.canvas.width, ctx.canvas.height); commit('Canvas cleared. Undo restores your drawing.');
  };
  const resize = () => {
    const width = Number(requestedWidth), height = Number(requestedHeight);
    if (!validSize(width, height) || width < 16 || height < 16) { setMessage('Use 16–1600 px per side, up to 1,920,000 pixels total.'); return; }
    const ctx = context(canvas.current); if (!ctx || busy || drawing) return;
    if (ctx.canvas.width === width && ctx.canvas.height === height) return;
    if ((width < ctx.canvas.width || height < ctx.canvas.height) && !window.confirm('Smaller dimensions crop the right or bottom edges. Resize? You can undo this.')) return;
    const before = capture(ctx); whiteCanvas(ctx, width, height); ctx.putImageData(before, 0, 0); commit('Canvas resized. Existing artwork stays at the top left.');
  };
  const openFile = async (file: File | undefined) => {
    if (!file || busy || drawing) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'].includes(file.type)) { setMessage('Choose a PNG, JPEG, WebP, GIF, or BMP image.'); return; }
    if (file.size > 16 * 1024 * 1024) { setMessage('Choose an image smaller than 16 MB.'); return; }
    if (!confirmReplace()) return;
    setBusy(true); setMessage('Opening local image…');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (!mounted.current) return;
      if (image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('This image is too large. Choose an image under 40 megapixels.');
      const ctx = context(canvas.current); if (!ctx) return;
      const next = fitImage(image.naturalWidth, image.naturalHeight);
      whiteCanvas(ctx, next.width, next.height); ctx.drawImage(image, 0, 0, next.width, next.height);
      const nextName = file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'Drawing'; meta.current.name = nextName; setName(nextName);
      commit(next.width < image.naturalWidth || next.height < image.naturalHeight ? `Opened and fitted to ${next.width} × ${next.height}. Undo restores the previous drawing.` : 'Local image opened. Undo restores the previous drawing.');
    } catch (error) { if (mounted.current) setMessage(error instanceof Error && error.message.startsWith('This image') ? error.message : 'Could not open this image. Your drawing is unchanged.'); }
    finally { URL.revokeObjectURL(url); if (mounted.current) setBusy(false); }
  };
  const save = () => {
    const c = canvas.current; if (!c || busy || gesture.current) return;
    const revision = meta.current.revision;
    const filename = (meta.current.name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_') || 'Drawing') + '.png';
    c.toBlob(blob => {
      if (!blob || !mounted.current) { if (mounted.current) setMessage('PNG export failed. Please try again.'); return; }
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      if (meta.current.revision === revision) { meta.current.dirty = false; setDirty(false); persist(); }
      setMessage(`PNG download requested: ${filename}`);
    }, 'image/png');
  };

  useEffect(() => {
    mounted.current = true;
    const ctx = context(canvas.current); if (!ctx) { setMessage('Canvas drawing is unavailable in this browser.'); return; }
    let canceled = false;
    whiteCanvas(ctx, 640, 400);
    let saved = memoryDraft;
    if (!saved) { try { saved = parseDraft(sessionStorage.getItem(STORAGE_KEY)); } catch { /* Memory recovery still works in this page. */ } }
    const ready = () => { history.current = new RasterHistory(); history.current.push(capture(ctx)); sync(); setBusy(false); };
    if (saved) {
      const draft = saved; const image = new Image();
      image.onload = () => {
        if (canceled) return;
        if (image.naturalWidth !== draft.width || image.naturalHeight !== draft.height) { setMessage('Recovery image dimensions did not match. Start a new drawing or open a PNG.'); ready(); return; }
        whiteCanvas(ctx, draft.width, draft.height); ctx.drawImage(image, 0, 0);
        meta.current.name = draft.name; meta.current.dirty = draft.dirty; setName(draft.name); setDirty(draft.dirty);
        ready(); setMessage('Drawing recovered from this tab.');
      };
      image.onerror = () => { if (!canceled) { ready(); setMessage('The recovery image could not be read. Open an exported PNG to continue.'); } };
      image.src = draft.png;
    } else { ready(); setMessage('Choose a tool and draw with a mouse, pen, or finger.'); }
    const beforeUnload = (event: BeforeUnloadEvent) => { if (meta.current.dirty || gesture.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      canceled = true; mounted.current = false; window.removeEventListener('beforeunload', beforeUnload);
      // An interrupted stroke is still the visitor's work; retain its visible pixels on close.
      if (gesture.current) {
        meta.current.dirty = true; gesture.current = null;
        try {
          memoryDraft = { version: 1, width: ctx.canvas.width, height: ctx.canvas.height, png: ctx.canvas.toDataURL('image/png'), name: meta.current.name, dirty: true };
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memoryDraft));
        } catch { /* Existing in-memory recovery remains available. */ }
      }
    };
  }, []);
  useEffect(() => {
    const el = viewport.current; if (!el) return;
    const observer = new ResizeObserver(() => setFitWidth(Math.max(40, el.clientWidth - 24))); observer.observe(el);
    setFitWidth(Math.max(40, el.clientWidth - 24)); return () => observer.disconnect();
  }, []);

  const pointFor = (event: PointerEvent<HTMLCanvasElement>) => canvasPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), event.currentTarget.width, event.currentTarget.height);
  const pointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || !event.isPrimary || busy || gesture.current) return;
    event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId); setKeyboardCursor(false);
    cursor.current = pointFor(event); setCursorPosition(cursor.current); begin(cursor.current, event.pointerId);
  };
  const keyDown = (event: KeyboardEvent<HTMLElement>) => {
    const windowElement = canvas.current?.closest('.os-window'); if (windowElement && windowElement.getAttribute('data-active') !== 'true') return;
    const target = event.target as HTMLElement;
    if (target.closest('input,select,textarea,[contenteditable="true"]')) return;
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && ['z', 'y', 's', 'o'].includes(key)) {
      event.preventDefault(); event.stopPropagation();
      if (key === 'z') undo(event.shiftKey); if (key === 'y') undo(true); if (key === 's') save(); if (key === 'o' && !busy && !drawing) fileInput.current?.click(); return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (target === canvas.current && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter', 'Escape'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation(); if (busy) return;
      if (event.key === 'Escape') { finish(true); return; }
      setKeyboardCursor(true);
      if (event.key === ' ' || event.key === 'Enter') {
        if (event.repeat) return;
        if (gesture.current) finish(); else begin(cursor.current, null); return;
      }
      const step = event.shiftKey ? 10 : 1;
      cursor.current = { x: Math.max(0, Math.min(dimensions.width - 1, cursor.current.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0))), y: Math.max(0, Math.min(dimensions.height - 1, cursor.current.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0))) };
      setCursorPosition(cursor.current); if (gesture.current?.pointerId === null) move(cursor.current); return;
    }
    const nextTool = TOOLS.find(t => t.key.toLowerCase() === key);
    if (nextTool && !gesture.current && !busy) { event.preventDefault(); event.stopPropagation(); setTool(nextTool.id); }
  };
  const scale = zoom === 'fit' ? Math.min(1, fitWidth / dimensions.width) : Number(zoom);
  const toolName = TOOLS.find(t => t.id === tool)!.name;
  const disabled = busy || drawing;
  return <section className="m-paint" aria-label="Paint" onKeyDown={keyDown}>
    <div className="m-paint-files" role="group" aria-label="Drawing file actions">
      <button type="button" disabled={disabled} onClick={newDrawing}>New</button>
      <button type="button" disabled={disabled} onClick={() => fileInput.current?.click()}>Open…</button>
      <button type="button" disabled={disabled} onClick={save} title="Export PNG (Ctrl or ⌘ S)">Save PNG</button>
      <span className="m-paint-divider" />
      <button type="button" disabled={busy || (!drawing && !historyState.undo)} onClick={() => undo()} title="Undo (Ctrl or ⌘ Z)">Undo</button>
      <button type="button" disabled={disabled || !historyState.redo} onClick={() => undo(true)} title="Redo (Ctrl or ⌘ Shift Z)">Redo</button>
      <button type="button" disabled={disabled} onClick={clear}>Clear</button>
      <input ref={fileInput} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" onChange={event => { void openFile(event.target.files?.[0]); event.target.value = ''; }} />
    </div>
    <div className="m-paint-options">
      <label>Name <input aria-label="Drawing name" value={name} maxLength={80} disabled={disabled} onChange={event => { const next = event.target.value; setName(next); meta.current.name = next; }} onBlur={persist} /></label>
      <label>Size <select aria-label="Stroke size" value={size} disabled={disabled} onChange={event => setSize(Number(event.target.value))}>{[1, 3, 5, 9, 16].map(n => <option key={n} value={n}>{n} px</option>)}</select></label>
      <label className="m-paint-check"><input type="checkbox" checked={filled} disabled={disabled} onChange={event => setFilled(event.target.checked)} />Filled shapes</label>
      <label>View <select aria-label="Canvas zoom" value={zoom} disabled={drawing} onChange={event => setZoom(event.target.value)}><option value="fit">Fit width</option><option value="0.5">50%</option><option value="1">100%</option><option value="2">200%</option></select></label>
    </div>
    <div className="m-paint-workspace">
      <div className="m-paint-tools" role="group" aria-label="Drawing tools">
        {TOOLS.map(item => <button type="button" key={item.id} title={`${item.name} (${item.key})`} aria-label={item.name} aria-pressed={tool === item.id} disabled={disabled} onClick={() => { setTool(item.id); setMessage(`${item.name} selected.`); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={item.path} /></svg><span>{item.name}</span></button>)}
      </div>
      <div ref={viewport} className="m-paint-viewport" aria-label="Scrollable canvas area">
        <div className="m-paint-paper" style={{ width: dimensions.width * scale, height: dimensions.height * scale }}>
          <canvas ref={canvas} tabIndex={0} aria-label={`Drawing canvas, ${dimensions.width} by ${dimensions.height} pixels. ${toolName} selected.`} aria-describedby="paint-keyboard-help" aria-busy={busy} style={{ width: dimensions.width * scale, height: dimensions.height * scale }}
            onPointerDown={pointerDown}
            onPointerMove={event => { if (gesture.current?.pointerId === event.pointerId) move(pointFor(event)); }}
            onPointerUp={event => { if (gesture.current?.pointerId === event.pointerId) { move(pointFor(event)); finish(); } if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
            onPointerCancel={event => { if (gesture.current?.pointerId === event.pointerId) finish(); }}
            onLostPointerCapture={event => { if (gesture.current?.pointerId === event.pointerId) finish(); }}
            onBlur={() => { setKeyboardCursor(false); if (gesture.current?.pointerId === null) finish(); }}
            onFocus={() => setKeyboardCursor(true)}
          >Paint needs a browser with canvas support.</canvas>
          {keyboardCursor && <span className="m-paint-cursor" aria-hidden="true" style={{ left: (cursorPosition.x + .5) * scale, top: (cursorPosition.y + .5) * scale }} />}
        </div>
      </div>
    </div>
    <div className="m-paint-palette" role="group" aria-label="Paint colors">
      <span className="m-paint-current" title={`Current color ${color}`} style={{ backgroundColor: color }} />
      <div className="m-paint-swatches">{COLORS.map(value => <button key={value} type="button" disabled={disabled} aria-label={`Color ${value}`} aria-pressed={color === value} title={value} style={{ backgroundColor: value }} onClick={() => setColor(value)} />)}</div>
      <label className="m-paint-custom">Custom <input type="color" aria-label="Custom paint color" value={color} disabled={disabled} onChange={event => setColor(event.target.value)} /></label>
    </div>
    <div className="m-paint-status"><span>{toolName}{drawing ? ' · Drawing' : ''} · {dimensions.width} × {dimensions.height}</span><span>{dirty ? 'Not exported' : 'No new changes'} · {recovery}</span></div>
    <p className="m-paint-message" role="status" aria-live="polite">{message}</p>
    <details className="m-paint-more"><summary>Canvas size & keyboard help</summary>
      <div className="m-paint-size"><label>Width <input aria-label="Canvas width" type="number" min={16} max={1600} step={1} value={requestedWidth} disabled={disabled} onChange={event => setRequestedWidth(event.target.value)} /></label><span>×</span><label>Height <input aria-label="Canvas height" type="number" min={16} max={1600} step={1} value={requestedHeight} disabled={disabled} onChange={event => setRequestedHeight(event.target.value)} /></label><button type="button" disabled={disabled} onClick={resize}>Resize canvas</button></div>
      <p id="paint-keyboard-help">On the canvas: arrows move the crosshair; Shift + arrows moves 10 pixels. Space or Enter starts/finishes a stroke or shape. Escape cancels it. P/B/E/F/L/R/O selects a tool. Ctrl/⌘ Z undoes; Shift + Ctrl/⌘ Z redoes; Ctrl/⌘ S exports.</p>
      <p>Drawings stay in this tab across close/reopen and reload when browser storage is available. Save a PNG before closing the browser tab. Undo keeps up to 30 steps within a 48 MB budget and resets when Paint closes. Eraser paints white. Fill replaces an exact connected color. Opening an image fits it within 1600 px per side and 1.92 million pixels; transparent areas become white.</p>
    </details>
  </section>;
}
export default PaintApp;
