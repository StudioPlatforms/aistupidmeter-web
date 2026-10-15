import type { CSSProperties, ReactNode } from 'react';
import SubpageLayout from '@/components/SubpageLayout';
import { lpBody, lpDisplay } from '@/lib/fonts';
import LandingEffects from './LandingEffects';
import ReadingToc, { type RdTocItem } from './ReadingToc';
import '@/styles/landing.css';
import '@/styles/reading.css';

/**
 * The long reading pages (About, Methodology, FAQ, the Data API reference, context rot, the Teams
 * guide) in the landing page's look: a hero, then one band per section with the landing's
 * alternating grounds, a contents panel that follows the reader, and a closing band.
 *
 * The blocks are the ones the plain reading pages had: prose, ruled fact rows, figures, tables and
 * code samples. Text is never put in grids of bordered boxes — the owner rejected that as "full of
 * containers"; only figures, tables, code and the odd single panel get a frame. Server components;
 * the contents panel is the client part.
 */

export type { RdTocItem };

const intro = (d: string): CSSProperties => ({ '--d': d } as CSSProperties);

// Reveal-on-scroll hides blocks only once scripts run; the failsafe shows everything if they never do.
const FAILSAFE = "(function(){var d=document.documentElement;d.classList.add('lp-js');setTimeout(function(){if(!window.__lpReady)d.classList.remove('lp-js')},4000)})();";

/** "01" for the first entry of the contents. */
export const tocNumber = (toc: RdTocItem[], id: string): string =>
  String(Math.max(1, toc.findIndex((t) => t.id === id) + 1)).padStart(2, '0');

