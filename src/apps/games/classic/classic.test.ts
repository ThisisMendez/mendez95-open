import { describe, expect, it } from 'vitest';
import { SUITS, drawCard, moveCards, newSolitaire, solitaireWon, type Card, type SolitaireState } from './solitaire';
import { chordCell, neighbors, newMines, revealCell, toggleFlag, type MineState } from './minesweeper';
import { elapsedSeconds, MINE_DIFFICULTIES, solitaireWinScore, type MineDifficulty } from './scoring';
const card = (suit: Card['suit'], rank: number, faceUp = true): Card => ({ suit, rank, faceUp });
const empty = (): SolitaireState => ({ stock: [], waste: [], tableau: Array.from({ length: 7 }, () => []), foundations: Array.from({ length: 4 }, () => []), moves: 0 });
describe('Klondike rules', () => {
  it('deals every card exactly once, seven columns with only each last card up', () => {
    const state = newSolitaire(() => 0.5);
    expect(state.tableau.map(p => p.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(state.stock).toHaveLength(24);
    expect(state.tableau.flat().filter(c => c.faceUp)).toHaveLength(7);
    expect(new Set([...state.stock, ...state.tableau.flat()].map(c => `${c.suit}${c.rank}`)).size).toBe(52);
  });
  it('draws one and recycles in original draw order without mutating undo snapshots', () => {
    const initial = { ...empty(), stock: [card('clubs', 2, false), card('hearts', 1, false)] };
    const one = drawCard(initial)!;
    const two = drawCard(one)!;
    const recycled = drawCard(two)!;
    expect(one.waste).toEqual([card('hearts', 1)]);
    expect(drawCard(recycled)!.waste).toEqual(one.waste);
    expect(recycled.stock.every(c => !c.faceUp)).toBe(true);
    expect(initial.stock).toHaveLength(2);
    expect(initial.waste).toHaveLength(0);
    expect(drawCard(empty())).toBeNull();
  });
  it('moves only descending alternating sequences and reveals the uncovered card', () => {
    const state = empty();
    state.tableau[0] = [card('clubs', 5, false), card('hearts', 12), card('spades', 11)];
    state.tableau[1] = [card('clubs', 13)];
    const moved = moveCards(state, { kind: 'tableau', pile: 0, index: 1 }, { kind: 'tableau', pile: 1 })!;
    expect(moved.tableau[1]!.map(c => c.rank)).toEqual([13, 12, 11]);
    expect(moved.tableau[0]).toEqual([card('clubs', 5)]);
    expect(state.tableau[0]![0]!.faceUp).toBe(false);
    expect(moveCards(state, { kind: 'tableau', pile: 0, index: 0 }, { kind: 'tableau', pile: 1 })).toBeNull();
    state.tableau[0]![2] = card('diamonds', 11);
    expect(moveCards(state, { kind: 'tableau', pile: 0, index: 1 }, { kind: 'tableau', pile: 1 })).toBeNull();
  });
  it('requires kings in empty columns and suited ascending single foundations; permits returning a foundation top', () => {
    const state = empty(); state.waste = [card('clubs', 2)];
    expect(moveCards(state, { kind: 'waste' }, { kind: 'tableau', pile: 0 })).toBeNull();
    expect(moveCards(state, { kind: 'waste' }, { kind: 'foundation', pile: 0 })).toBeNull();
    state.foundations[0] = [card('clubs', 1)];
    expect(moveCards(state, { kind: 'waste' }, { kind: 'foundation', pile: 0 })!.foundations[0]).toHaveLength(2);
    expect(moveCards(state, { kind: 'waste' }, { kind: 'foundation', pile: 1 })).toBeNull();
    state.tableau[1] = [card('hearts', 2)];
    expect(moveCards(state, { kind: 'foundation', pile: 0 }, { kind: 'tableau', pile: 1 })!.tableau[1]).toHaveLength(2);
    state.waste = [card('spades', 13)];
    expect(moveCards(state, { kind: 'waste' }, { kind: 'tableau', pile: 0 })!.tableau[0]).toHaveLength(1);
  });
  it('declares a win only when all 52 cards reach four foundations via legal moves', () => {
    let state = empty();
    state.stock = SUITS.flatMap(suit => Array.from({ length: 13 }, (_, i) => card(suit, i + 1, false))).reverse();
    for (let i = 0; i < 52; i++) {
      expect(solitaireWon(state)).toBe(false);
      state = drawCard(state)!;
      state = moveCards(state, { kind: 'waste' }, { kind: 'foundation', pile: SUITS.indexOf(state.waste[0]!.suit) })!;
    }
    expect(solitaireWon(state)).toBe(true);
    expect(state.moves).toBe(104);
  });
});
describe('Minesweeper rules', () => {
  for (const difficulty of Object.keys(MINE_DIFFICULTIES) as MineDifficulty[]) it(`${difficulty}: safe first click and exact mine density, honest win/loss`, () => {
    const original = newMines(difficulty);
    let state = revealCell(original, 0, () => 0.5);
    expect(original.status).toBe('ready');
    expect(state.cells.filter(c => c.mine)).toHaveLength(MINE_DIFFICULTIES[difficulty].mines);
    expect([0, ...neighbors(state, 0)].every(i => !state.cells[i]!.mine && state.cells[i]!.revealed)).toBe(true);
    const loss = revealCell(state, state.cells.findIndex(c => c.mine));
    expect(loss.status).toBe('lost');
    expect(revealCell(loss, 0)).toBe(loss);
    state.cells.forEach((cell, index) => { if (!cell.mine) state = revealCell(state, index); });
    expect(state.status).toBe('won');
    expect(state.cells.filter(c => c.flagged)).toHaveLength(state.mines);
    expect(toggleFlag(state, 0)).toBe(state);
  });
  it('flags before starting, never opens flagged cells, and unflags reversibly', () => {
    const initial = newMines('beginner');
    const flagged = toggleFlag(initial, 3);
    expect(flagged.status).toBe('ready');
    expect(initial.cells[3]!.flagged).toBe(false);
    expect(revealCell(flagged, 3)).toBe(flagged);
    expect(toggleFlag(flagged, 3).cells[3]!.flagged).toBe(false);
  });
  it('chords only matching counts and loses with a wrong flag', () => {
    const fixture: MineState = { ...newMines('beginner'), rows: 3, cols: 3, mines: 1, status: 'playing', cells: Array.from({ length: 9 }, (_, i) => ({ mine: i === 0, adjacent: [1, 3, 4].includes(i) ? 1 : 0, revealed: i === 4, flagged: false })) };
    expect(chordCell(fixture, 4)).toBe(fixture);
    expect(chordCell(toggleFlag(fixture, 0), 4).status).toBe('won');
    expect(chordCell(toggleFlag(fixture, 8), 4).status).toBe('lost');
    expect(fixture.cells.filter(c => c.revealed)).toHaveLength(1);
  });
  it('floods connected zero areas and bordering numbers without crossing a flag', () => {
    const initial = toggleFlag(newMines('beginner'), 1);
    const state = revealCell(initial, 0, () => 0.5);
    expect(state.cells.filter(c => c.revealed).length).toBeGreaterThan(4);
    expect(state.cells[1]!.revealed).toBe(false);
    expect(state.cells.some(c => c.mine && c.revealed)).toBe(false);
  });
});
it('uses the same whole-second scoring formula in UI and API', () => {
  expect(elapsedSeconds(1)).toBe(1);
  expect(elapsedSeconds(1001)).toBe(2);
  expect(solitaireWinScore(1000)).toBe(2319);
  expect(solitaireWinScore(30_001)).toBe(2289);
  expect(solitaireWinScore(1_800_000)).toBe(520);
  expect(solitaireWinScore(1_900_000)).toBe(520);
});
