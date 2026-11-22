import { MINE_DIFFICULTIES, type MineDifficulty } from './scoring';
export type MineCell = { mine: boolean; adjacent: number; revealed: boolean; flagged: boolean };
export type MineState = { difficulty: MineDifficulty; rows: number; cols: number; mines: number; cells: MineCell[]; status: 'ready' | 'playing' | 'won' | 'lost'; exploded: number | null };
export function newMines(difficulty: MineDifficulty): MineState {
  const config = MINE_DIFFICULTIES[difficulty];
  return { ...config, difficulty, cells: Array.from({ length: config.rows * config.cols }, () => ({ mine: false, adjacent: 0, revealed: false, flagged: false })), status: 'ready', exploded: null };
}
export function neighbors(state: Pick<MineState, 'rows' | 'cols'>, index: number): number[] {
  const row = Math.floor(index / state.cols), col = index % state.cols, result: number[] = [];
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
    if ((!x && !y) || row + y < 0 || row + y >= state.rows || col + x < 0 || col + x >= state.cols) continue;
    result.push((row + y) * state.cols + col + x);
  }
  return result;
}
function armed(state: MineState, first: number, random: () => number): MineState {
  const safe = new Set([first, ...neighbors(state, first)]);
  const available = state.cells.map((_, i) => i).filter(i => !safe.has(i));
  for (let i = available.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [available[i], available[j]] = [available[j]!, available[i]!]; }
  const mines = new Set(available.slice(0, state.mines));
  const cells = state.cells.map((cell, i) => ({ ...cell, mine: mines.has(i), adjacent: neighbors(state, i).filter(n => mines.has(n)).length }));
  return { ...state, cells, status: 'playing' };
}
function revealMany(state: MineState, indices: number[]): MineState {
  const next: MineState = { ...state, cells: state.cells.map(cell => ({ ...cell })) };
  const queue = [...indices], visited = new Set<number>();
  while (queue.length) {
    const index = queue.pop()!;
    if (visited.has(index)) continue;
    visited.add(index);
    const cell = next.cells[index];
    if (!cell || cell.flagged || cell.revealed) continue;
    cell.revealed = true;
    if (cell.mine) { next.status = 'lost'; next.exploded = index; break; }
    if (cell.adjacent === 0) queue.push(...neighbors(next, index));
  }
  if (next.status !== 'lost' && next.cells.every(cell => cell.mine || cell.revealed)) {
    next.status = 'won'; next.cells.forEach(cell => { if (cell.mine) cell.flagged = true; });
  }
  return next;
}
export function revealCell(state: MineState, index: number, random = Math.random): MineState {
  if (state.status === 'won' || state.status === 'lost' || !state.cells[index] || state.cells[index]!.revealed || state.cells[index]!.flagged) return state;
  return revealMany(state.status === 'ready' ? armed(state, index, random) : state, [index]);
}
export function toggleFlag(state: MineState, index: number): MineState {
  if (state.status === 'won' || state.status === 'lost' || !state.cells[index] || state.cells[index]!.revealed) return state;
  return { ...state, cells: state.cells.map((cell, i) => i === index ? { ...cell, flagged: !cell.flagged } : cell) };
}
export function chordCell(state: MineState, index: number): MineState {
  const cell = state.cells[index];
  if (state.status !== 'playing' || !cell?.revealed || !cell.adjacent) return state;
  const around = neighbors(state, index);
  if (around.filter(i => state.cells[i]!.flagged).length !== cell.adjacent) return state;
  return revealMany(state, around);
}
