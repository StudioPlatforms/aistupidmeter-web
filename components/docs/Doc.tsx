import SubpageLayout from '../SubpageLayout';
import TocNav from './TocNav';
import '../../styles/docs.css';

/**
 * Layout and building blocks for the long reading pages (About, Methodology, FAQ).
 *
 * On a wide screen: a sticky "on this page" list on the left and the content on the right —
 * prose held to a readable measure, tables allowed the full content width.
 *
 * Deliberately no card grids or callout boxes: pages built as grids of bordered text boxes were
 * rejected by the owner as "full of containers". Text goes in prose, lists and Facts rows; only
 * numbers (Stats) and tabular data (tables) get a frame.
 * Below 1100px the list becomes a row of links above the content. Server components, except
 * the list itself (it highlights the section in view).
 *
 * Replaces the per-page terminal styling (monospace, glowing headings, 12px body text in a
 * 900px column) these pages were written in.
 */

export interface TocItem { id: string; label: string }

export function DocPage({ kicker, title, lead, toc, actions, children }: {
  kicker: string;
  title: string;
  lead?: React.ReactNode;
  toc: TocItem[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SubpageLayout>
      <div className="doc">
        <header className="doc-head">
          <div className="doc-kicker">{kicker}</div>
          <h1>{title}</h1>
          {lead && <p className="doc-lead">{lead}</p>}
          {actions && <div className="doc-actions">{actions}</div>}
        </header>
        <div className="doc-body">
          <TocNav items={toc} />
          <main className="doc-main">{children}</main>
        </div>
      </div>
    </SubpageLayout>
  );
}

export function Section({ id, title, lead, children }: { id: string; title: string; lead?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="doc-section" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>{title}</h2>
      {lead && <p className="doc-section-lead">{lead}</p>}
      {children}
    </section>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return <div className="doc-prose">{children}</div>;
}

export function Stats({ items }: { items: { value: React.ReactNode; label: string }[] }) {
  return (
    <div className="doc-stats">
      {items.map((it, i) => (
        <div key={i} className="doc-stat"><b>{it.value}</b><span>{it.label}</span></div>
      ))}
    </div>
  );
}

/** A two-column fact list: label on the left, value on the right. */
export function Facts({ rows }: { rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="doc-facts">
      {rows.map(([k, v], i) => (
        <div key={i}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}

export function QA({ id, q, children }: { id?: string; q: string; children: React.ReactNode }) {
  return (
    <div className="doc-qa" id={id}>
      <h3>{q}</h3>
      <div className="doc-qa-a">{children}</div>
    </div>
  );
}
