import {usePocketMode} from '../../pocket/layout';
import { useEffect, useRef, useState } from 'react';
import './guide.css';
import { boundedContext } from './context';

type Reply = { answer: string; citations: { title: string; url: string }[]; mode: 'local' | 'model-assisted'; refused: boolean };
type Exchange = { id: number; question: string; reply: Reply };
const PROMPTS = ['Who is Jordan?', 'Tell me a joke.', 'What can you do?', 'Are you an AI?'];
const HISTORY_KEY = 'mendez-os-jarvis-session';
function initialHistory(): Exchange[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is Exchange => typeof item?.question === 'string' && typeof item?.reply?.answer === 'string' && Array.isArray(item?.reply?.citations)).slice(-20) : [];
  } catch { return []; }
}

export default function GuideApp({ navigate }: { navigate?: (path: string) => void }) {
  const pocket=usePocketMode(), guideName=pocket?'PIP':'SNIP-E';
  const [question, setQuestion] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>(PROMPTS);
  const [exchanges, setExchanges] = useState<Exchange[]>(initialHistory);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState('');
  const scroll = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const pendingQuestion = useRef('');
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const composing = useRef(false);
  const followBottom = useRef(true);
  useEffect(() => () => { generation.current++; request.current?.abort(); }, []);
  useEffect(() => { generation.current++; if (request.current) setQuestion(draft => draft || pendingQuestion.current); request.current?.abort(); request.current = null; setWaiting(false); }, [pocket]);
  useEffect(() => {
    const cancel = () => {
      if (!request.current) return;
      generation.current++; request.current.abort(); request.current = null;
      setQuestion(draft => draft || pendingQuestion.current); setWaiting(false); setError('Message paused. Send again when you’re ready.');
    };
    const surface = root.current?.closest('.os-window');
    const observe = new MutationObserver(() => { if (surface?.hasAttribute('hidden') || surface?.getAttribute('data-active') === 'false') cancel(); });
    if (surface) observe.observe(surface, { attributes:true, attributeFilter:['hidden','data-active'] });
    const route = (event: Event) => { const detail = (event as CustomEvent).detail; if (detail?.path && detail.path !== '/guide') cancel(); };
    window.addEventListener('mendez-active-route', route);
    return () => { observe.disconnect(); window.removeEventListener('mendez-active-route', route); };
  }, []);
  function reset() { pendingQuestion.current = ''; followBottom.current = true; generation.current++; request.current?.abort(); request.current = null; setExchanges([]); setQuestion(''); setError(''); setWaiting(false); setSuggestions(PROMPTS); try { sessionStorage.removeItem(HISTORY_KEY); } catch { /* Session storage unavailable. */ } }
  useEffect(() => { fetch('/api/guide/suggestions').then(response => response.json()).then(data => setSuggestions(Array.isArray(data.suggestions) && data.suggestions.length ? data.suggestions : PROMPTS)).catch(() => setSuggestions(PROMPTS)); }, []);
  useEffect(() => { try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(exchanges.slice(-20))); } catch { /* session storage unavailable */ } }, [exchanges]);
  useEffect(() => {
    const reduced = document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!followBottom.current) return;
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
  }, [exchanges]);
  async function ask(value: string) {
    const asked = value.trim(); if (!asked || waiting || request.current || composing.current) return;
    followBottom.current = true;
    pendingQuestion.current = asked;
    setWaiting(true); setError(''); setQuestion('');
    const current = generation.current, controller = new AbortController(); request.current = controller;
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('/api/guide', { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: asked, persona: pocket ? 'pip' : 'snip-e', context: boundedContext(exchanges.slice(-2).flatMap(exchange => [{role:'user' as const,content:exchange.question},{role:'assistant' as const,content:exchange.reply.answer}])) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Guide could not answer.');
      if (current !== generation.current) return;
      const next = [...exchanges, { id: Date.now() + Math.random(), question: asked, reply: data }];
      try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(-20))); } catch { /* session storage unavailable */ }
      setExchanges(next);
    } catch (cause) { if (current !== generation.current) return; setQuestion(draft => draft || asked); setError(controller.signal.aborted ? 'That took too long. Your message is saved; try Send again.' : cause instanceof Error ? cause.message : 'Guide could not answer.'); }
    finally { clearTimeout(timer); if (current === generation.current) { setWaiting(false); request.current = null; } }
  }
  const open = (event: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    if (navigate && url.startsWith('/')) { event.preventDefault(); navigate(url); }
  };
  const mood = waiting ? 'thinking' : exchanges.at(-1)?.reply.refused ? 'curious' : exchanges.length ? 'happy' : 'idle';
  return <section ref={root} className={`m-guide${pocket ? ' m-guide--pip' : ''}`} aria-label={`${guideName} portfolio guide`}>
    <header className="m-guide-head"><span className={`m-guide-mark m-guide-mark--${mood}`} aria-hidden="true"><img src={pocket?"/brand/pocket/pip-v2.svg":"/brand/pocket/companion-example.svg"} alt=""/></span><div><p className="m-eyebrow">Mendez 95 / Portfolio guide</p><h2>{guideName} <small>{waiting ? 'Thinking…' : pocket ? 'A little company. A lot of curiosity.' : 'Quick wit. Useful answers.'}</small></h2><p>{pocket?'Your pocket companion':'A career wingman with public sources.'}</p></div><button className="m-guide-reset" type="button" onClick={reset}>Reset Conversation</button></header>
    <div className="m-guide-dialog" ref={scroll} onScroll={() => { const el = scroll.current; if (el) followBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }} role="log" aria-live="polite" aria-label="Guide conversation">
      <div className="m-guide-welcome"><strong>HELLO. I'M {guideName}. SMALL ASSISTANT. VERY PRO-JORDAN. ASK ME ABOUT HIS WORK, OR THROW ME A CURVEBALL.</strong></div>
      {exchanges.map(exchange => <div className="m-guide-exchange" key={exchange.id}><p className="m-guide-question"><span>You</span>{exchange.question}</p><div className="m-guide-answer"><span>{guideName}</span><p>{exchange.reply.answer}</p>{exchange.reply.citations.length > 0 && <ul aria-label="Answer sources">{exchange.reply.citations.map(citation => <li key={citation.url}><a href={citation.url} onClick={event => open(event, citation.url)} target={citation.url.startsWith('https://') ? '_blank' : undefined} rel={citation.url.startsWith('https://') ? 'noopener noreferrer' : undefined}>{citation.title} ↗</a></li>)}</ul>}{exchange.reply.refused && <small>Try asking about public work or a destination.</small>}</div></div>)}
      {waiting && <p role="status" aria-label={`${guideName} is thinking`} className="m-guide-thinking"><span className="guide-ellipsis" aria-hidden="true"><i/><i/><i/></span></p>}
    </div>
    <div className="m-guide-suggestions" aria-label="Suggested questions">{suggestions.map(suggestion => <button type="button" key={suggestion} disabled={waiting} onClick={() => void ask(suggestion)}>{suggestion}</button>)}</div>
    <form className="m-guide-form" onSubmit={event => { event.preventDefault(); if (!composing.current) void ask(question); }}><label htmlFor="jarvis-question">Say something</label><div><input id="jarvis-question" value={question} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || composing.current || event.keyCode === 229)) event.preventDefault(); }} onChange={event => setQuestion(event.target.value)} maxLength={300} placeholder="Ask about the portfolio, or say hello…" /><button type="submit" disabled={waiting || !question.trim()}>Send</button></div></form>
    {error && <p role="alert" className="m-guide-error">{error}</p>}
    <p className="m-guide-footnote">Chat stays in this browser session. {guideName} uses public portfolio pages for work answers.</p>
  </section>;
}
