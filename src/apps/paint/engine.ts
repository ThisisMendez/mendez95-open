/** Original raster helpers. No reference application code or artwork. */
export type Point = { x: number; y: number };
export type Raster = { width: number; height: number; data: Uint8ClampedArray };
export const MAX_SIDE = 1600;
export const MAX_PIXELS = 1_920_000;
export const HISTORY_BYTES = 48 * 1024 * 1024;

export function validSize(width: number, height: number): boolean {
  return Number.isInteger(width) && Number.isInteger(height) && width >= 1 && height >= 1 &&
    width <= MAX_SIDE && height <= MAX_SIDE && width * height <= MAX_PIXELS;
}

export function fitImage(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_SIDE / width, MAX_SIDE / height, Math.sqrt(MAX_PIXELS / (width * height)));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

export function canvasPoint(x: number, y: number, bounds: { left: number; top: number; width: number; height: number }, width: number, height: number): Point {
  return { x: Math.max(0, Math.min(width - 1, Math.floor((x - bounds.left) * width / bounds.width))),
    y: Math.max(0, Math.min(height - 1, Math.floor((y - bounds.top) * height / bounds.height))) };
}

/** Exact-color, four-neighbor fill. Pixels are marked on enqueue, so the queue is bounded by the image area. */
export function floodFill(raster: Raster, x: number, y: number, hex: string): number {
  const { data, width, height } = raster;
  if (!validSize(width, height) || data.length !== width * height * 4 || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height || !/^#[\da-f]{6}$/i.test(hex)) return 0;
  const start = (y * width + x) * 4;
  const old = [data[start]!, data[start + 1]!, data[start + 2]!, data[start + 3]!];
  const next = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];
  if (old.every((value, index) => value === next[index])) return 0;
  const queue = new Uint32Array(width * height);
  let read = 0, write = 0;
  const add = (pixel: number) => {
    const at = pixel * 4;
    if (data[at] !== old[0] || data[at + 1] !== old[1] || data[at + 2] !== old[2] || data[at + 3] !== old[3]) return;
    data.set(next, at);
    queue[write++] = pixel;
  };
  add(y * width + x);
  while (read < write) {
    const pixel = queue[read++]!;
    const column = pixel % width;
    if (column > 0) add(pixel - 1);
    if (column < width - 1) add(pixel + 1);
    if (pixel >= width) add(pixel - width);
    if (pixel < width * (height - 1)) add(pixel + width);
  }
  return write;
}

/** Owns immutable snapshots. Drawing and previews must never mutate a returned snapshot. */
export class RasterHistory {
  private frames: Raster[] = [];
  private position = -1;
  constructor(private byteLimit = HISTORY_BYTES, private frameLimit = 30) {}
  get canUndo() { return this.position > 0; }
  get canRedo() { return this.position < this.frames.length - 1; }
  get byteLength() { return this.frames.reduce((sum, frame) => sum + frame.data.byteLength, 0); }
  get current() { return this.frames[this.position]; }
  push(frame: Raster) {
    if (!validSize(frame.width, frame.height) || frame.data.length !== frame.width * frame.height * 4) throw new Error('Invalid raster');
    this.frames.splice(this.position + 1);
    this.frames.push({ width: frame.width, height: frame.height, data: new Uint8ClampedArray(frame.data) });
    while (this.frames.length > 2 && (this.byteLength > this.byteLimit || this.frames.length > this.frameLimit)) this.frames.shift();
    this.position = this.frames.length - 1;
  }
  undo() { if (this.canUndo) this.position--; return this.current; }
  redo() { if (this.canRedo) this.position++; return this.current; }
}

export type PaintDraft = { version: 1; width: number; height: number; png: string; name: string; dirty: boolean };
export function parseDraft(raw: string | null): PaintDraft | null {
  if (!raw || raw.length > 12_000_000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const v = value as Record<string, unknown>;
    if (v.version !== 1 || typeof v.width !== 'number' || typeof v.height !== 'number' || !validSize(v.width, v.height) ||
      typeof v.png !== 'string' || !v.png.startsWith('data:image/png;base64,') || typeof v.name !== 'string' || v.name.length > 80 || typeof v.dirty !== 'boolean') return null;
    return { version: 1, width: v.width, height: v.height, png: v.png, name: v.name, dirty: v.dirty };
  } catch { return null; }
}
