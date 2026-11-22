import { sourceRoute } from '../desktop/router';
import { parseArticle } from './articleMarkdown';
import {productOverviewIssues, publicProductOverview, validProductOverview} from './productOverview';
import { parsePhotoMediaPath } from './mediaPath';
import type {
  AboutContent,
  EditorialMeta,
  ElsewhereLink,
  FieldNote,
  PhotoRecord,
  ResumeContent,
  SiteContent,
  SiteContentView,
  Story,
} from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const hasText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
function overviewIssues(value:unknown):string[]{
 if(!isRecord(value))return ['Overview must be an object.'];
 if(!['introduction','challenge','contribution','impact','tradeoff'].every(key=>hasText(value[key])))return ['Overview needs all authored sections.'];
 if(!Array.isArray(value.highlights)||value.highlights.length!==3||value.highlights.some(h=>!isRecord(h)||!hasText(h.title)||!hasText(h.body)))return ['Overview needs exactly three authored highlights.'];
 if(!isRecord(value.artifact)||!hasText(value.artifact.src)||parsePhotoMediaPath(value.artifact.src)?.kind!=='public'||!hasText(value.artifact.alt)||!hasText(value.artifact.caption))return ['Overview needs a reviewed local artifact and caption.'];
 return [];
}

export function isPublicEntry(entry: EditorialMeta): boolean {
  return entry.status === 'published' && entry.disclosureStatus === 'cleared';
}

export function validateStoryForPublish(story: Story): string[] {
  const issues: string[] = [];
  if(story.overview&&overviewIssues(story.overview).length)issues.push(...overviewIssues(story.overview));
  else if(story.overview){
    const o=story.overview;
    if(!hasText(story.subject)||!hasText(o.introduction)||!hasText(o.challenge)||!hasText(o.contribution)||!hasText(o.impact)||!hasText(o.tradeoff))issues.push('A complete authored overview is required.');
    if(o.highlights.length!==3||o.highlights.some(h=>!hasText(h.title)||!hasText(h.body)))issues.push('An overview needs exactly three authored highlights.');
    if(parsePhotoMediaPath(o.artifact.src)?.kind!=='public'||!hasText(o.artifact.alt)||!hasText(o.artifact.caption))issues.push('Overview artwork needs a reviewed local image, description and caption.');
  }
  if (story.caseStage === 'preview') issues.push('Finish the case preview before publication.');
  if (!hasText(story.title)) issues.push('A title is required.');
  if (!hasText(story.slug)) issues.push('A stable slug is required.');
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(story.slug)) issues.push('Slug must use lowercase letters, numbers, and hyphens.');
  if (!hasText(story.context)) issues.push('A context is required.');
  if (!hasText(story.summary)) issues.push('A summary is required.');
  if (!hasText(story.role)) issues.push('A verified role is required.');
  if (hasText(story.articleMarkdown)) {
    const blocks = parseArticle(story.articleMarkdown);
    if (!blocks.some(block => block.type === 'heading' && block.level === 1)) issues.push('An article title is required.');
    if (!blocks.some(block => block.type === 'heading' && block.level >= 2)) issues.push('Article sections are required.');
    if (blocks.some(block => block.type === 'image' && parsePhotoMediaPath(block.src)?.kind !== 'public')) issues.push('Article images must use the reviewed local media library.');
  } else {
    if (!hasText(story.problem)) issues.push('A sourced problem section is required.');
    if (!hasText(story.decisions)) issues.push('A sourced decisions section is required.');
    if (!hasText(story.execution)) issues.push('A sourced execution section is required.');
  }
  if (!story.sourceRefs?.length) issues.push('At least one editorial source reference is required.');
  if (story.disclosureStatus !== 'cleared') issues.push('Disclosure review must be cleared.');
  if (story.kind === 'side-project' && !story.maturity) issues.push('A truthful maturity label is required.');
  return issues;
}

export function validatePhotoForPublish(photo: PhotoRecord): string[] {
  const issues: string[] = [];
  if (!hasText(photo.title)) issues.push('A title is required.');
  if (!hasText(photo.src)) issues.push('A reviewed image file is required.');
  else if (!parsePhotoMediaPath(photo.src)) issues.push('Image must use the reviewed local media library.');
  if (!hasText(photo.alt)) issues.push('Alt text is required.');
  if (!hasText(photo.caption)) issues.push('A caption is required.');
  if (!hasText(photo.credit)) issues.push('A creator credit is required.');
  if (!hasText(photo.rights)) issues.push('A rights review is required.');
  if (photo.rightsCleared !== true) issues.push('Image rights and privacy must be explicitly cleared.');
  if (!photo.sourceRefs?.length) issues.push('The image source must be recorded.');
  if (photo.disclosureStatus !== 'cleared') issues.push('Disclosure review must be cleared.');
  if (photo.gallery === true) {
    try {
      const url = new URL(photo.gallerySourceUrl || '');
      if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(url.hostname) || !/^\/(?:p|reel)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) throw new Error('Invalid source');
    } catch { issues.push('Personal gallery photos need a verified individual Instagram post or reel URL.'); }
  }
  return issues;
}

