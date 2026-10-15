'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';

export interface FaqEntry { id: string; q: string; group: string; text: string }

const MAX_HITS = 6;

/** Lower case, accents and quote marks removed, so "naïve" finds "naive" and "=4" finds “=4”. */
const fold = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[“”"‘’'`]/g, '');

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A rough stem, so "refuse" finds "refusal" and "alerts" finds "alert": endings off, at least 3 letters kept. */
const stem = (w: string) => {
  const t = w.replace(/(ing|ed|es|al|s|e)$/, '');
  return t.length >= 3 && /^[a-z]+$/.test(w) ? t : w;
};

/** Open the question an anchor points at (/faq#tie) and flash it, so the reader sees where they landed. */
function reveal(id: string) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLDetailsElement)) return;
  el.open = true;
  el.classList.remove('is-flash');
  void el.offsetWidth; // restart the flash
  el.classList.add('is-flash');
  // Land it just under the top bar: on arrival the browser scrolls before the fonts settle the
  // lengths of everything above, which leaves the question a little out of place.
  requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
}

/**
 * The FAQ's search, beside the hero. The answers stay on the page in full (and in the FAQPage
 * structured data); this only finds them: questions first, then answers, every word required.
 * Following a result, or arriving at /faq#some-question, opens that question.
 */
export default function FaqSearch({ entries, start }: { entries: FaqEntry[]; start: string[] }) {
  const [q, setQ] = useState('');
  const index = useMemo(
    () => entries.map((e) => ({ ...e, fq: fold(e.q), fa: fold(`${e.text} ${e.group}`) })),
    [entries],
  );

  const words = fold(q).split(/[^a-z0-9=%.+-]+/).map((w) => stem(w.replace(/^[.+-]+|[.+-]+$/g, ''))).filter((w) => w.length > 1 || /[0-9=]/.test(w));
  const hits = useMemo(() => {
    if (!words.length) return [];
    return index
      .map((e) => {
        let score = 0;
        for (const w of words) {
          if (e.fq.includes(w)) score += 3;
          else if (e.fa.includes(w)) score += 1;
          else return null;
        }
        return { e, score };
      })
      .filter((h): h is { e: (typeof index)[number]; score: number } => h !== null)
      .sort((a, b) => b.score - a.score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, words.join(' ')]);

  useEffect(() => {
    const onHash = () => { const id = decodeURIComponent(window.location.hash.slice(1)); if (id) reveal(id); };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  /** The question with the searched words marked. */
  const marked = (text: string): ReactNode => {
    if (!words.length) return text;
    const re = new RegExp(`(${words.map(escape).join('|')})`, 'gi');
    const folded = fold(text);
    // Mark on the folded copy's positions; the two strings only differ by removed quote marks and
    // accents, so mark only when the lengths agree (otherwise show the question unmarked).
    if (folded.length !== text.length) return text;
    const out: ReactNode[] = [];
    let last = 0;
    for (const m of Array.from(folded.matchAll(re))) {
      const at = m.index ?? 0;
      if (at > last) out.push(text.slice(last, at));
      out.push(<mark key={at}>{text.slice(at, at + m[0].length)}</mark>);
      last = at + m[0].length;
    }
    out.push(text.slice(last));
    return out;
  };

  const item = (e: FaqEntry, i: number) => (
    <li key={e.id}>
      <a href={`#${e.id}`} onClick={() => reveal(e.id)} style={{ '--i': i } as React.CSSProperties}>
        <b>{marked(e.q)}</b>
        <small>{e.group}</small>
      </a>
    </li>
  );

  const starters = start.map((id) => entries.find((e) => e.id === id)).filter((e): e is FaqEntry => !!e);

  return (
    <div className="rd-search" role="search">
      <label className="rd-search-in">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.8" />
          <path d="m13 13 4.25 4.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span className="lp-sr">Search the questions</span>
        <input
          type="search"
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' && hits[0]) {
              ev.preventDefault();
              window.location.hash = hits[0].e.id;
              reveal(hits[0].e.id);
            }
          }}
          placeholder={`Search ${entries.length} answers`}
          aria-controls="rd-search-results"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <div className="rd-search-body" id="rd-search-results" aria-live="polite">
        {!words.length ? (
          <>
            <p className="rd-search-l">Start here</p>
            <ul>{starters.map(item)}</ul>
          </>
        ) : hits.length ? (
          <>
            <p className="rd-search-l">
              {hits.length === 1 ? '1 answer matches' : `${hits.length} answers match`}
              {hits.length > MAX_HITS ? ` · the closest ${MAX_HITS}` : ''}
            </p>
            <ul key={words.join(' ')}>{hits.slice(0, MAX_HITS).map((h, i) => item(h.e, i))}</ul>
          </>
        ) : (
          <p className="rd-search-none">
            No answer mentions “{q.trim()}”. <a href="/contact">Ask us</a> — we answer our own email.
          </p>
        )}
      </div>
    </div>
  );
}
