/**
 * Convertit un nombre de spectateurs affiché par Twitch en nombre.
 * Gère les formats anglais (« 46.1K », « 1,234 ») et français (« 46,1 k », « 1 234 »).
 */
export function parseViewerCount(text: string): number {
  const cleaned = text.trim().replace(/[\s\u00a0\u202f]/g, '');
  const match = cleaned.match(/^(\d+(?:[.,]\d+)*)([kKmM])?$/);
  if (!match) return 0;
  const [, num = '', suffix] = match;
  let value: number;
  if (suffix) {
    // Avec suffixe, la virgule ou le point est un séparateur décimal (« 46.1K » / « 46,1 k »).
    value = parseFloat(num.replace(',', '.'));
    value *= suffix.toLowerCase() === 'k' ? 1_000 : 1_000_000;
  } else {
    // Sans suffixe, les séparateurs sont des séparateurs de milliers (« 1,234 »).
    value = parseInt(num.replace(/[.,]/g, ''), 10);
  }
  return Number.isFinite(value) ? Math.round(value) : 0;
}

/** Extrait le login d'un lien de chaîne Twitch (« /Gotaga?x » → « gotaga »). */
export function loginFromHref(href: string | null | undefined): string | null {
  if (!href) return null;
  const path = href.replace(/^https?:\/\/[^/]+/, '').split(/[?#]/)[0] ?? '';
  const segment = path.split('/').filter(Boolean)[0];
  if (!segment || !/^[a-zA-Z0-9_]{1,25}$/.test(segment)) return null;
  return segment.toLowerCase();
}