export function ReadingPage({ className = '', kicker, title, accent, lead, actions, note, aside, toc, tocLabel, children, final }: {
  className?: string;
  kicker: string;
  /** The heading; `accent` is its second line, set in the accent colour. */
  title: ReactNode;
  accent?: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  /** A short line under the buttons (the landing's fine print). */
  note?: ReactNode;
  /** The hero's right-hand side: landing facts, a search, a code sample. */
  aside?: ReactNode;
  toc: RdTocItem[];
  tocLabel?: string;
  children: ReactNode;
  /** The closing band (RdFinal). It sits outside the area the contents panel travels through. */
  final?: ReactNode;
}) {
  return (
    <SubpageLayout>
      <div className={`lp lp-sub rd-page ${className} ${lpBody.variable} ${lpDisplay.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: FAILSAFE }} />
        <LandingEffects />
        <header className="lp-hero lp-textured rd-hero">
          <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="lp-wrap">
            {/* As on the landing: the heading spans the page, the lead and the side panel share the row below. */}
            <p className="lp-kicker lp-intro" style={intro('.04s')}>{kicker}</p>
            <h1 className="lp-h1 lp-intro" style={intro('.1s')}>
              {title}{accent && <>{' '}<span className="lp-b">{accent}</span></>}
            </h1>
            <div className="lp-hero-row">
              <div>
                {lead && <p className="lp-lead lp-intro" style={intro('.18s')}>{lead}</p>}
                {actions && <div className="lp-cta lp-intro" style={intro('.26s')}>{actions}</div>}
                {note && <p className="lp-fine lp-intro rd-hero-note" style={intro('.3s')}>{note}</p>}
              </div>
              {aside && <div className="rd-aside lp-intro" style={intro('.34s')}>{aside}</div>}
            </div>
          </div>
        </header>
        <div className="rd">
          <ReadingToc items={toc} label={tocLabel} />
          {children}
        </div>
        {final}
      </div>
    </SubpageLayout>
  );
}

/** One section: a band with a numbered kicker, the heading and an optional lead, then its blocks. */
export function RdSection({ id, n, title, lead, children }: {
  id: string;
  n: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section id={id} className="lp-sec rd-sec" aria-labelledby={`${id}-h`}>
      <div className="lp-wrap">
        <div className="rd-head lp-up">
          <p className="lp-kicker">{n}</p>
          <h2 className="rd-h2" id={`${id}-h`}>{title}</h2>
          {lead && <p className="lp-lead">{lead}</p>}
        </div>
        {children && <div className="rd-body">{children}</div>}
      </div>
    </section>
  );
}

export function RdProse({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rd-prose lp-up ${className}`.trim()}>{children}</div>;
}

/** Label and value on one rule. */
export function RdFacts({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="rd-facts lp-up">
      {rows.map(([k, v], i) => <div key={i}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

/** Like RdFacts, set larger: a short claim as the heading, its explanation beside it. */
export function RdRows({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="rd-rows lp-up">
      {rows.map(([k, v], i) => <div key={i}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

/**
 * Figures in a ruled strip. A numeric `count` counts up from zero when it comes into view
 * (LandingEffects); the server-rendered text is already the real figure, so nothing depends on it.
 */
export function RdStats({ items }: { items: { value: ReactNode; count?: number; suffix?: string; label: string }[] }) {
  return (
    <div className="rd-stats lp-up">
      {items.map((it, i) => (
        <div key={i} className="rd-stat">
          <b>{typeof it.count === 'number' && it.count > 0
            ? <><span data-count={it.count}>{it.count.toLocaleString('en-US')}</span>{it.suffix}</>
            : it.value}</b>
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

/** A weights table: each measure's share drawn to scale beside its number (the bars grow in on reveal). */
export function RdWeights({ rows, label = 'Measure' }: { rows: [string, number, string][]; label?: string }) {
  return (
    <div className="rd-table-wrap is-narrow lp-up">
      <table className="rd-table">
        <thead><tr><th>{label}</th><th className="rd-wt">Weight</th><th>What it measures</th></tr></thead>
        <tbody>
          {rows.map(([name, w, note], i) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              <td className="rd-wt"><b>{w}%</b><span className="rd-w" aria-hidden="true"><i style={{ '--w': w / 100, '--i': i } as CSSProperties} /></span></td>
              <td className="muted">{note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Comments (after a space or at a line start, so a URL's "//" is not one), strings — a JSON key
// apart from a value — keywords and literals, numbers, and the command that starts a shell line.
const CODE_RE = /(^|[ \t])(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')(\s*:)?|\b(const|let|var|function|return|require|new|if|else|true|false|null|undefined)\b|(-?\b\d+(?:\.\d+)?\b)|^([ \t]*)(curl)\b/gm;

/** Colour a code sample the way the landing's code cards are (.lp-code .k/.s/.n/.c/.f). */
export function highlightCode(src: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of Array.from(src.matchAll(CODE_RE))) {
    const at = m.index ?? 0;
    if (at > last) out.push(src.slice(last, at));
    if (m[2]) {
      out.push(m[1]);
      out.push(<span key={at} className="c">{m[2]}</span>);
    } else if (m[3]) {
      out.push(<span key={at} className={m[4] ? 'k' : 's'}>{m[3]}</span>);
      if (m[4]) out.push(m[4]);
    } else if (m[5]) {
      out.push(<span key={at} className={/^(true|false|null|undefined)$/.test(m[5]) ? 'n' : 'k'}>{m[5]}</span>);
    } else if (m[6]) {
      out.push(<span key={at} className="n">{m[6]}</span>);
    } else if (m[8]) {
      out.push(m[7]);
      out.push(<span key={at} className="f">{m[8]}</span>);
    }
    last = at + m[0].length;
  }
  out.push(src.slice(last));
  return out;
}

/** A code sample in the landing's code card: a title bar, then the coloured code. */
export function RdCode({ title, label, code }: { title: ReactNode; label?: ReactNode; code: string }) {
  return (
    <div className="lp-codecard rd-code lp-up">
      <div className="lp-cc-head"><b>{title}</b>{label && <span>{label}</span>}</div>
      <pre className="lp-code">{highlightCode(code)}</pre>
    </div>
  );
}

/** The closing band, as on the landing page. */
export function RdFinal({ id, title, lead, actions, explore }: {
  id?: string;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  explore?: ReactNode;
}) {
  return (
    <section className="lp-sec lp-final lp-textured" id={id} aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="lp-wrap">
        <h2 className="lp-h2 lp-up" id={id ? `${id}-h` : undefined}>{title}</h2>
        {lead && <p className="lp-lead lp-up">{lead}</p>}
        {actions && <div className="lp-cta lp-up">{actions}</div>}
        {explore && <div className="lp-explore">{explore}</div>}
      </div>
    </section>
  );
}
