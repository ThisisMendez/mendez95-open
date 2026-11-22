import type { ReactNode } from 'react';

/** Original line symbols for the Mendez OS launcher. The label belongs to the
 * parent control, so each glyph is decorative. */
export function AppIcon({ name, size = 32 }: { name: string; size?: number }) {
  const art: Record<string, ReactNode> = {
    home: <><path d="M2 11h3V8h3V5h3V2h2v3h3v3h3v3h3M5 11v11h14V11M9 22v-8h6v8"/></>,
    programs: <><rect x="3" y="3" width="8" height="8"/><rect x="14" y="3" width="7" height="6"/><path d="M5 15h6v6H5zM15 13h6v8h-6zM11 7h3M8 11v4M18 9v4"/></>,
    find: <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6M10 7v6"/></>,
    help: <><path d="M6 7a6 6 0 0 1 12 0c0 4-6 3-6 8M12 19v1"/><path d="M3 3h18v19H3z"/></>,
    run: <><rect x="2" y="4" width="20" height="16" rx="1"/><path d="m6 9 4 3-4 3M12 16h6"/></>,
    shutdown: <><path d="M12 2v10M6 5a9 9 0 1 0 12 0"/></>,
    restart: <><path d="M19 7a8 8 0 1 0 1 9M20 2v6h-6"/></>,
    documents: <><path d="M3 7h7l2 3h9v11H3zM6 7V2h11v8M9 5h5"/></>,

    work: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2M3 12h18M10 12v3h4v-3" /></>,
    about: <><circle cx="12" cy="8" r="3" /><path d="M5 21v-2a7 7 0 0 1 14 0v2H5Z" /><path d="M3 4h2M19 4h2M3 12h2M19 12h2" /></>,
    resume: <><path d="M6 3h9l3 3v15H6zM15 3v4h4M9 11h6M9 15h6M9 19h4" /></>,
    contact: <><path d="M3 7.5 12 13l9-5.5M4 7h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" /><path d="m3 18 6-5m12 5-6-5" /></>,
    'field-notes': <><path d="M6 3h12v18H6zM9 3v18M12 8h4M12 12h4M12 16h3" /><path d="M4 7h2M4 12h2M4 17h2" /></>,
    'ai-lab': <><circle cx="12" cy="12" r="2.5" /><circle cx="4" cy="6" r="1.5" /><circle cx="20" cy="6" r="1.5" /><circle cx="5" cy="19" r="1.5" /><circle cx="19" cy="19" r="1.5" /><path d="M6 7l4 3M18 7l-4 3M6 18l4-4M18 18l-4-4" /></>,
    'side-projects': <><path d="M5 5h7v6H5zM12 8h5a3 3 0 0 1 3 3v3M8.5 11v3a3 3 0 0 0 3 3H15" /><path d="M15 14h6v6h-6z" /></>,
    paint: <><path d="m15 3 6 6-10 10-7 1 1-7zM13 5l6 6M5 13l6 6M3 22h18"/><circle cx="5" cy="5" r="2"/></>,
    solitaire: <><rect x="3" y="5" width="12" height="17" rx="1"/><path d="m9 15 3-4 3 4-3 4zM8 2h13v17h-3"/></>,
    minesweeper: <><rect x="2" y="2" width="20" height="20"/><path d="M9 2v20M16 2v20M2 9h20M2 16h20M5 13v7M5 13h3l-3 3"/><circle cx="12.5" cy="5.5" r="1"/></>,
    photos: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="9" r="1.5" /><path d="m4 17 5-4 3 2 4-5 5 6M7 22h10" /></>,
    guide: <><circle cx="12" cy="12" r="9" /><path d="m9 15 2-6 4-2-2 6-4 2ZM12 3v2M12 19v2M3 12h2M19 12h2" /></>,
    games: <><path d="M7 8h10c2 0 3 1 4 4l1 5c.4 2-1.7 3-3 2l-3-2H8l-3 2c-1.3 1-3.4 0-3-2l1-5c1-3 2-4 4-4Z" /><path d="M7 11v5M4.5 13.5h5M16 12h.01M19 14h.01" /></>,
    board: <><path d="M3 4h18v16H3zM7 7h5v5H7zM15 8h3M15 11h3M7 16h11" /><path d="M6 20v2M18 20v2" /></>,
    settings: <><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="var(--os-surface)" /><circle cx="16" cy="12" r="2" fill="var(--os-surface)" /><circle cx="11" cy="17" r="2" fill="var(--os-surface)" /></>,
  };
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {art[name] ?? <><path d="M4 4h16v16H4zM8 8h8v8H8z" /></>}
    </svg>
  );
}
