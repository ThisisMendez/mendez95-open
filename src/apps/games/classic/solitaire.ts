export const SUITS = ['clubs', 'diamonds', 'spades', 'hearts'] as const;
export type Suit = typeof SUITS[number];
export type Card = { suit: Suit; rank: number; faceUp: boolean };
export type SolitaireState = { stock: Card[]; waste: Card[]; tableau: Card[][]; foundations: Card[][]; moves: number };
export type CardSource = { kind: 'waste' } | { kind: 'tableau'; pile: number; index: number } | { kind: 'foundation'; pile: number };
export type CardTarget = { kind: 'tableau' | 'foundation'; pile: number };
const red = (card: Card) => card.suit === 'diamonds' || card.suit === 'hearts';
export const cardName = (card: Card) => `${['', 'Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'][card.rank]} of ${card.suit}`;
export function newSolitaire(random = Math.random): SolitaireState {
  const stock: Card[] = SUITS.flatMap(suit => Array.from({ length: 13 }, (_, i) => ({ suit, rank: i + 1, faceUp: false })));
  for (let i = stock.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [stock[i], stock[j]] = [stock[j]!, stock[i]!]; }
  const tableau = Array.from({ length: 7 }, (_, pile) => Array.from({ length: pile + 1 }, (_, index) => ({ ...stock.pop()!, faceUp: index === pile })));
  return { stock, tableau, waste: [], foundations: SUITS.map(() => []), moves: 0 };
}
export function drawCard(state: SolitaireState): SolitaireState | null {
  if (state.stock.length) return { ...state, stock: state.stock.slice(0, -1), waste: [...state.waste, { ...state.stock.at(-1)!, faceUp: true }], moves: state.moves + 1 };
  if (state.waste.length) return { ...state, stock: [...state.waste].reverse().map(card => ({ ...card, faceUp: false })), waste: [], moves: state.moves + 1 };
  return null;
}
export function sourceCards(state: SolitaireState, source: CardSource): Card[] {
  if (source.kind === 'waste') return state.waste.slice(-1);
  if (source.kind === 'foundation') return state.foundations[source.pile]?.slice(-1) || [];
  const pile = state.tableau[source.pile];
  if (!pile || source.index < 0 || source.index >= pile.length) return [];
  return pile.slice(source.index);
}
export function moveCards(state: SolitaireState, source: CardSource, target: CardTarget): SolitaireState | null {
  if (!Number.isInteger(target.pile) || target.pile < 0 || target.pile >= (target.kind === 'tableau' ? 7 : 4)) return null;
  if (source.kind === target.kind && source.pile === target.pile) return null;
  const cards = sourceCards(state, source), first = cards[0];
  if (!first || cards.some(card => !card.faceUp)) return null;
  if (cards.some((card, index) => index > 0 && (cards[index - 1]!.rank !== card.rank + 1 || red(cards[index - 1]!) === red(card)))) return null;
  const destination = target.kind === 'tableau' ? state.tableau[target.pile]! : state.foundations[target.pile]!;
  const last = destination.at(-1);
  if (target.kind === 'foundation') {
    if (cards.length !== 1 || first.suit !== SUITS[target.pile] || first.rank !== (last?.rank || 0) + 1) return null;
  } else if (last ? !last.faceUp || red(last) === red(first) || last.rank !== first.rank + 1 : first.rank !== 13) return null;
  const next: SolitaireState = { ...state, stock: [...state.stock], waste: [...state.waste], tableau: state.tableau.map(pile => [...pile]), foundations: state.foundations.map(pile => [...pile]), moves: state.moves + 1 };
  if (source.kind === 'waste') next.waste.pop();
  else if (source.kind === 'foundation') next.foundations[source.pile]!.pop();
  else {
    const pile = next.tableau[source.pile]!;
    pile.splice(source.index);
    if (pile.length && !pile.at(-1)!.faceUp) pile[pile.length - 1] = { ...pile.at(-1)!, faceUp: true };
  }
  (target.kind === 'tableau' ? next.tableau : next.foundations)[target.pile]!.push(...cards);
  return next;
}
export const solitaireWon = (state: SolitaireState) => state.foundations.every(pile => pile.length === 13);
