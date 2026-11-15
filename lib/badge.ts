/**
 * The badge's SVG (Phase 3 plan §4.6; M6b): text XML-escaped, no external font or image, no script.
 */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export const badgeDay = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');

/** Two-part badge: a dark label and a coloured value, widths from a simple per-character estimate (no external font). */
export function badgeSvg(label: string, value: string, tone: 'ok' | 'muted' | 'warn'): string {
  const w = (t: string) => Math.max(30, Math.round(t.length * 6.6) + 14);
  const lw = w(label); const vw = w(value);
  const fill = tone === 'ok' ? '#1e8e3e' : tone === 'warn' ? '#e37400' : '#5f6368';
  const L = esc(label); const V = esc(value);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + vw}" height="20" role="img" aria-label="${L}: ${V}"><title>${L}: ${V}</title>`
    + `<rect width="${lw}" height="20" fill="#202124"/><rect x="${lw}" width="${vw}" height="20" fill="${fill}"/>`
    + `<g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11"><text x="7" y="14">${L}</text><text x="${lw + 7}" y="14">${V}</text></g></svg>`;
}

