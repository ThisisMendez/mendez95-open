export type MineDifficulty = 'beginner' | 'intermediate' | 'expert';
export const MINE_DIFFICULTIES = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
} as const;
export function isMineDifficulty(value: unknown): value is MineDifficulty {
  return value === 'beginner' || value === 'intermediate' || value === 'expert';
}
export const elapsedSeconds = (durationMs: number) => Math.max(1, Math.ceil(durationMs / 1000));
export const solitaireWinScore = (durationMs: number) => 520 + Math.max(0, 1800 - elapsedSeconds(durationMs));
