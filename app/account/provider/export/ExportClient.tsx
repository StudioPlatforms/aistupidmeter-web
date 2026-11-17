'use client';

/**
 * "Export your data" (M13; Provider Terms and Listing Agreement v1.0 §14.1 and §24.4): the three CSV files the API builds for a provider
 * account (GET /account/provider/export, api:src/marketplace/export.ts): run records of every listing, the published daily
 * means and the Smart Router traffic counts. Every member may download them (owner, admin, viewer).
 *
 * Export-only access (§24.4): once an account is closed its console is gone for every member (the API treats it as
 * none), but for 90 days after the close (or after AI Stupid Level's termination, when that took effect later) its
 * members can still download these three files and see when that ends. ExportOnlyAccounts is that view, and nothing
 * else of the account: it is also what /account/provider shows a member who has no open account (OverviewClient).
 * The files pass through the account proxy as CSV attachments (app/api/account/[...path]/route.ts passThrough).
 */
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Pane, Loader, Empty } from '@/components/studio';
import { ProviderHead } from '@/components/marketplace/ProviderBits';
import { mpApi, type ProviderSummary } from '@/lib/provider-account';

export interface ExportFile { key: string; label: string; description: string; path: string }
export interface ExportWindow {
  provider: { publicId: string; displayName: string; state: string };
  role: string;
  access: 'full' | 'export_only';
  closedAt: string | null;
  terminatedAt: string | null;
  availableUntil: string | null;
  files: ExportFile[];
}
export interface ExportSummary { account: ExportWindow | null; exportOnly: ExportWindow[] }

const day = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—';

/** The proxy's URL of an API path (/account/provider/export/…?provider=…). */
const href = (path: string) => (path.startsWith('/account/') ? `/api${path}` : '#');

function FileIcon() {
  return (
    <span className="mp-mark" aria-hidden="true">
      <svg viewBox="0 0 12 12" fill="none"><path d="M6 2v5.5M3.6 5.4L6 7.8l2.4-2.4M2.5 10h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

/** The three files, one row each: what is in it, and its download. */
export function ExportFiles({ files }: { files: ExportFile[] }) {
  return (
    <div className="mp-checks">
      {files.map(f => (
        <div key={f.key} className="mp-check">
          <FileIcon />
          <div className="mp-check-main">
            <div className="mp-check-t">{f.label}</div>
            <div className="mp-check-s">{f.description}</div>
          </div>
          <div className="mp-check-end">
            <a className="st-btn is-sm" href={href(f.path)} download>Download CSV</a>
          </div>
        </div>
      ))}
    </div>
  );
}

/** What happened to a closed account, and until when its data can be downloaded. */
export function exportOnlyText(w: ExportWindow): { happened: string; until: string } {
  const closed = `This provider account was closed on ${day(w.closedAt)}.`;
  const ended = w.terminatedAt && w.closedAt && Date.parse(w.terminatedAt) > Date.parse(w.closedAt)
    ? ` AI Stupid Level ended its provider relationship on ${day(w.terminatedAt)}.` : '';
  return {
    happened: `${closed}${ended} Its console is no longer available.`,
    until: `You can download its data until ${day(w.availableUntil)}. After that, these files are no longer available here.`,
  };
}

/** One closed account in its export window: the short page and the three files, nothing else. */
export function ExportOnlyAccount({ w, delay }: { w: ExportWindow; delay?: number }) {
  const t = exportOnlyText(w);
  return (
    <Pane title={w.provider.displayName} sub="Closed provider account · export only" ruled flush delay={delay}>
      <div className="sw-pad">
        <p>{t.happened}</p>
        <p className="sw-quiet">{t.until}</p>
      </div>
      <ExportFiles files={w.files} />
    </Pane>
  );
}

/** Every closed account the member may still export (none: renders nothing). Used by /account/provider when there is no open account. */
export function ExportOnlyAccounts({ initial }: { initial?: ExportWindow[] | null }) {
  const [list, setList] = useState<ExportWindow[] | null>(initial ?? null);
  useEffect(() => {
    if (initial) return;
    let live = true;
    void mpApi<ExportSummary>('/export', { provider: null }).then(r => { if (live) setList(r.ok && r.data ? r.data.exportOnly : []); });
    return () => { live = false; };
  }, [initial]);
  if (!list || list.length === 0) return null;
  return (
    <div className="sw-stack">
      {list.map((w, i) => <ExportOnlyAccount key={w.provider.publicId} w={w} delay={i * 0.04} />)}
    </div>
  );
}

/** The page body, given the API's answer (null: not loaded yet; 'none': nothing to export). */
export function ExportView({ summary, data }: { summary: ProviderSummary; data: ExportSummary | 'none' }) {
  const account = data !== 'none' ? data.account : null;
  const closed = data !== 'none' ? data.exportOnly.filter(w => w.provider.publicId !== account?.provider.publicId) : [];
  return (
    <>
      <ProviderHead summary={summary} title="Export your data" lead="Download your provider account's data as CSV files: run records, published results and Smart Router traffic." />
      <div className="st-body sw-body">
        {data === 'none' || (!account && closed.length === 0) ? (
          <Empty title="Nothing to export">You are not a member of a provider account with data to export.</Empty>
        ) : (
          <div className="sw-stack">
            {account && account.access === 'full' && (
              <Pane title={account.provider.displayName} sub="Every listing of this account, in three files. Every member can download them." ruled flush>
                <ExportFiles files={account.files} />
              </Pane>
            )}
            {account && account.access === 'export_only' && <ExportOnlyAccount w={account} />}
            {closed.map((w, i) => <ExportOnlyAccount key={w.provider.publicId} w={w} delay={(i + 1) * 0.04} />)}
          </div>
        )}
      </div>
    </>
  );
}

export default function ExportClient({ initial }: { initial: ProviderSummary }) {
  const { status } = useSession();
  const [data, setData] = useState<ExportSummary | 'none' | null>(null);
  useEffect(() => {
    let live = true;
    void mpApi<ExportSummary>('/export').then(r => { if (live) setData(r.ok && r.data ? r.data : 'none'); });
    return () => { live = false; };
  }, []);
  if (status === 'loading' || data === null) return <div data-page-loading><Loader label="Loading your export" minHeight={320} /></div>;
  return <ExportView summary={initial} data={data} />;
}
