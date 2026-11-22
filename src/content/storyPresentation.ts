import type {Story} from './types';
import {parseArticle} from './articleMarkdown';
export const storyLabel=(story:Story)=>story.menuLabel||({
 'blueline-redline':'Blue Line',
} as Record<string,string>)[story.id]||story.title;

/** Narrative wording belongs to the authored Markdown title. */
export function storyNarrativeTitle(story:Story){
 const heading=parseArticle(story.articleMarkdown||'').find(block=>block.type==='heading'&&block.level===1);
 return heading?.type==='heading'?heading.text:story.title;
}
