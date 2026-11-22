import {createHash} from 'node:crypto';

const allowedPaths = new Set(['docs/screenshots/desktop.jpg', 'docs/screenshots/pocket.jpg']);

/** Browser JPEG only: no EXIF, comments, profiles or embedded thumbnails. */
export function inspectScreenshot(bytes) {
  if (bytes.length < 16 || bytes.length > 2_000_000 || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) throw Error('Invalid screenshot JPEG');
  let position = 2, dimensions;
  while (position + 4 <= bytes.length) {
    if (bytes[position] !== 0xff) throw Error('Invalid JPEG marker');
    const marker = bytes[position + 1]; position += 2;
    const length = bytes.readUInt16BE(position);
    if (length < 2 || position + length > bytes.length) throw Error('Invalid JPEG segment');
    if (marker === 0xe0) {
      if (length !== 16 || bytes.toString('ascii', position + 2, position + 7) !== 'JFIF\0' || bytes[position + 14] || bytes[position + 15]) throw Error('Unexpected JPEG application metadata');
    } else if (![0xc0, 0xc2, 0xc4, 0xdb, 0xdd, 0xda].includes(marker)) {
      throw Error('Screenshot contains unsupported metadata or markers');
    }
    if (marker === 0xc0 || marker === 0xc2) {
      if (length < 8 || dimensions) throw Error('Invalid JPEG frame');
      dimensions = {width: bytes.readUInt16BE(position + 5), height: bytes.readUInt16BE(position + 3)};
    }
    if (marker === 0xda) {
      if (!dimensions || dimensions.width < 300 || dimensions.height < 300 || dimensions.width > 2000 || dimensions.height > 2000) throw Error('Unexpected screenshot dimensions');
      return dimensions;
    }
    position += length;
  }
  throw Error('Screenshot has no image scan');
}

export function verifyScreenshot(path, bytes, review) {
  if (!allowedPaths.has(path) || !review || !/^[a-f0-9]{64}$/.test(review.sha256)) throw Error(`Unreviewed screenshot: ${path}`);
  if (createHash('sha256').update(bytes).digest('hex') !== review.sha256) throw Error(`Screenshot differs from reviewed bytes: ${path}`);
  const size = inspectScreenshot(bytes);
  if (size.width !== review.width || size.height !== review.height) throw Error(`Screenshot differs from reviewed dimensions: ${path}`);
  return size;
}
