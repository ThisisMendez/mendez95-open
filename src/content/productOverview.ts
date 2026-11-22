import type {ProductOverview} from './types';

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 6000;
const localAsset = (value: unknown, folder: string, extensions: string) => typeof value === 'string' && new RegExp(`^/${folder}/[a-z0-9][a-z0-9-]*\\.(?:${extensions})$`).test(value);

/** Bundled project resources must never point into private content or uploads. */
export function productOverviewIssues(value: unknown): string[] {
  if (!record(value)) return ['Product overview must be an object.'];
  const issues: string[] = [];
  for (const field of ['tagline', 'why', 'ownership', 'releaseLabel', 'next']) {
    if (!text(value[field])) issues.push(`Product overview ${field} needs supported text.`);
  }
  for (const [field, keys, max] of [
    ['workflow', ['title', 'body'], 6],
    ['architecture', ['title', 'choice', 'tradeoff'], 8],
    ['shipped', ['title', 'body'], 6],
  ] as const) {
    const rows = value[field];
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > max || rows.some(row => !record(row) || keys.some(key => !text(row[key])))) {
      issues.push(`Product overview ${field} needs complete, supported entries.`);
    }
  }
  if (value.onePagerUrl !== undefined && !localAsset(value.onePagerUrl, 'downloads', 'pdf')) issues.push('Product one-pager must use a bundled PDF.');
  if (value.integrations !== undefined && !text(value.integrations)) issues.push('Product integrations need supported text.');
  if (value.video !== undefined) {
    const video = value.video;
    if (!record(video) || !localAsset(video.src, 'videos', 'mp4') || !localAsset(video.poster, 'videos', 'webp|png|jpg') || !text(video.title) || !text(video.duration)) {
      issues.push('Product video needs a bundled MP4, poster, title and duration.');
    }
  }
  return issues;
}

export function validProductOverview(value: unknown): value is ProductOverview {
  return productOverviewIssues(value).length === 0;
}

export function publicProductOverview(value: ProductOverview): ProductOverview {
  return {
    tagline: value.tagline, why: value.why,
    workflow: value.workflow.map(({title, body}) => ({title, body})),
    architecture: value.architecture.map(({title, choice, tradeoff}) => ({title, choice, tradeoff})),
    ownership: value.ownership,
    shipped: value.shipped.map(({title, body}) => ({title, body})),
    releaseLabel: value.releaseLabel, next: value.next,
    ...(value.integrations ? {integrations: value.integrations} : {}),
    ...(value.onePagerUrl ? {onePagerUrl: value.onePagerUrl} : {}),
    ...(value.video ? {video: {src: value.video.src, poster: value.video.poster, title: value.video.title, duration: value.video.duration}} : {}),
  };
}
