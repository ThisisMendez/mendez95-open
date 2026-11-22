/** Versioned presentation membership, never inferred from professional titles. */
export const PORTFOLIO_CATEGORY_VERSION=1;
export const PORTFOLIO_CATEGORIES=['all','builds','case-studies','workflows'] as const;
export type PortfolioCategory=typeof PORTFOLIO_CATEGORIES[number];
const memberships:Record<string,readonly PortfolioCategory[]>={
 'demo-platform':['case-studies','builds'],'demo-health-psm':['case-studies'],'demo-health-platform-lifecycle':['case-studies','workflows'],'demo-health-measure-and-invest':['case-studies','workflows'],'demo-data-field-quality':['case-studies','workflows'],'demo-coaching':['case-studies'],
 'mendez-95-build':['case-studies','builds'],
};
export function portfolioCategory(value:string|null):PortfolioCategory{return PORTFOLIO_CATEGORIES.includes(value as PortfolioCategory)?value as PortfolioCategory:'all';}
export function filterPortfolio<T extends{id:string}>(visible:readonly T[],category:PortfolioCategory):T[]{return visible.filter(story=>category==='all'||memberships[story.id]?.includes(category));}
