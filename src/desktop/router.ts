import { appRegistry, type AppId } from './registry';

export type RouteMatch = { appId: AppId | null; path: string; slug?: string; unavailable?: boolean; view?: 'full'; search?: string };

export function normalizePath(pathname: string): string {
  const decoded = decodeURI(pathname);
  const clean = decoded.replace(/\/+$/, '') || '/';
  return clean.startsWith('/') ? clean : `/${clean}`;
}

export function resolveRoute(pathname: string): RouteMatch {
  const url = new URL(pathname, 'http://localhost');
  const path = normalizePath(url.pathname);
  if (path === '/') return { appId: null, path };
  const [base, ...rest] = path.slice(1).split('/');
  const app = appRegistry.find(candidate => candidate.route === `/${base}`);
  if (!app || !app.enabled || rest.length > 1) return { appId: null, path, unavailable: true };
  const slug = rest[0];
  if (slug && !['work', 'ai-lab', 'side-projects', 'field-notes', 'photos', 'games'].includes(app.id)) {
    return { appId: null, path, unavailable: true };
  }
  if (app.id === 'games' && slug && !['snake', 'bounce', 'solitaire', 'minesweeper'].includes(slug)) {
    return { appId: null, path, unavailable: true };
  }
  return { appId: app.id, path, slug, ...(url.search?{search:url.search}:{}), ...(url.searchParams.get('view')==='full'?{view:'full' as const}:{}) };
}

export function sourceRoute(kind: string, slug: string): string {
  if (kind === 'ai-lab') return `/ai-lab/${slug}`;
  if (kind === 'side-project') return `/side-projects/${slug}`;
  return `/work/${slug}`;
}
