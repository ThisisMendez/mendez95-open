import {usePocketMode} from '../../pocket/layout';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ResumeContent, SiteContentView } from '../../content/types';
import './communication.css';

const cleared = (entry: { status: string; disclosureStatus: string }) => entry.status === 'published' && entry.disclosureStatus === 'cleared';
export function resumeChapters(resume: ResumeContent) {
  const entries = resume.entries.filter(cleared).sort((a, b) => a.displayOrder - b.displayOrder);
  return [...resume.chapters].sort((a, b) => a.displayOrder - b.displayOrder).map(chapter => ({
    ...chapter,
    entries: entries.filter(entry => entry.chapter === chapter.id),
  }));
}
function RequestResume({ close }: { close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [sent, setSent] = useState(false);
  // Removing a dialog from the DOM closes it. Calling close during effect
  // cleanup would fire onClose during React's development effect replay.
  useEffect(() => { const node = dialog.current; if(node&&!node.open)node.showModal(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); const fields = new FormData(event.currentTarget);
    try { const response = await fetch('/api/resume/requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(fields)) }); const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Unable to save your request.'); setSent(true); setMessage(value.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save your request. Please try again.'); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="m-resume-dialog" onCancel={close} onClose={close} aria-labelledby="m-request-heading">
    <div className="m-request-title"><strong id="m-request-heading">Request Professional Resume</strong><button type="button" onClick={close} aria-label="Close resume request">×</button></div>
    <div className="m-request-body"><p>Send a request for my full resume. I’ll review your details and can follow up directly by email with the appropriate document.</p>
      {!sent && <form onSubmit={event => void submit(event)} className="m-request-form"><label>Name<input name="name" autoComplete="name" required maxLength={100} autoFocus /></label><label>Work Email<input name="email" autoComplete="email" type="email" required maxLength={254} /></label><label>Company<input name="company" autoComplete="organization" required maxLength={150} /></label><label>Reason for Request <span>(optional)</span><textarea name="reason" rows={3} maxLength={2000} /></label><label className="m-form-honey" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label><button className="os-button" disabled={busy}>{busy ? 'Submitting…' : 'Send Request'}</button></form>}
      {message && <p role={sent ? 'status' : 'alert'}>{message}</p>}{sent && <button className="os-button" onClick={close}>Close</button>}
    </div>
  </dialog>;
}
export function ResumeApp({ content }: { content: SiteContentView; navigate: (path: string) => void; preview: boolean }) {
  const pocket=usePocketMode();
  useEffect(()=>{const states=new Map<HTMLDetailsElement,boolean>();const before=()=>{document.querySelectorAll<HTMLDetailsElement>('.m-resume details').forEach(d=>{states.set(d,d.open);d.open=true;});};const after=()=>{states.forEach((open,d)=>{d.open=open;});states.clear();};window.addEventListener('beforeprint',before);window.addEventListener('afterprint',after);return()=>{window.removeEventListener('beforeprint',before);window.removeEventListener('afterprint',after);};},[]);
  const [request, setRequest] = useState(false), resume = content.resume && cleared(content.resume) ? content.resume : null;
  if (!resume) return <div className="os-app os-resume m-resume"><header className="m-resume-header"><h1>Resume</h1><p>The public resume is not available.</p></header></div>;
  const chapters = resumeChapters(resume);
  return <div className="os-app os-resume m-resume"><header className="m-resume-header"><h1>{resume.name}</h1><p className="m-resume-introduction">{resume.introduction}</p></header>
    <div className="m-resume-chapters">{(pocket?[...chapters].reverse():chapters).map(chapter=>{const rows=chapter.entries.map(entry=><article className="m-career-row" data-entry={entry.id} data-kind={entry.kind} key={entry.id}><h3>{entry.organization}</h3><div className="m-career-meta"><strong>{entry.title}</strong><span className="m-career-dates">{entry.dates}</span></div>{entry.summary&&<p>{entry.summary}</p>}{entry.additionalLines.map(line=><p className="m-career-additional" key={line}>{line}</p>)}</article>);const order=chapters.findIndex(c=>c.id===chapter.id);return pocket?<details className="m-resume-chapter" key={chapter.id} data-chapter-order={order} open><summary><span className="m-chapter-dates">{chapter.dates}</span> · {chapter.title}</summary>{rows}</details>:<section className="m-resume-chapter" key={chapter.id}><div className="m-chapter-dates">{chapter.dates}</div><h2>{chapter.title}</h2>{rows}</section>;})}</div>
    <footer className="m-resume-footer"><div className="m-resume-credentials">{resume.footerLines.map(line => <p key={line}>{line}</p>)}</div><p className="m-resume-outside">{resume.outsideWork}</p><div className="m-resume-actions"><div><button className="os-button" onClick={() => window.print()}>Print Portfolio Resume</button><small>Public career summary. No approval required.</small></div><div><button className="os-button" onClick={() => setRequest(true)}>Request Full Resume</button><small>Request a copy directly from Jordan.</small></div></div></footer>
    {request && <RequestResume close={() => setRequest(false)} />}
  </div>;
}