export function validateFieldNoteForPublish(note: FieldNote): string[] {
  const issues: string[] = [];
  if (!hasText(note.title) || !hasText(note.summary)) issues.push('A title and summary are required.');
  try {
    const url = new URL(note.url);
    if (url.protocol !== 'https:' || url.hostname !== 'medium.com') issues.push('Use a verified HTTPS Medium article URL.');
  } catch {
    issues.push('A verified article URL is required.');
  }
  if (!note.sourceRefs?.length) issues.push('The published article must be cited editorially.');
  if (note.disclosureStatus !== 'cleared') issues.push('Disclosure review must be cleared.');
  return issues;
}

export function validateElsewhereForPublish(link: ElsewhereLink): string[] {
  const issues: string[] = [];
  if (!hasText(link.label)) issues.push('A link label is required.');
  try {
    const url = new URL(link.url ?? '');
    if (url.protocol !== 'https:' && !(link.id === 'email' && /^mailto:[^\s@?]+@[^\s@?]+\.[^\s@?]+$/.test(link.url ?? ''))) issues.push('Elsewhere links must use HTTPS or a plain email mailto destination.');
  } catch {
    issues.push('A verified destination is required.');
  }
  if (link.disclosureStatus !== 'cleared') issues.push('Disclosure review must be cleared.');
  return issues;
}

