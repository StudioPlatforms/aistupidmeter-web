import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The visible FAQ of a "getting worse" page: the same { q, a } strings feed faqLd(), so the
 * structured data can never say something the page does not. Answers are plain text with
 * [label](/path) links and blank-line paragraphs. Server component on reading.css's disclosure
 * rows (.rd-qa).
 */
export interface WorseFaqItem { q: string; a: string }

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Text with [label](/path) links turned into anchors. */
export function Rich({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of Array.from(text.matchAll(LINK))) {
    const at = m.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    parts.push(<Link key={at} href={m[2]}>{m[1]}</Link>);
    last = at + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

export function WorseFaq({ items, openFirst = true }: { items: WorseFaqItem[]; openFirst?: boolean }) {
  if (!items.length) return null;
  return (
    <div className="rd-qas lp-up">
      {items.map((it, i) => (
        <details key={it.q} className="rd-qa" open={openFirst && i === 0}>
          <summary>{it.q}</summary>
          <div className="rd-qa-a">
            {it.a.split(/\n{2,}/).map((p, j) => <p key={j}><Rich text={p} /></p>)}
          </div>
        </details>
      ))}
    </div>
  );
}
