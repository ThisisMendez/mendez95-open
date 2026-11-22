export type PhotoMediaPath =
  | { kind: 'private'; relative: string }
  | { kind: 'public'; relative: string };

/**
 * Parses only the media paths owned by the photo pipeline. The returned value
 * is safe to join below the matching media root because every path segment is
 * matched explicitly and traversal, encoding, and extra nesting are rejected.
 */
export function parsePhotoMediaPath(value: string): PhotoMediaPath | null {
  const privateMatch = value.match(/^\/api\/editor\/media\/([a-f0-9-]+\.(?:png|jpg|webp))$/);
  if (privateMatch) return { kind: 'private', relative: privateMatch[1]! };

  const rootMatch = value.match(/^\/media\/([A-Za-z0-9_-]+\.(?:svg|png|jpe?g|webp))$/);
  if (rootMatch) return { kind: 'public', relative: rootMatch[1]! };

  const editorMatch = value.match(/^\/media\/editor\/([a-f0-9-]+\.(?:png|jpg|webp))$/);
  if (editorMatch) return { kind: 'public', relative: `editor/${editorMatch[1]!}` };

  const instagramMatch = value.match(/^\/media\/instagram\/([A-Za-z0-9_-]+\.(?:jpg|png|webp))$/);
  if (instagramMatch) return { kind: 'public', relative: `instagram/${instagramMatch[1]!}` };

  return null;
}
