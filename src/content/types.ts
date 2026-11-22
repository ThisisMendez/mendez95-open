/** Editorial data lives in project-root content/*.json and is loaded by the server. */
export type ContentStatus = 'draft' | 'in-review' | 'published' | 'hidden';
export type DisclosureStatus = 'cleared' | 'needs-review' | 'restricted';
export type StoryKind = 'case-study' | 'decision-note' | 'ai-lab' | 'side-project' | 'career-story';
export type ProjectMaturity = 'idea' | 'in-progress' | 'prototype' | 'shipped';

export interface EditorialMeta {
  status: ContentStatus;
  disclosureStatus: DisclosureStatus;
  /** Private editorial provenance. Never send to a public client or model. */
  sourceRefs?: string[];
  /** Private review instructions. Never send to a public client or model. */
  reviewNotes?: string;
}

export interface Story extends EditorialMeta {
  id: string;
  slug: string;
  title: string;
  kind: StoryKind;
  context: string;
  summary: string;
  role: string;
  dates?: string;
  subject?: string;
  repositoryUrl?: string;
  liveUrl?: string;
  productOverview?: ProductOverview;
  decisionTradeoffs?: {choice:string;tradeoff:string}[];
  caseMedia?: {src:string;alt:string;rightsCleared:boolean}[];
  overview?: { introduction:string; artifact:{src:string;alt:string;caption:string}; highlights:{title:string;body:string}[]; challenge:string; contribution:string; impact:string; tradeoff:string };
  disclaimer?: string;
  /** Complete approved prose for the shared Editorial paper reader. */
  articleMarkdown?: string;
  coverMediaId?: string;
  tileMediaId?: string;
  menuLabel?: string;
  /** Preview blocks public publication until the finished narrative is supplied. */
  caseStage?: 'preview' | 'complete' | '';
  /** Three concise, source-backed takeaways selected by the editor. */
  highlights?: string[];
  supportingMediaIds?: string[];
  problem?: string;
  decisions?: string;
  execution?: string;
  results?: string;
  lessons?: string;
  maturity?: ProjectMaturity;
  featured: boolean;
  displayOrder: number;
  tags: string[];
  relatedIds: string[];
}

export interface ProductOverview {
  tagline: string;
  why: string;
  workflow: {title: string; body: string}[];
  architecture: {title: string; choice: string; tradeoff: string}[];
  ownership: string;
  shipped: {title: string; body: string}[];
  releaseLabel: string;
  next: string;
  integrations?: string;
  onePagerUrl?: string;
  video?: {src: string; poster: string; title: string; duration: string};
}

export interface FieldNote extends EditorialMeta {
  /** Published-article presentation; canonical source stays in url/sourceRefs. */
  coverSrc?: string;
  coverAlt?: string;
  featured?: boolean;
  group?: string;
  groupKind?: 'series' | 'editorial';
  previewBullets?: string[];
  keywords?: string[];
  id: string;
  slug: string;
  title: string;
  summary: string;
  /** Verified article URL; an empty URL is never a public link. */
  url: string;
  publishedAt?: string;
  readingMinutes?: number;
  tags: string[];
  displayOrder: number;
}

export interface PhotoRecord extends EditorialMeta {
  id: string;
  slug: string;
  title: string;
  src: string;
  alt: string;
  caption: string;
  credit: string;
  rights: string;
  /** Explicit owner rights/privacy decision; free-text rights alone is insufficient. */
  rightsCleared: boolean;
  /** Explicitly opts an image into the personal Photos gallery. Case media defaults out. */
  gallery?: boolean;
  /** Original gallery post/source URL when an individual personal image is selected. */
  gallerySourceUrl?: string;
  projectHref?: string;
  displayOrder: number;
}

export interface ResumeEntry extends EditorialMeta {
  id: string;
  chapter: string;
  kind: 'employment' | 'education' | 'training';
  organization: string;
  title: string;
  dates: string;
  summary?: string;
  additionalLines: string[];
  displayOrder: number;
  sourceRefs?: string[];
  reviewNotes?: string;
}

export interface ResumeChapter {
  id: string;
  dates: string;
  title: string;
  displayOrder: number;
}

export interface ResumeContent extends EditorialMeta {
  name: string;
  introduction: string;
  chapters: ResumeChapter[];
  entries: ResumeEntry[];
  footerLines: string[];
  outsideWork: string;
  downloadUrl?: string;
}

export interface TextEntry extends EditorialMeta {
  /** Compact, editor-authored toolkit/practice labels. */
  tools?: string;
  caseId?:string;
  caseLabel?:string;
  areas?:string[];
  referenceUrl?: string;
  referenceAuthor?: string;
  id: string;
  label: string;
  body: string;
  displayOrder: number;
}

export interface JourneyEntry extends EditorialMeta {
  id: string;
  title: string;
  body: string;
  dates?: string;
  displayOrder: number;
}

export interface AboutContent {
  journey: JourneyEntry[];
  principles: TextEntry[];
  competencies: TextEntry[];
}

export interface ElsewhereLink extends EditorialMeta {
  id: string;
  label: string;
  url?: string;
  displayOrder: number;
}

export interface SiteContent {
  stories: Story[];
  fieldNotes: FieldNote[];
  photos: PhotoRecord[];
  resume: ResumeContent;
  about: AboutContent;
  elsewhere: ElsewhereLink[];
}

/** What the public and owner-preview API can return after server-side projection. */
export type SiteContentView = Omit<SiteContent, 'resume'> & { resume: ResumeContent | null; reviewMode?: boolean; resumeDownloadUrl?: string };
