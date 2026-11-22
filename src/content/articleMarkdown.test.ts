import {describe,it,expect} from 'vitest';
import {parseArticle,articleText} from './articleMarkdown';
describe('authored case Markdown',()=>{
 it('preserves punctuation and source order across headings, prose, quotes, lists and tables',()=>{
  const markdown="# Exact title – don’t rewrite\n\n> A promise.\n\n## My role\n\nFirst paragraph.\nContinued sentence.\n\n| | |\n|---|---|\n| Role | **Owner** |\n\n- One, two.\n- Three & four.\n\n### My role\n\n![Named figure](/media/reviewed.png)\n\n*Reflection.*";
  const blocks=parseArticle(markdown);
  expect(blocks.map(b=>b.type)).toEqual(['heading','quote','heading','paragraph','table','list','heading','image','paragraph']);
  expect(blocks[3]).toEqual({type:'paragraph',text:'First paragraph. Continued sentence.'});
  expect(blocks[4]).toEqual({type:'table',rows:[['',''],['Role','**Owner**']]});
  expect(blocks[6]).toMatchObject({id:'my-role-2',text:'My role'});
  expect(articleText(markdown)).toBe('Exact title – don’t rewrite\n\nA promise.\n\nMy role\n\nFirst paragraph. Continued sentence.\n\nRole\n\nOwner\n\nOne, two.\n\nThree & four.\n\nMy role\n\nReflection.');
 });
 it('namespaces repeated section labels across stacked article windows',()=>{
  const a=parseArticle('# First\n\n## Context','demo-health-one'),b=parseArticle('# Second\n\n## Context','demo-health-two');
  expect(a[1]).toMatchObject({id:'demo-health-one-context'});
  expect(b[1]).toMatchObject({id:'demo-health-two-context'});
 });
 it('never interprets supplied HTML as executable markup or folds a placeholder into an invented link',()=>{
  expect(parseArticle('<script>alert(1)</script>\n\n[Link to the Example Platform case study.]')).toEqual([{type:'paragraph',text:'<script>alert(1)</script>'},{type:'paragraph',text:'[Link to the Example Platform case study.]'}]);
 });
});
