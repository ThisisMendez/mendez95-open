import { describe, expect, it } from 'vitest';
import { RasterHistory, canvasPoint, fitImage, floodFill, parseDraft, validSize, type Raster } from './engine';
function raster(width: number, height: number): Raster {
  return { width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) };
}
describe('Paint fill', () => {
  it('fills only the connected area and respects opaque boundaries', () => {
    const image = raster(5, 4);
    for (let y = 0; y < 4; y++) image.data.set([0, 0, 0, 255], (y * 5 + 2) * 4);
    expect(floodFill(image, 0, 0, '#ff0000')).toBe(8);
    expect([...image.data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    expect([...image.data.slice(12, 16)]).toEqual([255, 255, 255, 255]);
    expect(floodFill(image, 1, 3, '#ff0000')).toBe(0);
  });
  it('does not wrap rows, cross diagonal gaps, or conflate alpha', () => {
    const image = raster(2, 2);
    image.data.set([0, 0, 0, 255], 0); image.data.set([0, 0, 0, 255], 12);
    expect(floodFill(image, 1, 0, '#123456')).toBe(1);
    const transparent = raster(2, 1); transparent.data[3] = 0;
    expect(floodFill(transparent, 0, 0, '#ffffff')).toBe(1);
  });
  it('bounds malformed input and fills a large open area without recursion', () => {
    const image = raster(400, 300);
    expect(floodFill(image, 0, 0, '#123456')).toBe(120_000);
    expect(floodFill(image, -1, 0, '#000000')).toBe(0);
    expect(floodFill(image, 0, 0, 'red')).toBe(0);
    expect(floodFill({ ...image, width: 500 }, 0, 0, '#000000')).toBe(0);
  });
});
describe('Paint history and coordinates', () => {
  it('owns snapshots, restores sizes, and discards redo only after a new edit', () => {
    const history = new RasterHistory(); const first = raster(2, 2);
    history.push(first); first.data[0] = 0; history.push(raster(4, 4));
    expect(history.undo()?.data[0]).toBe(255); expect(history.current?.width).toBe(2);
    expect(history.redo()?.width).toBe(4); history.undo(); history.push(raster(3, 3));
    expect(history.canRedo).toBe(false); expect(history.current?.width).toBe(3);
  });
  it('bounds retained snapshots while preserving at least one undo', () => {
    const history = new RasterHistory(48, 30);
    for (let i = 0; i < 20; i++) history.push(raster(2, 2));
    expect(history.byteLength).toBe(48); expect(history.canUndo).toBe(true);
    history.undo(); history.undo(); expect(history.canUndo).toBe(false);
  });
  it('maps scaled, scrolled canvas bounds and clamps captured pointers', () => {
    const bounds = { left: -50, top: 20, width: 320, height: 200 };
    expect(canvasPoint(110, 120, bounds, 640, 400)).toEqual({ x: 320, y: 200 });
    expect(canvasPoint(-100, 1000, bounds, 640, 400)).toEqual({ x: 0, y: 399 });
    expect(validSize(1600, 1600)).toBe(false); expect(validSize(NaN, 100)).toBe(false);
    const fitted = fitImage(4000, 3000); expect(fitted).toEqual({ width: 1600, height: 1200 });
  });
});
describe('Paint draft boundary', () => {
  it('rejects malformed, oversized or non-PNG recovery data', () => {
    const draft = { version: 1, width: 640, height: 400, name: 'Drawing', dirty: true, png: 'data:image/png;base64,AAAA' };
    expect(parseDraft(JSON.stringify(draft))).toEqual(draft);
    expect(parseDraft(JSON.stringify({ ...draft, width: 9000 }))).toBeNull();
    expect(parseDraft(JSON.stringify({ ...draft, png: 'https://example.com/image.png' }))).toBeNull();
    expect(parseDraft('{')).toBeNull(); expect(parseDraft(null)).toBeNull();
  });
});
