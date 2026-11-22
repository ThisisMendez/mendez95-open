import type {Story} from './types';
import {storyLabel, storyNarrativeTitle} from './storyPresentation';

/** Keep the chosen case second within the collection the reader can actually see. */
export function orderedPortfolio<T extends {id:string; displayOrder:number}>(stories:readonly T[]):T[] {
 const ordered=[...stories].sort((a,b)=>a.displayOrder-b.displayOrder);
 const index=ordered.findIndex(story=>story.id==='demo-health-psm');
 if(index<0)return ordered;
 const [platform]=ordered.splice(index,1);
 ordered.splice(Math.min(1,ordered.length),0,platform!);
 return ordered;
}

export function portfolioOrganization(context?: string): string {
 return context?.split(' · ')[0]?.trim() ?? '';
}

export function comparePortfolioCompanies(
 a: {organization?: string; title: string},
 b: {organization?: string; title: string},
): number {
 const companyA=a.organization?.trim() || a.title;
 const companyB=b.organization?.trim() || b.title;
 return companyA.localeCompare(companyB,undefined,{sensitivity:'base'});
}

/** Menus and adjacent-case navigation follow the reader's chosen folder order. */
export function portfolioNavigation(stories:readonly Story[],sort:'order'|'name'):Story[]{
 const ordered=orderedPortfolio(stories);
 return sort==='name'?ordered.sort((a,b)=>comparePortfolioCompanies(
  {organization:portfolioOrganization(a.context),title:storyLabel(a)},
  {organization:portfolioOrganization(b.context),title:storyLabel(b)},
 )):ordered;
}

/** Reuse the authored full-article heading only when it adds to the short title. */
export function portfolioSubtitle(story:Story):string|undefined {
 const narrative=storyNarrativeTitle(story);
 const normalize=(value:string)=>value.trim().toLocaleLowerCase();
 return [story.title,storyLabel(story)].some(title=>normalize(title)===normalize(narrative))?undefined:narrative;
}
