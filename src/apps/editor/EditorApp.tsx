import { useEffect, useRef, useState } from 'react';
import {OwnerSignIn} from './OwnerSignIn';
import type { AboutContent, ElsewhereLink, FieldNote, JourneyEntry, PhotoRecord, ResumeChapter, ResumeEntry, SiteContent, Story, TextEntry } from '../../content/types';
import { validatePhotoForPublish, validateStoryForPublish } from '../../content/validation';
import BoardModeration from '../board/BoardModeration';
import OwnerAnalytics from './OwnerAnalytics';
import {ResumeRequests} from './ResumeRequests';
import './editor.css';

type Tab = 'stories' | 'field-notes' | 'photos' | 'resume' | 'about' | 'elsewhere';
type AboutSection = keyof AboutContent;
type FormItem = Story | FieldNote | PhotoRecord | ResumeEntry | TextEntry | JourneyEntry | ElsewhereLink;
type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'lines' | 'csv' | 'url';
type Field = { key: string; label: string; type?: FieldType; options?: string[]; hint?: string };
const tabs: { id: Tab; label: string }[] = [
  { id: 'stories', label: 'Stories' }, { id: 'photos', label: 'Photos' }, { id: 'field-notes', label: 'Field Notes' },
  { id: 'resume', label: 'Resume' }, { id: 'about', label: 'About' }, { id: 'elsewhere', label: 'Elsewhere' },
];
const statuses = ['draft', 'in-review', 'published', 'hidden'];
const disclosures = ['needs-review', 'cleared', 'restricted'];
const storyFields: Field[] = [
  { key: 'title', label: 'Title' }, { key: 'slug', label: 'Stable URL slug', hint: 'Changing a saved slug creates a redirect.' },
  { key: 'kind', label: 'Type', type: 'select', options: ['case-study', 'decision-note', 'ai-lab', 'side-project', 'career-story'] },
  { key: 'context', label: 'Organization or context' }, { key: 'role', label: 'Verified role' }, { key: 'dates', label: 'Date display' },
  { key: 'articleMarkdown', label: 'Editorial article (Markdown)', type: 'textarea', hint: 'Complete approved narrative. Uses its own headings instead of the legacy sections below. Images must reference cleared local media.' },
  { key: 'caseStage', label: 'Article stage', type: 'select', options: ['', 'preview', 'complete'], hint: 'Preview keeps the coming-soon notice and blocks public publication. Replace the body with its final draft before marking complete and clearing publication.' },
  {key:'subject',label:'Case subject'},
  { key: 'menuLabel', label: 'Compact folder / menu label' }, { key: 'coverMediaId', label: 'Cover image ID' }, { key: 'tileMediaId', label: 'Fallback folder image ID', hint: 'The six portfolio cases use the shared original case-icon set. This field remains a fallback for other stories.' },
  { key: 'repositoryUrl', label: 'Verified source repository', type: 'url' }, { key: 'liveUrl', label: 'Verified live project', type: 'url', hint: 'Leave empty when unavailable; a prototype is not a public launch.' },
  { key: 'summary', label: 'Summary', type: 'textarea' }, { key: 'highlights', label: 'Three sourced highlights', type: 'lines', hint: 'Deliberate contributions or supported outcomes, not arbitrary sentence excerpts.' }, { key: 'disclaimer', label: 'Disclosure note', type: 'textarea' }, { key: 'supportingMediaIds', label: 'Supporting image IDs', type: 'csv', hint: 'Use IDs from Photos. Public views include only cleared published images.' }, { key: 'problem', label: 'Problem', type: 'textarea' },
  { key: 'decisions', label: 'Decisions and tradeoffs', type: 'textarea' }, { key: 'execution', label: 'Execution', type: 'textarea' },
  { key: 'results', label: 'Evidence and results', type: 'textarea', hint: 'Leave empty if results are not verified.' },
  { key: 'lessons', label: 'Lessons', type: 'textarea' }, { key: 'maturity', label: 'Side-project maturity', type: 'select', options: ['', 'idea', 'in-progress', 'prototype', 'shipped'] },
  { key: 'tags', label: 'Tags', type: 'csv' }, { key: 'relatedIds', label: 'Related story IDs', type: 'csv' },
  { key: 'displayOrder', label: 'Display order', type: 'number' }, { key: 'featured', label: 'Feature in Portfolio', type: 'checkbox', hint: 'Draft features appear in local review. Public features still require Published + Cleared.' },
  { key: 'status', label: 'Publication status', type: 'select', options: statuses }, { key: 'disclosureStatus', label: 'Disclosure review', type: 'select', options: disclosures },
  { key: 'sourceRefs', label: 'Editorial source references', type: 'lines', hint: 'Private references; never shown publicly.' },
  { key: 'reviewNotes', label: 'Private review notes', type: 'textarea' },
];
const photoFields: Field[] = [
  { key: 'title', label: 'Title' }, { key: 'slug', label: 'Stable URL slug' }, { key: 'src', label: 'Image path', hint: 'Use Upload or Replace below.' },
  { key: 'alt', label: 'Alt text', type: 'textarea' }, { key: 'caption', label: 'Caption', type: 'textarea' },
  { key: 'credit', label: 'Creator credit' }, { key: 'rights', label: 'Rights / privacy review' },
  { key: 'gallery', label: 'Include in personal Instagram gallery', type: 'checkbox' }, { key: 'gallerySourceUrl', label: 'Verified Instagram post URL', type: 'url', hint: 'Only individually selected Instagram originals belong to Photos. Case media remains separate.' },
  { key: 'rightsCleared', label: 'I reviewed rights and privacy for public display', type: 'checkbox' }, { key: 'projectHref', label: 'Related project URL', type: 'url' },
  { key: 'displayOrder', label: 'Display order', type: 'number' }, { key: 'status', label: 'Publication status', type: 'select', options: statuses },
  { key: 'disclosureStatus', label: 'Disclosure review', type: 'select', options: disclosures }, { key: 'sourceRefs', label: 'Editorial source references', type: 'lines' },
  { key: 'reviewNotes', label: 'Private review notes', type: 'textarea' },
];
const noteFields: Field[] = [
  {key:'coverSrc',label:'Verified local article cover',type:'text'},{key:'coverAlt',label:'Article cover description'},{key:'featured',label:'Default highlighted article',type:'checkbox'},{key:'group',label:'Series or editorial group'},{key:'groupKind',label:'Group type',type:'select',options:['','series','editorial']},{key:'previewBullets',label:'Quick look coverage bullets',type:'lines',hint:'Original source-supported summary; not a duplicate full article.'},{key:'keywords',label:'Keywords',type:'csv'},
  { key: 'title', label: 'Article title' }, { key: 'slug', label: 'Stable slug' }, { key: 'summary', label: 'Original short summary', type: 'textarea' },
  { key: 'url', label: 'Verified Medium URL', type: 'url' }, { key: 'publishedAt', label: 'Verified publication date' }, { key: 'tags', label: 'Tags', type: 'csv' },
  { key: 'displayOrder', label: 'Display order', type: 'number' }, { key: 'status', label: 'Publication status', type: 'select', options: statuses },
  { key: 'disclosureStatus', label: 'Disclosure review', type: 'select', options: disclosures }, { key: 'sourceRefs', label: 'Editorial source references', type: 'lines' },
  { key: 'reviewNotes', label: 'Private review notes', type: 'textarea' },
];
const elsewhereFields: Field[] = [
  { key: 'label', label: 'Label' }, { key: 'url', label: 'Verified destination', type: 'url' }, { key: 'displayOrder', label: 'Display order', type: 'number' },
  { key: 'status', label: 'Publication status', type: 'select', options: statuses }, { key: 'disclosureStatus', label: 'Disclosure review', type: 'select', options: disclosures },
  { key: 'sourceRefs', label: 'Editorial source references', type: 'lines' }, { key: 'reviewNotes', label: 'Private review notes', type: 'textarea' },
];
const aboutFields: Field[] = [
  { key: 'label', label: 'Label or principle' }, { key: 'tools', label: 'Toolkit / practice labels', hint: 'For How I Build cards; separate labels with ·.' }, { key: 'title', label: 'Career entry title' }, { key: 'dates', label: 'Career dates' },
  { key: 'body', label: 'Body', type: 'textarea' }, { key: 'displayOrder', label: 'Display order', type: 'number' },
  { key: 'status', label: 'Publication status', type: 'select', options: statuses }, { key: 'disclosureStatus', label: 'Disclosure review', type: 'select', options: disclosures },
  { key: 'sourceRefs', label: 'Editorial source references', type: 'lines' },
];
const resumeEntryFields: Field[] = [
  { key: 'chapter', label: 'Chapter', type: 'select', options: [] }, { key: 'kind', label: 'Entry type', type: 'select', options: ['employment', 'education', 'training'] },
  { key: 'organization', label: 'Organization' }, { key: 'title', label: 'Title or qualification' }, { key: 'dates', label: 'Verified dates' },
  { key: 'summary', label: 'Summary', type: 'textarea', hint: 'Required for employment and training; education may omit it.' }, { key: 'additionalLines', label: 'Additional lines, one per line', type: 'lines' },
  { key: 'displayOrder', label: 'Display order', type: 'number' }, { key: 'status', label: 'Publication status', type: 'select', options: statuses },
  { key: 'disclosureStatus', label: 'Disclosure review', type: 'select', options: disclosures }, { key: 'sourceRefs', label: 'Editorial source references', type: 'lines' },
  { key: 'reviewNotes', label: 'Private review notes', type: 'textarea' },
];
const resumeFields: Field[] = [
  { key: 'name', label: 'Name' }, { key: 'introduction', label: 'Resume introduction', type: 'textarea' },
  { key: 'footerLines', label: 'Footer credentials, one per line', type: 'lines' }, { key: 'outsideWork', label: 'Outside work line', type: 'textarea' },
  { key: 'status', label: 'Publication status', type: 'select', options: statuses }, { key: 'disclosureStatus', label: 'Disclosure review', type: 'select', options: disclosures },
  { key: 'sourceRefs', label: 'Editorial source references', type: 'lines' }, { key: 'reviewNotes', label: 'Private review notes', type: 'textarea' },
];
function fieldValue(value: unknown, type?: FieldType) { if (Array.isArray(value)) return value.join(type === 'csv' ? ', ' : '\n'); return value == null ? '' : String(value); }
function parseField(value: string | boolean, type?: FieldType): unknown {
  if (type === 'checkbox') return Boolean(value);
  if (type === 'number') return Number(value) || 0;
  if (type === 'lines') return String(value).split('\n').map(item => item.trim()).filter(Boolean);
  if (type === 'csv') return String(value).split(',').map(item => item.trim()).filter(Boolean);
  return value;
}
function fieldId(tab: Tab, itemId: string, key: string) { return `${tab}-${itemId}-${key}`.replace(/[^a-zA-Z0-9-]/g, '-'); }
function normalizeLines(value: string): string[] {
  return value.split('\n').map(item => item.trim()).filter(Boolean);
}
function BufferedResumeLines({ id, value, onChange }: { id: string; value: unknown; onChange: (value: string[]) => void }) {
  const incoming = fieldValue(value, 'lines');
  const [draft, setDraft] = useState(incoming);
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setDraft(incoming); }, [incoming]);
  return <textarea id={id} rows={3} value={draft}
    onFocus={() => { editing.current = true; }}
    onChange={event => { const next = event.target.value; setDraft(next); onChange(normalizeLines(next)); }}
    onBlur={() => { editing.current = false; const lines = normalizeLines(draft); setDraft(lines.join('\n')); onChange(lines); }} />;
}
function previewPath(tab: Tab, item?: FormItem) {
  if (tab === 'stories' && item) { const story = item as Story; return `${story.kind === 'ai-lab' ? '/ai-lab' : story.kind === 'side-project' ? '/side-projects' : '/work'}/${story.slug}`; }
  if (tab === 'photos' && item) return `/photos/${(item as PhotoRecord).slug}`;
  if (tab === 'field-notes' && item) return `/field-notes/${(item as FieldNote).slug}`;
  return tab === 'resume' ? '/resume' : tab === 'about' ? '/about' : tab === 'elsewhere' ? '/contact' : '/work';
}

