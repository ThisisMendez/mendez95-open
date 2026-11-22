import {createElement} from 'react';
import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {XPostCard,validXPost} from './XPostCard';
it('keeps a truthful fallback without a verified source and rejects unsafe post/media links',()=>{
 expect(renderToStaticMarkup(createElement(XPostCard))).toContain('Latest post unavailable');
 const post={text:'A public post',url:'https://x.com/exampleowner/status/123',createdAt:'2026-10-30T00:00:00Z',media:[]};expect(validXPost(post)).toBe(true);expect(validXPost({...post,url:'javascript:alert(1)'})).toBe(false);expect(validXPost({...post,media:[{url:'https://example.com/private',alt:''}]})).toBe(false);
});
it('keeps quote attribution and media links separate from owner commentary without embedding a player',()=>{
 const post={text:'Owner commentary',url:'https://x.com/exampleowner/status/2000000000000000000',createdAt:'2026-11-02T19:52:28Z',media:[],quote:{author:'examplequote',text:'A quoted preview',url:'https://x.com/examplequote/status/1999990000000000000',media:[{url:'https://pbs.twimg.com/amplify_video_thumb/test.jpg',alt:'Video preview',kind:'video'}]}};
 expect(validXPost(post)).toBe(true);
 const html=renderToStaticMarkup(createElement(XPostCard,{post}));
 expect(html).toContain('Owner commentary');expect(html).toContain('@examplequote');expect(html).toContain('Watch video on X');expect(html).not.toContain('<iframe');expect(html).not.toContain('<video');
 expect(validXPost({...post,quote:{...post.quote,url:'https://evil.test/quote'}})).toBe(false);
 expect(validXPost({...post,quote:{...post.quote,author:'wrongAuthor'}})).toBe(false);
 expect(validXPost({...post,quote:{...post.quote,media:[{url:'https://pbs.twimg.com.evil.test/image',alt:''}]}})).toBe(false);
});
