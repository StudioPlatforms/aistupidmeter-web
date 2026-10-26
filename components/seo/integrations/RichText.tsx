import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The integration registry's text (lib/integrations.ts): plain strings with `code` spans and
 * [label](href) links, rendered as <code> and <Link>/<a>. One renderer for the steps, caveats,
 * troubleshooting rows and FAQ, so the same string feeds the page and, stripped, the JSON-LD.
 * A manual exec loop rather than matchAll: the project's TS lib is es6.
 */
const TOKEN = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = new RegExp(TOKEN.source, 'g');
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const at = m.index;
    if (at > last) parts.push(text.slice(last, at));
    if (m[1] !== undefined) {
      parts.push(<code key={at}>{m[1]}</code>);
    } else {
      const label = m[2];
      const href = m[3];
      if (href.startsWith('/')) parts.push(<Link key={at} href={href}>{label}</Link>);
      else if (/^https?:/.test(href)) parts.push(<a key={at} href={href} target="_blank" rel="noopener noreferrer">{label}</a>);
      else parts.push(<a key={at} href={href}>{label}</a>);
    }
    last = at + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** The same text as plain words, for JSON-LD: code spans unwrapped, links reduced to their label. */
export function plainText(text: string): string {
  return text.replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
}
