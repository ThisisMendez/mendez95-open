/** Frozen order also owns deterministic attribution for notes predating portraits. */
export const LEGACY_CHARACTERS = ['scout', 'sprout', 'orbit', 'moss', 'spark', 'cloud', 'pebble', 'wave', 'comet', 'fern', 'sunny', 'echo'] as const;
export const ADDED_CHARACTERS = ['cedar', 'indigo', 'dune', 'lark', 'river', 'clover', 'ember', 'willow'] as const;
export const CHARACTERS = [...LEGACY_CHARACTERS, ...ADDED_CHARACTERS] as const;
/** Retain stored legacy colors; the picker offers four primary accents. */
export const COLORS = ['teal', 'coral', 'violet', 'blue', 'amber', 'forest'] as const;
export const PRIMARY_COLORS = ['teal', 'coral', 'blue', 'amber'] as const;
export type CharacterId = typeof CHARACTERS[number];
export type ColorId = typeof COLORS[number];
export type Appearance = {characterId: CharacterId; colorId: ColorId};
export function isCharacter(value: unknown): value is CharacterId {return typeof value === 'string' && (CHARACTERS as readonly string[]).includes(value);}
export function isColor(value: unknown): value is ColorId {return typeof value === 'string' && (COLORS as readonly string[]).includes(value);}
/** Explicit atlases preserve the original 4×3 crops when the inventory grows. */
export function portraitSprite(characterId: CharacterId) {
  const index = CHARACTERS.indexOf(characterId);
  const legacy = index < LEGACY_CHARACTERS.length;
  const localIndex = Math.max(0, legacy ? index : index - LEGACY_CHARACTERS.length);
  const rows = legacy ? 3 : 2;
  return {src: legacy ? '/portraits/messenger-atlas-v1.svg' : '/portraits/messenger-atlas-v2.svg', columns: 4, rows, column: localIndex % 4, row: Math.floor(localIndex / 4)};
}
/** Stable across clients and server; reading a legacy note never migrates its bytes. */
export function noteAppearance(note: {id: string; characterId?: unknown; colorId?: unknown}): Appearance {
  let hash = 0; for (const char of note.id) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return {characterId: isCharacter(note.characterId) ? note.characterId : LEGACY_CHARACTERS[hash % LEGACY_CHARACTERS.length]!, colorId: isColor(note.colorId) ? note.colorId : COLORS[hash % COLORS.length]!};
}