/** Checks the file boundary before server/editor code treats JSON as content. */
export function validateSiteContent(value: unknown): string[] {
  const issues: string[] = [];
  if (!isRecord(value)) return ['Content root must be an object.'];
  for (const key of ['stories', 'fieldNotes', 'photos', 'elsewhere']) {
    if (!Array.isArray(value[key])) issues.push(`${key} must be an array.`);
  }
  if (!isRecord(value.about)) issues.push('about must be an object.');
  else for (const key of ['journey', 'principles', 'competencies']) {
    if (!Array.isArray(value.about[key])) issues.push(`about.${key} must be an array.`);
  }
  if (!isRecord(value.resume)) issues.push('resume must be an object.');
  else {
    if (!Array.isArray(value.resume.chapters)) issues.push('resume.chapters must be an array.');
    if (!Array.isArray(value.resume.entries)) issues.push('resume.entries must be an array.');
    if (!Array.isArray(value.resume.footerLines)) issues.push('resume.footerLines must be an array.');
  }
  if (issues.length) return issues;

  for (const key of ['principles', 'competencies']) for (const [index,entry] of ((value.about as Record<string,unknown>)[key] as unknown[]).entries()) {
    if (isRecord(entry) && entry.tools !== undefined && (typeof entry.tools !== 'string' || entry.tools.length > 400)) issues.push(`about.${key}[${index}].tools must be bounded text.`);
  }
  const photoCandidates = (value.photos as unknown[]).filter(isRecord);
  const resume = value.resume as Record<string, unknown>;
  if (!['draft', 'in-review', 'published', 'hidden'].includes(String(resume.status))) issues.push('resume.status is invalid.');
  if (!['cleared', 'needs-review', 'restricted'].includes(String(resume.disclosureStatus))) issues.push('resume.disclosureStatus is invalid.');
  if (resume.status === 'published' && resume.disclosureStatus !== 'cleared') issues.push('resume cannot publish without clearance.');
  if (resume.status === 'published' && (!hasText(resume.name) || !hasText(resume.introduction))) issues.push('resume needs a reviewed name and introduction before publication.');
  if (resume.status === 'published' && !(resume.footerLines as unknown[]).every(hasText)) issues.push('resume footer lines must contain text.');
  if (resume.status === 'published' && !(resume.footerLines as unknown[]).length) issues.push('resume needs reviewed footer lines before publication.');
  if (resume.status === 'published' && !hasText(resume.outsideWork)) issues.push('resume needs reviewed outside-work text before publication.');
  if (resume.status === 'published' && !(Array.isArray(resume.sourceRefs) && resume.sourceRefs.length > 0)) issues.push('resume needs editorial source references before publication.');
  if (resume.status === 'published' && !(resume.entries as unknown[]).some(entry => isRecord(entry) && entry.status === 'published' && entry.disclosureStatus === 'cleared')) issues.push('resume needs at least one cleared career entry before publication.');
  if (hasText(resume.downloadUrl) && !/^https:\/\/[^\s]+$/.test(resume.downloadUrl) && !/^\/[a-zA-Z0-9/_-]+\.pdf$/.test(resume.downloadUrl) && resume.downloadUrl !== '/api/resume/download') issues.push('resume download URL must be HTTPS or a local PDF path.');
  const chapterIds = new Set<string>();
  for (const [index, chapter] of (resume.chapters as unknown[]).entries()) {
    if (!isRecord(chapter)) { issues.push(`resume.chapters[${index}] must be an object.`); continue; }
    if (!hasText(chapter.id)) issues.push(`resume.chapters[${index}] needs an identity.`);
    else if (chapterIds.has(chapter.id)) issues.push(`resume.chapters[${index}].id is duplicated.`);
    else chapterIds.add(chapter.id);
    if (!hasText(chapter.dates) || !hasText(chapter.title)) issues.push(`resume.chapters[${index}] needs dates and title.`);
    if (!isNumber(chapter.displayOrder)) issues.push(`resume.chapters[${index}].displayOrder must be a finite number.`);
  }
  const resumeEntryIds = new Set<string>();
  for (const [index, entry] of (resume.entries as unknown[]).entries()) {
    if (!isRecord(entry)) { issues.push(`resume.entries[${index}] must be an object.`); continue; }
    if (!hasText(entry.id)) issues.push(`resume.entries[${index}] needs an identity.`);
    else if (resumeEntryIds.has(entry.id)) issues.push(`resume.entries[${index}].id is duplicated.`);
    else resumeEntryIds.add(entry.id);
    if (!isNumber(entry.displayOrder)) issues.push(`resume.entries[${index}].displayOrder must be a finite number.`);
    if (!Array.isArray(entry.additionalLines) || !entry.additionalLines.every(hasText)) issues.push(`resume.entries[${index}].additionalLines must be an array of text.`);
    if (!['employment', 'education', 'training'].includes(String(entry.kind))) issues.push(`resume.entries[${index}].kind is invalid.`);
    if (!['draft', 'in-review', 'published', 'hidden'].includes(String(entry.status))) issues.push(`resume.entries[${index}].status is invalid.`);
    if (!['cleared', 'needs-review', 'restricted'].includes(String(entry.disclosureStatus))) issues.push(`resume.entries[${index}].disclosureStatus is invalid.`);
    if (entry.status === 'published' && (!hasText(entry.organization) || !hasText(entry.title) || !hasText(entry.dates) || !hasText(entry.chapter) || !chapterIds.has(entry.chapter))) issues.push(`resume.entries[${index}] needs organization, title, dates, and a valid chapter before publication.`);
    if (entry.status === 'published' && entry.kind !== 'education' && !hasText(entry.summary)) issues.push(`resume.entries[${index}] needs a summary before publication.`);
    if (entry.status === 'published' && entry.disclosureStatus !== 'cleared') issues.push(`resume.entries[${index}] cannot publish without clearance.`);
  }

  for (const key of ['stories', 'fieldNotes', 'photos', 'elsewhere'] as const) {
    const items = value[key] as unknown[];
    const ids = new Set<string>();
    const slugs = new Set<string>();
    for (const [index, item] of items.entries()) {
      const label = `${key}[${index}]`;
      if (!isRecord(item)) { issues.push(`${label} must be an object.`); continue; }
      if (!hasText(item.id)) issues.push(`${label}.id is required.`);
      else if (ids.has(item.id)) issues.push(`${label}.id is duplicated.`);
      else ids.add(item.id);
      if (key !== 'elsewhere') {
        if (!hasText(item.slug)) issues.push(`${label}.slug is required.`);
        else if (slugs.has(item.slug)) issues.push(`${label}.slug is duplicated.`);
        else slugs.add(item.slug);
      }
      if (!isNumber(item.displayOrder)) issues.push(`${label}.displayOrder must be a finite number.`);
      if (!['draft', 'in-review', 'published', 'hidden'].includes(String(item.status))) issues.push(`${label}.status is invalid.`);
      if (!['cleared', 'needs-review', 'restricted'].includes(String(item.disclosureStatus))) issues.push(`${label}.disclosureStatus is invalid.`);
      if (item.status === 'published' && item.disclosureStatus !== 'cleared') issues.push(`${label} cannot publish without clearance.`);
      if(key==='stories'&&item.overview!==undefined)issues.push(...overviewIssues(item.overview).map(issue=>`${label}: ${issue}`));
      if(key==='stories'&&item.caseMedia!==undefined&&(!Array.isArray(item.caseMedia)||item.caseMedia.some(m=>!isRecord(m)||!hasText(m.src)||parsePhotoMediaPath(m.src)?.kind!=='public'||!hasText(m.alt)||m.rightsCleared!==true)))issues.push(`${label}: Case media requires reviewed local paths, alt text and explicit rights clearance.`);
      if (key === 'stories' && item.highlights !== undefined && (!Array.isArray(item.highlights) || item.highlights.length > 6 || !item.highlights.every(text => hasText(text) && text.length <= 300))) issues.push(`${label}.highlights must contain up to six short text items.`);
      if (key === 'photos' && item.gallery !== undefined && typeof item.gallery !== 'boolean') issues.push(`${label}.gallery must be a boolean.`);
      if (key === 'photos' && item.gallerySourceUrl !== undefined && typeof item.gallerySourceUrl !== 'string') issues.push(`${label}.gallerySourceUrl must be text.`);
      if (key === 'stories' && item.supportingMediaIds !== undefined && (!Array.isArray(item.supportingMediaIds) || !item.supportingMediaIds.every(hasText))) issues.push(`${label}.supportingMediaIds must be an array of image IDs.`);
      if (key === 'stories') {
        if(item.productOverview!==undefined)issues.push(...productOverviewIssues(item.productOverview).map(issue=>`${label}: ${issue}`));
        for(const field of ['repositoryUrl','liveUrl'])if(item[field]!==undefined&&(!hasText(item[field])||!/^https:\/\/[^\s/@]+(?:\/[^\s]*)?$/.test(String(item[field]))))issues.push(`${label}.${field} needs a valid HTTPS destination.`);
        if(item.decisionTradeoffs!==undefined&&(!Array.isArray(item.decisionTradeoffs)||item.decisionTradeoffs.some(d=>!isRecord(d)||!hasText(d.choice)||!hasText(d.tradeoff))))issues.push(`${label}: Decisions need supported choice and tradeoff text.`);
        if (item.caseStage !== undefined && (typeof item.caseStage !== 'string' || !['', 'preview', 'complete'].includes(item.caseStage))) issues.push(`${label}.caseStage is invalid.`);
        for (const field of ['articleMarkdown', 'coverMediaId', 'tileMediaId', 'menuLabel']) {
          if (item[field] !== undefined && typeof item[field] !== 'string') issues.push(`${label}.${field} must be text.`);
        }
        if (item.status === 'published') {
          issues.push(...validateStoryForPublish(item as unknown as Story).map(issue => `${label}: ${issue}`));
          const article = typeof item.articleMarkdown === 'string' ? parseArticle(item.articleMarkdown) : [];
          const imagePaths = [...article.filter(block => block.type === 'image').map(block => block.src),...(isRecord(item.overview)&&isRecord(item.overview.artifact)&&hasText(item.overview.artifact.src)?[item.overview.artifact.src]:[])];
          for (const path of imagePaths) if (!(Array.isArray(item.caseMedia)&&item.caseMedia.some(m=>isRecord(m)&&m.src===path&&m.rightsCleared===true))&&!photoCandidates.some(photo => photo.src === path && photo.status === 'published' && photo.disclosureStatus === 'cleared' && photo.rightsCleared === true)) issues.push(`${label}: Article image needs a cleared public media record.`);
          for (const field of ['coverMediaId', 'tileMediaId']) if (hasText(item[field]) && !photoCandidates.some(photo => photo.id === item[field] && photo.status === 'published' && photo.disclosureStatus === 'cleared' && photo.rightsCleared === true && typeof photo.src === 'string' && parsePhotoMediaPath(photo.src)?.kind === 'public')) issues.push(`${label}.${field} needs a cleared public media record.`);
        }
      }
      if (key === 'photos' && item.status === 'published') issues.push(...validatePhotoForPublish(item as unknown as PhotoRecord).map(issue => `${label}: ${issue}`));
      if(key==='fieldNotes'){
        for(const field of ['coverSrc','coverAlt','group'])if(item[field]!==undefined&&typeof item[field]!=='string')issues.push(`${label}.${field} must be text.`);
        if(item.coverSrc!==undefined&&(!hasText(item.coverSrc)||parsePhotoMediaPath(item.coverSrc)?.kind!=='public'||!hasText(item.coverAlt)))issues.push(`${label}: Article cover needs a valid local public media path and alt text.`);
        if(item.featured!==undefined&&typeof item.featured!=='boolean')issues.push(`${label}.featured must be a boolean.`);
        if(item.groupKind!==undefined&&!['series','editorial'].includes(String(item.groupKind)))issues.push(`${label}.groupKind is invalid.`);
        for(const field of ['previewBullets','keywords'])if(item[field]!==undefined&&(!Array.isArray(item[field])||item[field].length>(field==='keywords'?12:6)||!item[field].every(x=>hasText(x)&&x.length<=(field==='keywords'?64:800))))issues.push(`${label}.${field} must contain bounded nonempty text items.`);
      }
      if (key === 'fieldNotes' && item.status === 'published') issues.push(...validateFieldNoteForPublish(item as unknown as FieldNote).map(issue => `${label}: ${issue}`));
      if (key === 'elsewhere' && item.status === 'published') issues.push(...validateElsewhereForPublish(item as unknown as ElsewhereLink).map(issue => `${label}: ${issue}`));
    }
  }
  return issues;
}

