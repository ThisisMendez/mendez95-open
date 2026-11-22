import {expect, it} from 'vitest';
import {videoResponse} from './video';

const asset = () => new Response(new Uint8Array([0,1,2,3,4,5,6,7]), {headers: {'Content-Type':'video/mp4','Content-Length':'8','ETag':'"asset-v1"'}});
const request = (range?: string, extra: Record<string,string> = {}) => new Request('https://example.com/videos/blueline-explainer.mp4', {headers: {...(range ? {Range:range} : {}), ...extra}});

it('serves exact closed, open-ended and suffix video ranges', async () => {
  for (const [range, expected, contentRange] of [['bytes=2-4',[2,3,4],'bytes 2-4/8'],['bytes=6-',[6,7],'bytes 6-7/8'],['bytes=-2',[6,7],'bytes 6-7/8']] as const) {
    const response = await videoResponse(request(range), asset());
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe(contentRange);
    expect(response.headers.get('Content-Length')).toBe(String(expected.length));
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual(expected);
  }
});
it('derives the range from bytes when the asset binding omits Content-Length', async () => {
  const response = await videoResponse(request('bytes=1-2'), new Response(new Uint8Array([0,1,2,3]), {headers:{'Content-Type':'video/mp4'}}));
  expect(response.status).toBe(206);
  expect(response.headers.get('Content-Range')).toBe('bytes 1-2/4');
  expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([1,2]);
});
it('returns an unsatisfiable range without a mismatched full-file body', async () => {
  for (const range of ['bytes=8-','bytes=5-2','bytes=-0','bytes=999999999999999999999-']) {
    const response = await videoResponse(request(range), asset());
    expect(response.status).toBe(416);
    expect(response.headers.get('Content-Range')).toBe('bytes */8');
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  }
});
it('preserves full responses for malformed ranges or an outdated If-Range', async () => {
  for (const [range,extra] of [['invalid',{}],['bytes=0-1,4-5',{}],['bytes=0-1',{'If-Range':'"old-asset"'}]] as const) {
    const response = await videoResponse(request(range,extra), asset());
    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBe(8);
  }
});
it('advertises range support and accepts a matching If-Range', async () => {
  expect((await videoResponse(request(),asset())).headers.get('Accept-Ranges')).toBe('bytes');
  expect((await videoResponse(request('bytes=0-1',{'If-Range':'"asset-v1"'}),asset())).status).toBe(206);
});
it('leaves unrelated routes and already-partial asset responses intact', async () => {
  const original=asset();expect(await videoResponse(new Request('https://example.com/downloads/brief.pdf',{headers:{Range:'bytes=0-1'}}),original)).toBe(original);
  const partial=new Response(new Uint8Array([0,1]),{status:206});expect(await videoResponse(request('bytes=0-1'),partial)).toBe(partial);
});
