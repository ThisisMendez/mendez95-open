import {createElement} from 'react';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import type {SiteContentView} from '../../content/types';
import {SafeModeAbout} from './SafeModeScreen';

const about=JSON.parse(readFileSync('content/about.json','utf8')) as SiteContentView['about'];
describe('Safe Mode introduction',()=>{
 it('renders every current introduction paragraph once without profile or secondary sections',()=>{
  const html=renderToStaticMarkup(createElement(SafeModeAbout,{about})),body=about.journey.find(entry=>entry.id==='introduction')!.body;
  const paragraphs=body.split('\n\n');
  expect((html.match(/<p>/g)||[])).toHaveLength(paragraphs.length);
  // These words include the complete hiring invitation, rather than the old first-paragraph truncation.
  for(const paragraph of paragraphs)expect(html.split(renderToStaticMarkup(createElement('p',null,paragraph)))).toHaveLength(2);
  expect(html).not.toMatch(/<img|<svg|<button|<a |<h[1-6]|<details|os-about/);
  for(const entry of about.journey.filter(entry=>entry.id!=='introduction'))expect(html).not.toContain(entry.body);
 });
 it('reads changed shared content and handles an omitted introduction',()=>{
  const introduction=about.journey.find(entry=>entry.id==='introduction')!;
  expect(renderToStaticMarkup(createElement(SafeModeAbout,{about:{...about,journey:[{...introduction,body:'Current first paragraph.\n\nCurrent hiring invitation.'}]}}))).toContain('<p>Current first paragraph.</p><p>Current hiring invitation.</p>');
  expect(renderToStaticMarkup(createElement(SafeModeAbout,{about:{...about,journey:[]}}))).toContain('The About introduction is not available.');
 });
});