/** Public API/Guide projection. This also strips private source paths from nested content. */
export function toPublicContent(content: SiteContent): SiteContentView {
  const scrub = <T extends EditorialMeta>(entry: T): T => {
    const { sourceRefs: _refs, reviewNotes: _notes, ...safe } = entry;
    void _refs; void _notes;
    return safe as T;
  };
  const scrubResume = (entry: ResumeContent) => {
    const { downloadUrl: _download, ...safe } = scrub(entry);
    void _download; return safe;
  };
  const about: AboutContent = {
    journey: content.about.journey.filter(isPublicEntry).map(scrub),
    principles: content.about.principles.filter(isPublicEntry).map(scrub),
    competencies: content.about.competencies.filter(isPublicEntry).map(scrub),
  };
  const publicResumeChapters = content.resume.chapters.map(({ id, dates, title, displayOrder }) => ({ id, dates, title, displayOrder })).sort((a, b) => a.displayOrder - b.displayOrder);
  const publicResumeChapterIds = new Set(publicResumeChapters.map(chapter => chapter.id));
  const resume = isPublicEntry(content.resume)
    ? { ...scrubResume(content.resume), chapters: publicResumeChapters, entries: content.resume.entries.filter(entry => isPublicEntry(entry) && publicResumeChapterIds.has(entry.chapter)).map(entry => {
        const { sourceRefs: _refs, reviewNotes: _notes, ...safe } = entry;
        void _refs; void _notes;
        return safe;
      }).sort((a, b) => a.displayOrder - b.displayOrder) }
    : null;
  const stories = content.stories.filter(story => isPublicEntry(story) && story.caseStage !== 'preview').map(story=>{
    const {productOverview:_product,...base}=scrub(story);void _product;
    const safe={...base,...(validProductOverview(story.productOverview)?{productOverview:publicProductOverview(story.productOverview)}:{}),...(story.caseMedia?{caseMedia:story.caseMedia.map(m=>({src:m.src,alt:m.alt,rightsCleared:m.rightsCleared}))}:{})};const o=story.overview;if(!o)return safe;
    return {...safe,overview:{introduction:o.introduction,challenge:o.challenge,contribution:o.contribution,impact:o.impact,tradeoff:o.tradeoff,artifact:{src:o.artifact.src,alt:o.artifact.alt,caption:o.artifact.caption},highlights:o.highlights.map(h=>({title:h.title,body:h.body}))}};
  }).sort((a, b) => a.displayOrder - b.displayOrder);
  const publicProjectRoutes = new Set([
    '/work', '/ai-lab', '/side-projects',
    ...stories.map(story => sourceRoute(story.kind, story.slug)),
  ]);
  const photos = content.photos.filter(photo => isPublicEntry(photo) && photo.rightsCleared === true).map(photo => {
    const safe = scrub(photo);
    if (!safe.projectHref || publicProjectRoutes.has(safe.projectHref)) return safe;
    // A cleared illustration may outlive the disclosure status of its linked case.
    // Keep its media, while removing navigation to content this projection excludes.
    const { projectHref: _projectHref, ...withoutPrivateRelation } = safe;
    void _projectHref;
    return withoutPrivateRelation;
  }).sort((a, b) => a.displayOrder - b.displayOrder);
  return {
    stories,
    fieldNotes: content.fieldNotes.filter(isPublicEntry).map(scrub).sort((a, b) => a.displayOrder - b.displayOrder),
    photos,
    resume,
    about,
    elsewhere: content.elsewhere.filter(link => isPublicEntry(link) && hasText(link.url)).map(scrub).sort((a, b) => a.displayOrder - b.displayOrder),
  };
}
