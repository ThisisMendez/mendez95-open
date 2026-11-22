import { useCallback, useEffect, useRef, useState } from 'react';
export function useRoundClock() {
  const active = useRef(false);
  const origin = useRef<number | null>(null);
  const [visible,setVisible]=useState(true);
  const [running, setRunning] = useState(false);
  const [durationMs, setDuration] = useState(0);
  const start = useCallback(() => { if (origin.current === null) { origin.current = performance.now(); active.current = true; setRunning(true); } }, []);
  const stop = useCallback(() => { active.current = false; const value = Math.max(1, Math.round(performance.now() - (origin.current ?? performance.now()))); setDuration(value); setRunning(false); return value; }, []);
  const reset = useCallback(() => { origin.current = null; active.current = false; setRunning(false); setDuration(0); }, []);
  useEffect(() => {
    if (!running || !visible) return;
    // Keep the original wall-clock origin; only hidden rendering work stops.
    if(active.current)setDuration(Math.round(performance.now()-(origin.current??performance.now())));
    const timer = setInterval(() => { if (active.current) setDuration(Math.round(performance.now() - (origin.current ?? performance.now()))); }, 200);
    return () => clearInterval(timer);
  }, [running,visible]);
  return { durationMs, start, stop, reset, setVisible };
}
