import { useCallback, useEffect, useState } from 'react';
import './board.css';

type Note = { id: string; name: string; text: string; reports: number; createdAt: string };
type Owner = { authenticated: boolean; csrfToken?: string };

/** Private owner pane; render from the owner editor, never the visitor board. */
export default function BoardModeration() {
  const [owner, setOwner] = useState<Owner>({ authenticated: false });
  const [notes, setNotes] = useState<Note[]>([]);
  const [status, setStatus] = useState('');
  const refresh = useCallback(async () => {
    try {
      const sessionResponse = await fetch('/api/owner/session', { cache: 'no-store' });
      const session: Owner = await sessionResponse.json();
      setOwner(session);
      if (!session.authenticated) { setNotes([]); return; }
      const response = await fetch('/api/board/moderation', { cache: 'no-store' });
      if (!response.ok) throw new Error('Board moderation is unavailable.');
      setNotes((await response.json()).notes || []);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Board moderation is unavailable.'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function remove(note: Note) {
    if (!owner.csrfToken || !window.confirm(`Remove the note by ${note.name}? This takes it off the public board.`)) return;
    try {
      const response = await fetch(`/api/board/moderation/${encodeURIComponent(note.id)}`, { method: 'DELETE', headers: { 'x-mendez-csrf': owner.csrfToken } });
      if (!response.ok) throw new Error((await response.json()).error || 'Could not remove note.');
      setStatus('Note removed.'); await refresh();
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not remove note.'); }
  }
  return <section className="m-board-moderation" aria-label="Board moderation"><div><h2>Board reports and removal</h2><button type="button" onClick={() => void refresh()}>Refresh</button></div>{!owner.authenticated ? <p>Sign in as owner in the editor to manage public notes.</p> : notes.length ? <ul>{notes.sort((a, b) => b.reports - a.reports).map(note => <li key={note.id}><p><strong>{note.name}</strong> · {new Date(note.createdAt).toLocaleString()} · {note.reports} {note.reports === 1 ? 'report' : 'reports'}</p><blockquote>{note.text}</blockquote><button type="button" onClick={() => void remove(note)}>Remove from public board</button></li>)}</ul> : <p>No public notes.</p>}{status && <p role="status">{status}</p>}</section>;
}
