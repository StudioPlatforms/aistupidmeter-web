import Link from 'next/link';
import type { ReactNode } from 'react';
import { RdProse, RdRows } from '@/components/landing/Reading';
import { PROVIDER_LABEL, type LandingSnapshot } from '@/components/landing/types';
import { CHECKED, CLUSTER, LIVE_MODES, sourcesOf, type RouterEntry } from './routers-data';

/**
 * Server blocks for the AI router pages. The comparison table shows only the two columns every
 * entry can fill from its own vendor's pages (what it is, how it picks the model); hosting, keys and
 * pricing appear in the detailed list, and only where the vendor publishes them, so no cell is a
 * placeholder and nothing says what a product lacks.
 */

const isExternal = (url: string) => url.startsWith('http');

function Name({ e }: { e: RouterEntry }) {
  if (!isExternal(e.url)) return <Link href={e.url}>{e.name}</Link>;
  return <a href={e.url} rel="nofollow noopener noreferrer" target="_blank">{e.name}</a>;
}

export function RouterTable({ entries, caption }: { entries: RouterEntry[]; caption: ReactNode }) {
  return (
    <div className="rd-table-wrap seo-table-wrap rt-table-wrap lp-up">
      <table className="rd-table seo-table rt-table">
        <caption>{caption}</caption>
        <thead>
          <tr><th scope="col">Router</th><th scope="col">What it is</th><th scope="col">How it picks the model</th></tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.key} className={e.key === 'asl' ? 'rt-own' : undefined}>
              <th scope="row"><Name e={e} /></th>
              <td>{e.what}</td>
              <td>{e.picks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One ruled row per router, numbered in list order. */
export function RouterList({ entries, start = 1 }: { entries: RouterEntry[]; start?: number }) {
  return (
    <RdRows rows={entries.map((e, i): [ReactNode, ReactNode] => [
      <span key={e.key} className="rt-name">{start + i}. <Name e={e} /></span>,
      <div key={`${e.key}-d`} className="rt-detail">
        <p>{e.what}</p>
        <p><b>How it picks the model.</b> {e.picks}</p>
        {e.hosting && <p><b>Where it runs.</b> {e.hosting}</p>}
        {e.keys && <p><b>Your own provider keys.</b> {e.keys}</p>}
        {e.pricing && <p><b>Pricing.</b> {e.pricing}</p>}
      </div>,
    ])} />
  );
}

/** Two products side by side, a point per row: [point, Smart Router, the other]. */
export function VsTable({ other, rows, caption }: { other: string; rows: Array<[string, ReactNode, ReactNode]>; caption: ReactNode }) {
  return (
    <div className="rd-table-wrap seo-table-wrap rt-table-wrap lp-up">
      <table className="rd-table seo-table rt-table rt-vs">
        <caption>{caption}</caption>
        <thead>
          <tr><th scope="col">Compared on</th><th scope="col">Smart Router</th><th scope="col">{other}</th></tr>
        </thead>
        <tbody>
          {rows.map(([point, ours, theirs]) => (
            <tr key={point}>
              <th scope="row">{point}</th>
              <td>{ours}</td>
              <td>{theirs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The live router's pick for each mode in LIVE_MODES (GET /dashboard/landing: an example caller
 * with a key for every provider). `slugs` maps a model id to its /models/<slug> page.
 */
export function LivePicks({ snapshot, slugs, caption }: { snapshot: LandingSnapshot; slugs: Map<string, string>; caption: ReactNode }) {
  const rows = LIVE_MODES.flatMap((m) => {
    const st = snapshot.strategies[m.key];
    return st?.primary?.model ? [{ m, p: st.primary }] : [];
  });
  if (!rows.length) return null;
  return (
    <div className="rd-table-wrap seo-table-wrap rt-table-wrap lp-up">
      <table className="rd-table seo-table rt-table rt-live">
        <caption>{caption}</caption>
        <thead>
          <tr><th scope="col">Mode</th><th scope="col">Ranks on</th><th scope="col">Sends the request to</th></tr>
        </thead>
        <tbody>
          {rows.map(({ m, p }) => {
            const slug = slugs.get(p.model);
            const name = p.displayName || p.model;
            return (
              <tr key={m.id}>
                <th scope="row"><code>{m.id}</code></th>
                <td>{m.ranks}</td>
                <td>
                  {slug ? <Link href={`/models/${slug}`}>{name}</Link> : name}
                  <span className="rt-prov"> · {PROVIDER_LABEL[p.provider] ?? p.provider}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** "Checked <date> on each vendor's own pages", then the pages. */
export function VendorSources({ entries }: { entries: RouterEntry[] }) {
  const sources = sourcesOf(entries);
  if (!sources.length) return null;
  return (
    <RdProse className="rt-sources">
      <p>
        Checked {CHECKED} on each vendor’s own pages. Products change: follow the links for current details, and
        tell us at <Link href="/contact">contact</Link> if something here is out of date.
      </p>
      <ul>
        {sources.map((s) => (
          <li key={s.url}><a href={s.url} rel="nofollow noopener noreferrer" target="_blank">{s.label}</a></li>
        ))}
      </ul>
    </RdProse>
  );
}

/** The other pages of the cluster, for the closing band's link row. */
export function ClusterLinks({ current }: { current: string }) {
  return (
    <>
      {CLUSTER.filter((c) => c.path !== current).map((c) => <Link key={c.path} href={c.path}>{c.label}</Link>)}
      <Link href="/router/docs">Router documentation</Link>
    </>
  );
}

/** The cluster as a row of tags inside a section, the current page left out. */
export function ClusterTags({ current, label = 'AI router guides' }: { current: string; label?: string }) {
  return (
    <ul className="rd-tags lp-up" aria-label={label}>
      {CLUSTER.filter((c) => c.path !== current).map((c) => <li key={c.path}><Link href={c.path}>{c.label}</Link></li>)}
    </ul>
  );
}
