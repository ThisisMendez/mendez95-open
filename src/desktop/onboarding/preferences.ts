export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

const WELCOME_KEY = 'mendez-95-show-welcome';
const TOUR_KEY = 'mendez-95-tour';

export const WELCOME_TIPS = [
  "Want to know how I work? Open Digital Health Platform in Portfolio. Read the overview, then go deeper into the full case study.",
  "There’s more behind Start. Open Documents for my work and background, or Programs for apps and games.",
  "Start → Documents → Resume connects the experience behind the projects. You can request the full resume there, too.",
  "I built Mendez 95 around two eras: Windows 95 for desktop and Game Boy Color for mobile. Take a look from both."
] as const;

export function nextTipIndex(index: number, availableCount: number = WELCOME_TIPS.length): number {
  const count = Math.max(1, Math.min(WELCOME_TIPS.length, Math.trunc(availableCount) || 1));
  const current = Number.isFinite(index) ? Math.trunc(index) : -1;
  return ((current + 1) % count + count) % count;
}

function resolveStorage(storage?: PreferenceStorage | null): PreferenceStorage | null {
  if (storage !== undefined) return storage;
  try { return globalThis.localStorage; } catch { return null; }
}

export function readWelcomePreference(storage?: PreferenceStorage | null): boolean {
  try {
    const value = resolveStorage(storage)?.getItem(WELCOME_KEY);
    return value === null || value === undefined ? true : value !== '0' && value !== 'false';
  } catch { return true; }
}

export function writeWelcomePreference(show: boolean, storage?: PreferenceStorage | null): void {
  try { resolveStorage(storage)?.setItem(WELCOME_KEY, show ? '1' : '0'); } catch { /* Storage may be unavailable. */ }
}

export type TourProgress = { version: 1; completed: boolean; resumeStep: number | null };

const EMPTY_PROGRESS: TourProgress = { version: 1, completed: false, resumeStep: null };

function isTourProgress(value: unknown): value is TourProgress {
  if (!value || typeof value !== 'object') return false;
  const progress = value as Record<string, unknown>;
  if (progress.version !== 1 || typeof progress.completed !== 'boolean') return false;
  if (progress.completed) return progress.resumeStep === null;
  return progress.resumeStep === null || (Number.isInteger(progress.resumeStep) && (progress.resumeStep as number) >= 0 && (progress.resumeStep as number) <= 4);
}

function normalizeTourProgress(progress: TourProgress): TourProgress {
  return { version: 1, completed: progress.completed, resumeStep: progress.completed ? null : progress.resumeStep };
}

export function readTourProgress(storage?: PreferenceStorage | null): TourProgress {
  try {
    const raw = resolveStorage(storage)?.getItem(TOUR_KEY);
    if (raw == null) return { ...EMPTY_PROGRESS };
    const parsed: unknown = JSON.parse(raw);
    return isTourProgress(parsed) ? normalizeTourProgress(parsed) : { ...EMPTY_PROGRESS };
  } catch { return { ...EMPTY_PROGRESS }; }
}

export function writeTourProgress(progress: TourProgress, storage?: PreferenceStorage | null): void {
  try {
    const value = isTourProgress(progress) ? normalizeTourProgress(progress) : EMPTY_PROGRESS;
    resolveStorage(storage)?.setItem(TOUR_KEY, JSON.stringify(value));
  } catch { /* Storage may be unavailable. */ }
}
