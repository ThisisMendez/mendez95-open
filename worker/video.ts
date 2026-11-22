/** Static Assets can return a full MP4 for Range requests through the binding. */
export async function videoResponse(request: Request, response: Response): Promise<Response> {
  if (!/^\/videos\/[a-z0-9-]+\.mp4$/.test(new URL(request.url).pathname) || response.status !== 200 || response.headers.has('Content-Encoding')) return response;
  const headers = new Headers(response.headers);
  headers.set('Accept-Ranges', 'bytes');
  const range = request.headers.get('Range');
  const ifRange = request.headers.get('If-Range');
  if (!range || (ifRange && ifRange !== response.headers.get('ETag') && ifRange !== response.headers.get('Last-Modified'))) return new Response(response.body, {status: 200, headers});
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  // Ignore malformed and multipart ranges rather than generating a partial multipart body.
  if (!match || (!match[1] && !match[2])) return new Response(response.body, {status: 200, headers});
  // The binding can omit Content-Length even though the public response has it.
  // Static Assets are bounded to 25 MiB; derive the range from the actual bundled bytes.
  const bytes = await response.arrayBuffer();
  const size = bytes.byteLength;
  if (size < 1 || size > 25 * 1024 * 1024) return new Response(bytes, {status: 200, headers});
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start || (!match[1] && Number(match[2]) === 0)) {
    headers.set('Content-Range', `bytes */${size}`);
    headers.set('Content-Length', '0');
    return new Response(null, {status: 416, headers});
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(new Uint8Array(bytes, start, end - start + 1), {status: 206, headers});
}
