import { describe, expect, it } from 'vitest';
import { nextTipIndex, readTourProgress, readWelcomePreference, WELCOME_TIPS, writeTourProgress, writeWelcomePreference, type PreferenceStorage } from './preferences';

function memoryStorage(seed: Record<string, string> = {}): PreferenceStorage {
  const values = new Map(Object.entries(seed));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('onboarding preferences', () => {
  it('preserves exact approved tips and stages the mobile claim until ready', () => {
    expect(WELCOME_TIPS).toEqual([
  "Want to know how I work? Open Digital Health Platform in Portfolio. Read the overview, then go deeper into the full case study.",
  "There’s more behind Start. Open Documents for my work and background, or Programs for apps and games.",
  "Start → Documents → Resume connects the experience behind the projects. You can request the full resume there, too.",
  "I built Mendez 95 around two eras: Windows 95 for desktop and Game Boy Color for mobile. Take a look from both."
]);
    expect([0,1,2,3].map(i=>nextTipIndex(i))).toEqual([1,2,3,0]);
    expect([0,1,2].map(i=>nextTipIndex(i,3))).toEqual([1,2,0]);
  });

  it('defaults welcome to shown and persists both preference values', () => {
    const storage = memoryStorage();
    expect(readWelcomePreference(storage)).toBe(true);
    writeWelcomePreference(false, storage);
    expect(readWelcomePreference(storage)).toBe(false);
    writeWelcomePreference(true, storage);
    expect(readWelcomePreference(storage)).toBe(true);
    expect(readWelcomePreference(null)).toBe(true);
  });

  it('round trips tour progress and rejects malformed or unsupported data', () => {
    const storage = memoryStorage();
    const progress = { version: 1 as const, completed: false, resumeStep: 3 };
    writeTourProgress(progress, storage);
    expect(readTourProgress(storage)).toEqual(progress);
    const completed = { version: 1 as const, completed: true, resumeStep: null };
    writeTourProgress(completed, storage);
    expect(readTourProgress(storage)).toEqual(completed);
    for (const invalid of ['{', '{"version":2,"completed":false,"resumeStep":2}', '{"version":1,"completed":false,"resumeStep":5}', '{"version":1,"completed":true,"resumeStep":0}']) {
      expect(readTourProgress(memoryStorage({ 'mendez-95-tour': invalid }))).toEqual({ version: 1, completed: false, resumeStep: null });
    }
  });

  it('drops unknown fields at both persistence boundaries', () => {
    const storage = memoryStorage({ 'mendez-95-tour': '{"version":1,"completed":false,"resumeStep":2,"future":"ignored"}' });
    expect(readTourProgress(storage)).toEqual({ version: 1, completed: false, resumeStep: 2 });
    const extraField = { version: 1 as const, completed: false, resumeStep: 1, future: 'ignored' };
    writeTourProgress(extraField, storage);
    expect(storage.getItem('mendez-95-tour')).toBe('{"version":1,"completed":false,"resumeStep":1}');
  });

  it('fails gracefully when storage methods throw', () => {
    const throwing: PreferenceStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readWelcomePreference(throwing)).toBe(true);
    expect(readTourProgress(throwing)).toEqual({ version: 1, completed: false, resumeStep: null });
    expect(() => writeWelcomePreference(false, throwing)).not.toThrow();
    expect(() => writeTourProgress({ version: 1, completed: false, resumeStep: 1 }, throwing)).not.toThrow();
    expect(readTourProgress(null)).toEqual({ version: 1, completed: false, resumeStep: null });
  });
});
