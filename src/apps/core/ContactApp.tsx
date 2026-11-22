import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { SiteContentView } from '../../content/types';
import './communication.css';
import {PocketIcon} from '../../pocket/PocketIcon';
import {usePocketMode} from '../../pocket/layout';

export function ContactApp({ content }: { content: SiteContentView; navigate: (path: string) => void; preview: boolean }) {
  const pocket=usePocketMode(),posting=useRef(false),confirmation=useRef<HTMLDialogElement>(null),sendButton=useRef<HTMLButtonElement>(null);
  const [accepted,setAccepted]=useState(false);
  useEffect(()=>{if(accepted)confirmation.current?.showModal();},[accepted]);
  const closeConfirmation=()=>{confirmation.current?.close();setAccepted(false);requestAnimationFrame(()=>sendButton.current?.focus({preventScroll:true}));};
  const [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [failed, setFailed] = useState(false), [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => { let alive = true; void fetch('/api/contact/status').then(r => r.ok ? r.json() : null).then(value => { if (alive) setAvailable(value?.available ?? null); }).catch(() => undefined); return () => { alive = false; }; }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(posting.current)return; posting.current=true; const form = event.currentTarget, fields = new FormData(form); setBusy(true); setStatus(''); setFailed(false);
    try { const response = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(fields)) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Unable to send. Please try again.'); setStatus(''); setAccepted(true); form.reset(); }
    catch (error) { setFailed(true); setStatus(error instanceof Error ? error.message : 'Unable to send. Please try again.'); }
    finally { posting.current=false; setBusy(false); }
  }
  const links = content.elsewhere.filter(link => link.status === 'published' && link.disclosureStatus === 'cleared' && link.id !== 'email' && link.url?.startsWith('https:'));
  return <div className="os-app m-contact">{pocket&&<div className="m-contact-cartridge"><PocketIcon name="contact" size={36}/><strong>Let’s build something.</strong><span>Send Jordan a message.</span></div>}<p className="m-contact-intro">Get in touch about product opportunities, side projects, and thoughtful collaboration.</p>
    <form className="m-mail-form" onSubmit={event => void submit(event)} aria-label="Email Jordan">
      <div className="m-mail-row"><span>To</span><span className="m-mail-recipient">owner@example.invalid</span></div>
      <label className="m-mail-row"><span>Name</span><input name="name" autoComplete="name" required maxLength={100} aria-label="Name" placeholder="Your name" /></label>
      <label className="m-mail-row"><span>From</span><input name="email" type="email" autoComplete="email" required maxLength={254} aria-label="Your email" placeholder="you@example.com" /></label>
      <label className="m-mail-message"><span>Message</span><textarea name="message" required maxLength={5000} rows={5} aria-label="Message" placeholder="What’s on your mind?" /></label>
      <label className="m-form-honey" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <div className="m-mail-send"><button ref={sendButton} className="os-button" disabled={busy}>{busy ? 'Sending…' : 'Send ↗'}</button><a href="mailto:owner@example.invalid">Open email app</a></div>
    </form>
    {available === false && !status && <p className="m-form-status" role="status">The email form is not connected yet. You can reach me directly using “Open email app”.</p>}
    {status && <p className="m-form-status" role={failed ? 'alert' : 'status'}>{status}</p>}
    {accepted&&<dialog ref={confirmation} className="m-contact-confirmation" aria-labelledby="contact-thanks-title" aria-describedby="contact-thanks-message" onCancel={event=>{event.preventDefault();closeConfirmation();}}><div className="m-contact-confirmation-title"><span>Mendez 95 · Message accepted</span><button type="button" onClick={closeConfirmation} aria-label="Close confirmation">×</button></div><div className="m-contact-confirmation-body"><PocketIcon name="contact" size={48}/><h2 id="contact-thanks-title">Thanks for reaching out!</h2><p id="contact-thanks-message">Your message has been accepted for email delivery. Thank you for getting in touch.</p><button type="button" autoFocus className="os-button" onClick={closeConfirmation}>OK</button></div></dialog>}
    <nav className="m-contact-links" aria-label="Elsewhere">{links.map(link => <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>)}</nav>
  </div>;
}