export default function EditorApp() {
  const [session, setSession] = useState<{ authenticated: boolean; csrfToken?: string; authMode?:'operator'; configured?:boolean } | null>(null);
  const revisions = useRef<Record<string,number>>({});
  const [password, setPassword] = useState('');
  const [data, setData] = useState<SiteContent | null>(null);
  const [tab, setTab] = useState<Tab>('stories');
  const [pane, setPane] = useState<'content' | 'board' | 'analytics' | 'requests'>(location.hash==='#resume-requests'?'requests':'content');
  const [aboutSection, setAboutSection] = useState<AboutSection>('journey');
  const [selected, setSelected] = useState('');
  const [dirty, setDirty] = useState<Set<Tab>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const [backups, setBackups] = useState<{ id: string; savedAt: string }[]>([]);
  const [selectedBackup, setSelectedBackup] = useState('');
  useEffect(() => { void fetch('/api/owner/session', { cache: 'no-store' }).then(response => response.json()).then(setSession).catch(() => setSession({ authenticated: false })); }, []);
  useEffect(() => { if (!session?.authenticated) return; void fetch('/api/editor/content', { cache: 'no-store' }).then(async response => { const version=response.headers.get('x-mendez-revisions'); if(version)revisions.current=JSON.parse(version); return response.json(); }).then(value => { setData(value); setIssues([]); }).catch(() => setMessage('Could not load editorial content.')); }, [session?.authenticated]);
  useEffect(() => {
    if (!session?.authenticated) return;
    void fetch(`/api/editor/backups/${tab}`, { cache: 'no-store' }).then(response => response.json()).then(value => {
      const found = Array.isArray(value.backups) ? value.backups : [];
      setBackups(found); setSelectedBackup(found[0]?.id || '');
    }).catch(() => { setBackups([]); setSelectedBackup(''); });
  }, [session?.authenticated, tab]);
  function change(fn: (copy: SiteContent) => void) {
    setData(current => { if (!current) return current; const copy = structuredClone(current); fn(copy); return copy; });
    setDirty(current => new Set(current).add(tab)); setMessage(''); setIssues([]);
  }
  function itemsOf(content: SiteContent): FormItem[] {
    if (tab === 'stories') return content.stories;
    if (tab === 'photos') return content.photos;
    if (tab === 'field-notes') return content.fieldNotes;
    if (tab === 'elsewhere') return content.elsewhere;
    if (tab === 'resume') return content.resume.entries;
    return content.about[aboutSection];
  }
  function replaceItems(copy: SiteContent, items: FormItem[]) {
    if (tab === 'stories') copy.stories = items as Story[];
    else if (tab === 'photos') copy.photos = items as PhotoRecord[];
    else if (tab === 'field-notes') copy.fieldNotes = items as FieldNote[];
    else if (tab === 'elsewhere') copy.elsewhere = items as ElsewhereLink[];
    else if (tab === 'resume') copy.resume.entries = items as ResumeEntry[];
    else (copy.about[aboutSection] as FormItem[]) = items;
  }
  const items = data ? [...itemsOf(data)].sort((a, b) => (('displayOrder' in a ? a.displayOrder : 0) || 0) - (('displayOrder' in b ? b.displayOrder : 0) || 0)) : [];
  const current = items.find(item => item.id === selected) || items[0];
  const fields = tab === 'stories' ? storyFields : tab === 'photos' ? photoFields : tab === 'field-notes' ? noteFields : tab === 'elsewhere' ? elsewhereFields : tab === 'resume' ? resumeEntryFields.map(field => field.key === 'chapter' ? { ...field, options: data?.resume.chapters.map(chapter => chapter.id) || [] } : field) : aboutFields.filter(field => aboutSection === 'journey' ? field.key !== 'label' : field.key !== 'title' && field.key !== 'dates');
  function updateItem(key: string, value: unknown) { if (!current) return; change(copy => {
    const target = itemsOf(copy).find(item => item.id === current.id) as unknown as Record<string, unknown> | undefined;
    if (target) target[key] = value;
  }); }
  function updateResume(key: string, value: unknown) { change(copy => { (copy.resume as unknown as Record<string, unknown>)[key] = value; }); }
  function updateResumeChapter(chapterId: string, key: string, value: unknown) { change(copy => {
    const chapter = copy.resume.chapters.find(item => item.id === chapterId);
    if (!chapter) return;
    (chapter as unknown as Record<string, unknown>)[key] = value;
  }); }
  function makeItem() {
    const id = crypto.randomUUID(); const order = items.reduce((max, item) => Math.max(max, 'displayOrder' in item ? Number(item.displayOrder) || 0 : 0), 0) + 10;
    const base = { id, displayOrder: order, status: 'draft' as const, disclosureStatus: 'needs-review' as const, sourceRefs: [] as string[], reviewNotes: '' };
    let item: FormItem;
    if (tab === 'stories') item = { ...base, slug: `new-story-${id.slice(0, 8)}`, title: '', kind: 'case-study', context: '', summary: '', role: '', problem: '', decisions: '', execution: '', results: '', lessons: '', featured: false, tags: [], relatedIds: [] };
    else if (tab === 'photos') item = { ...base, slug: `new-photo-${id.slice(0, 8)}`, title: '', src: '', alt: '', caption: '', credit: '', rights: '', rightsCleared: false };
    else if (tab === 'field-notes') item = { ...base, slug: `new-note-${id.slice(0, 8)}`, title: '', summary: '', url: '', tags: [] };
    else if (tab === 'elsewhere') item = { ...base, label: '', url: '' };
    else if (tab === 'resume') item = { ...base, chapter: data?.resume.chapters[0]?.id || '', kind: 'employment', organization: '', title: '', dates: '', summary: '', additionalLines: [] };
    else if (aboutSection === 'journey') item = { ...base, title: '', body: '' };
    else item = { ...base, label: '', body: '' };
    change(copy => replaceItems(copy, [...itemsOf(copy), item])); setSelected(id); setMessage('New draft added locally. Save this collection to keep it.');
  }
  function move(direction: -1 | 1) {
    if (!current) return;
    const index = items.findIndex(item => item.id === current.id), neighbor = items[index + direction]; if (!neighbor) return;
    change(copy => {
      const ordered = [...items];
      [ordered[index], ordered[index + direction]] = [ordered[index + direction]!, ordered[index]!];
      const positions = new Map(ordered.map((item, position) => [item.id, (position + 1) * 10]));
      for (const item of itemsOf(copy)) (item as FormItem & { displayOrder: number }).displayOrder = positions.get(item.id) || 0;
    });
  }
  async function save() {
    if (!data || !session?.csrfToken) return;
    setBusy(true); setIssues([]); setMessage('');
    const key = tab === 'field-notes' ? 'fieldNotes' : tab;
    const value = data[key];
    try {
      const response = await fetch(`/api/editor/content/${tab}`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-mendez-csrf': session.csrfToken, ...(revisions.current[tab]?{'if-match':String(revisions.current[tab])}:{}) }, body: JSON.stringify(value) });
      const result = await response.json();
      if (!response.ok) { setIssues(result.issues || [result.error || 'Save failed.']); return; }
      if(result.version)revisions.current[tab]=result.version;
      setData(currentData => currentData ? { ...currentData, [key]: result.value } : currentData);
      setDirty(currentDirty => { const next = new Set(currentDirty); next.delete(tab); return next; });
      setMessage(`${tabs.find(item => item.id === tab)?.label} saved. Public pages use only Published + Cleared entries.`);
      void fetch(`/api/editor/backups/${tab}`, { cache: 'no-store' }).then(response => response.json()).then(value => { const found = Array.isArray(value.backups) ? value.backups : []; setBackups(found); setSelectedBackup(found[0]?.id || ''); }).catch(() => undefined);
    } catch { setMessage('Save failed. Check the local server connection.'); }
    finally { setBusy(false); }
  }
  async function upload(file: File) {
    if (tab !== 'photos' || !current || !session?.csrfToken) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5_000_000) { setIssues(['Choose a PNG, JPEG, or WebP under 5 MB.']); return; }
    setBusy(true); setIssues([]);
    try {
      let result: {src:string;error?:string};
      if(session.authMode==='operator'){
        const bytes=await file.arrayBuffer();
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
        const headers={'content-type':'application/json','x-mendez-csrf':session.csrfToken};
        const start=await fetch('/api/editor/uploads',{method:'POST',headers,body:JSON.stringify({size:file.size,type:file.type,sha256:digest})});
        const upload=await start.json();if(!start.ok)throw Error(upload.error||'Upload could not start.');
        try{
          for(let offset=0,part=0;offset<file.size;offset+=upload.chunkSize,part++){
            const response=await fetch(`/api/editor/uploads/${upload.id}/${part}`,{method:'PUT',headers:{'x-mendez-csrf':session.csrfToken},body:file.slice(offset,offset+upload.chunkSize)});
            if(!response.ok)throw Error('Image part could not be saved. Please retry the upload.');
          }
          const complete=await fetch(`/api/editor/uploads/${upload.id}/complete`,{method:'POST',headers});result=await complete.json();if(!complete.ok)throw Error('Image verification failed.');
        }catch(error){await fetch(`/api/editor/uploads/${upload.id}`,{method:'DELETE',headers}).catch(()=>undefined);throw error;}
      }else{
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      const response = await fetch('/api/editor/media', { method: 'POST', headers: { 'content-type': 'application/json', 'x-mendez-csrf': session.csrfToken }, body: JSON.stringify({ data: dataUrl }) });
      result = await response.json(); if (!response.ok) throw new Error(result.error || 'Upload failed.');
      }
      updateItem('src', result.src); setMessage('Image uploaded privately. Add rights, caption, alt text, then Save.');
    } catch (cause) { setIssues([cause instanceof Error ? cause.message : 'Upload failed.']); }
    finally { setBusy(false); }
  }
  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setIssues([]);
    try { const response = await fetch('/api/owner/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Sign-in failed.'); setPassword(''); setSession(result); }
    catch (cause) { setIssues([cause instanceof Error ? cause.message : 'Sign-in failed.']); }
    finally { setBusy(false); }
  }
  async function logout() {
    if (session?.csrfToken) await fetch('/api/owner/logout', { method: 'POST', headers: { 'x-mendez-csrf': session.csrfToken } }).catch(() => undefined);
    setSession({ authenticated: false, ...(session?.authMode?{authMode:session.authMode,configured:true}:{}) }); setData(null); setDirty(new Set());
  }
  async function restoreBackup() {
    if (!session?.csrfToken || !selectedBackup) return;
    const confirmed = window.confirm('Restore this saved version of the current collection? Current saved content and any unsaved edits in this collection will be replaced. A backup of the current saved version will be kept.');
    if (!confirmed) return;
    setBusy(true); setIssues([]); setMessage('');
    try {
      const response = await fetch(`/api/editor/restore/${tab}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-mendez-csrf': session.csrfToken, ...(revisions.current[tab]?{'if-match':String(revisions.current[tab])}:{}) }, body: JSON.stringify({ backup: selectedBackup }) });
      const result = await response.json();
      if (!response.ok) { setIssues(result.issues || [result.error || 'Restore failed.']); return; }
      const key = tab === 'field-notes' ? 'fieldNotes' : tab;
      if(result.version)revisions.current[tab]=result.version;
      setData(currentData => currentData ? { ...currentData, [key]: result.value } : currentData);
      setDirty(currentDirty => { const next = new Set(currentDirty); next.delete(tab); return next; });
      setSelected(''); setMessage('Saved version restored. Review its publication status and preview before continuing.');
      const history = await fetch(`/api/editor/backups/${tab}`, { cache: 'no-store' });
      if (history.ok) { const value = await history.json(); const found = Array.isArray(value.backups) ? value.backups : []; setBackups(found); setSelectedBackup(found[0]?.id || ''); }
    } catch { setIssues(['Restore failed. Check the local server connection.']); }
    finally { setBusy(false); }
  }
  function renderField(item: FormItem | ResumeChapter | SiteContent['resume'], field: Field, onChange: (key: string, value: unknown) => void) {
    const value = (item as unknown as Record<string, unknown>)[field.key];
    const id = fieldId(tab, 'id' in item ? item.id : 'resume', field.key);
    const raw = fieldValue(value, field.type);
    return <div className={`m-editor-field ${field.type === 'checkbox' ? 'm-editor-field--check' : ''}`} key={field.key}>
      <label htmlFor={id}>{field.label}</label>
      {field.type === 'checkbox' ? <input id={id} type="checkbox" checked={Boolean(value)} onChange={event => onChange(field.key, event.target.checked)} />
      : field.type === 'lines' && tab === 'resume' ? <BufferedResumeLines id={id} value={value} onChange={lines => onChange(field.key, lines)} />
      : field.type === 'textarea' || field.type === 'lines' ? <textarea id={id} rows={field.type === 'textarea' ? 4 : 3} value={raw} onChange={event => onChange(field.key, parseField(event.target.value, field.type))} />
      : field.type === 'select' ? <select id={id} value={raw} onChange={event => onChange(field.key, event.target.value)}>{field.options?.map(option => <option value={option} key={option}>{option || '— Select —'}</option>)}</select>
      : <input id={id} type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'} value={raw} onChange={event => onChange(field.key, parseField(event.target.value, field.type))} />}
      {field.hint && <small>{field.hint}</small>}
    </div>;
  }
  if (!session) return <main className="m-editor"><p role="status">Checking owner access…</p></main>;
  if (!session.authenticated) return <main className="m-editor m-editor-login"><p className="m-eyebrow">Mendez OS / Private</p><h1>Owner editor</h1>{session.authMode==='operator'?<OwnerSignIn configured={Boolean(session.configured)} onSession={setSession}/> :<><p>Sign in using your privately configured local owner credential.</p><form onSubmit={login}><label htmlFor="m-editor-password">Owner password</label><input id="m-editor-password" type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password" required/><button disabled={busy}>Sign in</button></form></>}{issues.length>0&&<div role="alert">{issues.join(' ')}</div>}</main>;
  if (!data) return <main className="m-editor"><p role="status">Loading editorial collections…</p>{message && <p role="alert">{message}</p>}</main>;
  const publishIssues = tab === 'stories' && current ? validateStoryForPublish(current as Story) : tab === 'photos' && current ? validatePhotoForPublish(current as PhotoRecord) : [];
  return <main className="m-editor">
    <header className="m-editor-header"><div><p className="m-eyebrow">Mendez OS / Private workspace</p><h1>Content editor</h1><p>Drafts stay private. Publication requires a cleared disclosure status and complete source-backed fields.</p></div><button type="button" onClick={() => void logout()}>Sign out</button></header>
    <nav className="m-editor-tabs" aria-label="Content collections">{tabs.map(item => <button type="button" key={item.id} aria-current={pane === 'content' && tab === item.id ? 'page' : undefined} onClick={() => { setPane('content'); setTab(item.id); setSelected(''); setIssues([]); setMessage(''); }}>{item.label}{dirty.has(item.id) ? ' •' : ''}</button>)}<button type="button" aria-current={pane === 'board' ? 'page' : undefined} onClick={() => setPane('board')}>Board reports</button><button type="button" aria-current={pane==='analytics'?'page':undefined} onClick={()=>setPane('analytics')}>Actual analytics</button><button type="button" aria-current={pane==='requests'?'page':undefined} onClick={()=>setPane('requests')}>Resume requests</button></nav>
    {pane === 'board' ? <BoardModeration /> : pane==='analytics'?<OwnerAnalytics/>:pane==='requests'?<ResumeRequests csrfToken={session.csrfToken||''}/>:<div className={`m-editor-layout ${tab === 'resume' ? 'm-editor-layout--wide' : ''}`}>
      {tab !== 'resume' && <aside className="m-editor-list"><div className="m-editor-list-head"><h2>{tabs.find(item => item.id === tab)?.label}</h2><button type="button" onClick={makeItem}>+ New draft</button></div>{tab === 'about' && <div className="m-editor-section-switch">{(['journey','principles','competencies'] as AboutSection[]).map(section => <button type="button" key={section} aria-pressed={section === aboutSection} onClick={() => { setAboutSection(section); setSelected(''); }}>{section}</button>)}</div>}<ul>{items.map(item => <li key={item.id}><button type="button" className={current?.id === item.id ? 'is-selected' : ''} onClick={() => setSelected(item.id)}>{'organization' in item ? item.organization || 'Untitled' : 'title' in item ? item.title || 'Untitled' : 'label' in item ? item.label || 'Untitled' : 'Untitled'}<small>{'status' in item ? item.status : 'entry'}</small></button></li>)}</ul></aside>}
      <section className="m-editor-detail">
        {tab === 'resume' && <div className="m-editor-form"><h2>On-site resume</h2><p>The public page uses this dedicated resume only. Detailed documents and access requests are managed separately under Resume requests.</p><div className="m-editor-fields">{resumeFields.map(field => renderField(data.resume, field, updateResume))}</div><h3>Chapters</h3>{data.resume.chapters.map(chapter => <div className="m-editor-fields" key={chapter.id}>{renderField(chapter, { key: 'dates', label: 'Chapter dates' }, (key, value) => updateResumeChapter(chapter.id, key, value))}{renderField(chapter, { key: 'title', label: 'Chapter title' }, (key, value) => updateResumeChapter(chapter.id, key, value))}{renderField(chapter, { key: 'displayOrder', label: 'Chapter order', type: 'number' }, (key, value) => updateResumeChapter(chapter.id, key, value))}</div>)}<h3>Timeline entries</h3><div className="m-editor-entry-picker"><select aria-label="Resume entry" value={current?.id || ''} onChange={event => setSelected(event.target.value)}>{items.map(item => <option key={item.id} value={item.id}>{'organization' in item ? item.organization : item.id}</option>)}</select><button type="button" onClick={makeItem}>+ New entry</button></div></div>}
        {current ? <div className="m-editor-form"><div className="m-editor-item-head"><div><h2>{'organization' in current ? current.organization || 'Untitled entry' : 'title' in current ? current.title || 'Untitled draft' : 'label' in current ? current.label || 'Untitled draft' : 'Draft'}</h2><p>ID: <code>{current.id}</code></p></div><div className="m-editor-item-actions"><button type="button" onClick={() => move(-1)} disabled={items[0]?.id === current.id}>Move up</button><button type="button" onClick={() => move(1)} disabled={items.at(-1)?.id === current.id}>Move down</button>{'status' in current && <button type="button" onClick={() => updateItem('status', 'hidden')}>Hide</button>}</div></div>
          {tab === 'photos' && <div className="m-editor-upload">{(current as PhotoRecord).src && <img src={(current as PhotoRecord).src} alt={(current as PhotoRecord).alt || 'Draft photo preview'} />}<label htmlFor="m-editor-file">Upload or replace image</label><input id="m-editor-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} /><small>Private until Published + Cleared. Review creator rights and privacy first.</small></div>}
          <div className="m-editor-fields">{fields.map(field => renderField(current, field, updateItem))}</div>{tab==='stories'&&'kind'in current&&current.kind==='side-project'&&<fieldset><legend>Source-backed decisions and tradeoffs</legend>{(current.decisionTradeoffs||[]).map((decision,index)=><div key={index}><label>Decision {index+1}<textarea value={decision.choice} onChange={event=>updateItem('decisionTradeoffs',(current.decisionTradeoffs||[]).map((item,i)=>i===index?{...item,choice:event.target.value}:item))}/></label><label>Tradeoff<textarea value={decision.tradeoff} onChange={event=>updateItem('decisionTradeoffs',(current.decisionTradeoffs||[]).map((item,i)=>i===index?{...item,tradeoff:event.target.value}:item))}/></label><button type="button" onClick={()=>updateItem('decisionTradeoffs',(current.decisionTradeoffs||[]).filter((_,i)=>i!==index))}>Remove decision {index+1}</button></div>)}<button type="button" onClick={()=>updateItem('decisionTradeoffs',[...(current.decisionTradeoffs||[]),{choice:'',tradeoff:''}])}>Add decision</button></fieldset>}{tab==='stories'&&'overview'in current&&current.overview&&<fieldset><legend>Authored overview</legend>{(['introduction','challenge','contribution','impact','tradeoff'] as const).map(key=><label key={key}>{key}<textarea rows={4} value={current.overview![key]} onChange={e=>updateItem('overview',{...current.overview,[key]:e.target.value})}/></label>)}{(['src','alt','caption']as const).map(key=><label key={key}>Artifact {key}<input value={current.overview!.artifact[key]} onChange={e=>updateItem('overview',{...current.overview,artifact:{...current.overview!.artifact,[key]:e.target.value}})}/></label>)}{current.overview.highlights.map((h,i)=><div key={i}><label>Highlight {i+1}<input value={h.title} onChange={e=>updateItem('overview',{...current.overview,highlights:current.overview!.highlights.map((x,n)=>n===i?{...x,title:e.target.value}:x)})}/></label><label>Supporting line<textarea value={h.body} onChange={e=>updateItem('overview',{...current.overview,highlights:current.overview!.highlights.map((x,n)=>n===i?{...x,body:e.target.value}:x)})}/></label></div>)}</fieldset>}
          {publishIssues.length > 0 && 'status' in current && current.status !== 'published' && <details className="m-editor-checklist"><summary>Publication requirements ({publishIssues.length} remaining)</summary><ul>{publishIssues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>}
        </div> : tab !== 'resume' && <div className="m-editor-empty">No entries in this collection. Choose New draft to add one.</div>}
        <div className="m-editor-save"><button type="button" onClick={() => void save()} disabled={busy || !dirty.has(tab)}>{busy ? 'Working…' : dirty.has(tab) ? 'Save changes' : 'Saved'}</button><a href={`${previewPath(tab, current)}?preview=1`} target="_blank" rel="noopener noreferrer" aria-disabled={dirty.has(tab)} onClick={event => { if (dirty.has(tab)) event.preventDefault(); }}>Open private preview ↗</a>{dirty.has(tab) && <span>Save before previewing.</span>}</div>
        <details className="m-editor-history"><summary>Saved versions and rollback</summary><p>Restoring replaces this collection with a prior saved version. The current saved version is backed up first.</p>{backups.length ? <div><label htmlFor="m-editor-backup">Saved version</label><select id="m-editor-backup" value={selectedBackup} onChange={event => setSelectedBackup(event.target.value)}>{backups.map(backup => <option value={backup.id} key={backup.id}>{new Date(backup.savedAt).toLocaleString()} · {backup.id}</option>)}</select><button type="button" onClick={() => void restoreBackup()} disabled={busy || !selectedBackup}>Restore selected version</button></div> : <p>No saved versions yet. A backup is created before each save.</p>}</details>
        {issues.length > 0 && <div className="m-editor-issues" role="alert"><strong>Save needs attention</strong><ul>{issues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}</ul></div>}
        {message && <p className="m-editor-message" role="status">{message}</p>}
      </section>
    </div>}
  </main>;
}
