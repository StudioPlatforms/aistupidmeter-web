'use client';

/**
 * The logo uploader (Phase 3 plan §3.3; M3 API contract §2).
 *
 * One square SVG icon mark per provider. The browser looks at the file first — its type, its size
 * and the root element's viewBox, found in the text without parsing it into a document — and sends
 * it as base64 in a JSON body. The API only byte-scans and queues it; the processor checks and
 * renders it in a sealed sandbox, and the page asks for the result every 1.5 s while it waits.
 *
 * Every preview is one of the PNGs the server rendered (/api/account/provider/logo/:id/png/:size).
 * The uploaded file is never put into the page: no inline <svg>, no innerHTML, no <img> of it, no
 * data: or blob: address. A mark that passes the automatic checks is in review at once (contract §0:
 * there is no separate submit step); a new upload withdraws one still waiting, and the approved mark
 * stays live until a replacement is approved. Viewers see all of it and upload nothing.
 */

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Pane, Loader, Note, Empty } from '@/components/studio';
import HostLogo from '@/components/marketplace/HostLogo';
import { HostedRowPreview, LogoChecks, LogoLarge, LogoStatePill, LogoStrips } from '@/components/marketplace/LogoPreview';
import { ProviderHead, SectionNav, useProviderSummary } from '@/components/marketplace/ProviderBits';
import { mpApi, type ApiResult, type ProviderSummary } from '@/lib/provider-account';
import {
  LOGO_MAX_BYTES, LOGO_STANDARDS_PATH, LOGO_TEXT, bytesToBase64, delayedText, isWorking, memberLogoPng, precheckLogoFile,
  precheckLogoText, waitText, type LogoStatus, type LogoView,
} from '@/lib/provider-logo';
import '@/styles/studio-provider-logo.css';

/** How often the page asks while a file is with the processor (§3.3), and while the processor is not taking files. */
const POLL_MS = 1500;
const DELAYED_POLL_MS = 15_000;

const ar = <span className="st-ar" aria-hidden="true">→</span>;

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const size = (bytes: number) => (bytes < 1024 ? `${bytes} bytes` : `${(bytes / 1024).toFixed(1)} KB`);

/** The sentence for a refused upload: the API's own, or, for the daily limit, the wait it reports. */
function uploadError(r: ApiResult<unknown>, perDay: number | undefined): string {
  if (r.status === 429) {
    const wait = Number((r.data as { retryAfterSec?: unknown } | null)?.retryAfterSec);
    const limit = perDay ? `At most ${perDay} uploads a day.` : 'You have reached the day’s limit of uploads.';
    return `${limit} ${Number.isFinite(wait) && wait > 0 ? `Try again in ${waitText(wait)}.` : 'Try again later.'}`;
  }
  return r.error ?? 'Could not upload the file.';
}

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
    <path d="M4 14.5v3A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5v-3" />
  </svg>
);

export default function LogoClient({ initial }: { initial: ProviderSummary }) {
  const { status: auth } = useSession();
  const [s] = useProviderSummary(initial);
  const [loaded, setLoaded] = useState<{ for: string; status: LogoStatus } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [safeArea, setSafeArea] = useState(false);
  const [tick, setTick] = useState(0);
  const provider = s.provider?.publicId ?? null;
  const shown = useRef(provider);
  shown.current = provider;

  // Every call names the provider account this page shows (the summary's), and a status is only ever
  // shown under the account it was asked for: a person in several accounts with another one chosen on
  // this browser first sees the default account while the summary is re-read (useProviderSummary), and
  // the status, the PNG addresses and an upload must never mix the two. A late answer for an account
  // the page has moved on from is dropped.
  const data = loaded && loaded.for === provider ? loaded.status : null;
  const load = useCallback(async () => {
    if (!provider) return;
    const r = await mpApi<LogoStatus>('/logo', { provider });
    if (shown.current !== provider) return;
    if (r.ok && r.data) { setLoaded({ for: provider, status: r.data }); setLoadError(null); }
    else setLoadError(r.error);
  }, [provider]);
  useEffect(() => { if (auth === 'authenticated' && provider) { setLoadError(null); void load(); } }, [auth, provider, load]);

  // While the file is with the processor: ask again every 1.5 s (every 15 s once it is reported
  // delayed), and not at all while the tab is hidden. A failed request is retried on the same beat.
  const working = isWorking(data?.current);
  const delayed = !!data?.current?.delayed;
  useEffect(() => {
    if (!working) return;
    const t = window.setTimeout(async () => {
      if (document.visibilityState !== 'hidden') await load();
      setTick(n => n + 1);
    }, delayed ? DELAYED_POLL_MS : POLL_MS);
    return () => window.clearTimeout(t);
  }, [working, delayed, tick, load]);

  // A file dropped beside the drop zone must not make the browser open it in place of this page.
  useEffect(() => {
    const stop = (e: globalThis.DragEvent) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); };
    window.addEventListener('dragover', stop);
    window.addEventListener('drop', stop);
    return () => { window.removeEventListener('dragover', stop); window.removeEventListener('drop', stop); };
  }, []);

  const send = async (file: File) => {
    setProblem(null);
    const meta = precheckLogoFile(file);
    if (!meta.ok) { setProblem(meta.message); return; }
    let bytes: Uint8Array;
    try { bytes = new Uint8Array(await file.arrayBuffer()); } catch { setProblem('Could not read that file. Choose it again.'); return; }
    if (bytes.length > LOGO_MAX_BYTES) { setProblem(LOGO_TEXT.fileTooLarge); return; }
    const pre = precheckLogoText(new TextDecoder().decode(bytes));
    if (!pre.ok) { setProblem(pre.message); return; }
    if (!provider) return;
    const asked = provider;
    setSending(file.name || 'your file');
    const r = await mpApi<{ logoId: number; logo: LogoView }>('/logo', {
      provider: asked,
      method: 'POST',
      body: { contentType: 'image/svg+xml', dataBase64: bytesToBase64(bytes) },
    });
    setSending(null);
    if (r.ok && r.data?.logo) {
      const logo = r.data.logo;
      setLoaded(d => (d && d.for === asked
        ? { for: asked, status: { ...d.status, current: logo, limits: { ...d.status.limits, usedToday: d.status.limits.usedToday + 1 } } }
        : d));
      void load();
      return;
    }
    setProblem(uploadError(r, data?.limits.perDay));
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';   // the same file can be chosen again after a fix
    if (file) void send(file);
  };
  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !sending) void send(file);
  };

  if (auth === 'loading') return <div data-page-loading><Loader label="Loading your logo" minHeight={420} /></div>;

  const p = s.provider;
  if (!p) {
    return (
      <>
        <ProviderHead summary={s} title="Logo" />
        <div className="st-body sw-body">
          <Empty
            title="You do not have a provider account yet"
            actions={<Link href="/account/provider" className="st-btn is-primary">Provider account {ar}</Link>}
          >
            Your logo belongs to a provider account. Create one first.
          </Empty>
        </div>
      </>
    );
  }

  const cur = data?.current ?? null;
  const approved = data?.approved ?? null;
  const name = p.displayName;
  const curSrc = cur ? (px: number) => memberLogoPng(cur.id, px, provider) : null;

  return (
    <>
      <ProviderHead
        summary={s}
        title="Logo"
        lead="Your mark appears beside your name on a white tile, in the light and the dark theme. Upload one square SVG: we check it, render it and show you the result here."
      />

      <div className="st-body sw-body">
        <SectionNav current="/account/provider/logo" kind={p.kind} />

        {!data && !loadError && <Loader label="Loading your logo" minHeight={240} />}
        {!data && loadError && <Note tone="bad" title="Your logo did not load">{loadError}</Note>}

        {data && (
          <div className="st-split">
            <div className="sw-col">
              {data.canUpload && (
                <Pane
                  title={approved || cur ? 'Upload a new mark' : 'Upload your mark'}
                  sub="A new upload replaces one that is still being checked or waiting for review."
                  foot={<span>{data.limits.usedToday} of {data.limits.perDay} uploads used in the last 24 hours.</span>}
                >
                  {data.limits.queueFull && <Note tone="warn">{LOGO_TEXT.queueFull}</Note>}
                  <label
                    className={`mp-drop${dragging ? ' is-over' : ''}${sending ? ' is-busy' : ''}`}
                    onDragOver={e => { e.preventDefault(); if (!dragging) setDragging(true); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
                    onDrop={onDrop}
                  >
                    <input type="file" accept=".svg,image/svg+xml" className="mp-drop-input" onChange={onPick} disabled={!!sending} />
                    <span className="mp-drop-icon"><UploadIcon /></span>
                    <b className="mp-drop-t">SVG only, square viewBox, up to 16 KB</b>
                    <span className="mp-drop-s">{sending ? `Sending ${sending}…` : 'Drop your file here, or choose it.'}</span>
                    <span className="st-btn is-sm mp-drop-btn" aria-hidden="true">Choose a file</span>
                  </label>
                  {problem && <p className="mp-drop-err" role="alert">{problem}</p>}
                  <p className="st-hint mp-drop-hint">
                    Read the <Link href={LOGO_STANDARDS_PATH} className="st-link-inline">Logo standards {data.standardsVersion}</Link> before
                    you export: one icon mark, no wordmark or background plate, at most 4 colours.
                  </p>
                </Pane>
              )}

              {cur ? (
                <>
                  <Pane
                    title="Your upload"
                    sub={`Uploaded ${when(cur.createdAt)} · ${size(cur.bytes)}`}
                    actions={<LogoStatePill state={cur.state} />}
                  >
                    {working && !delayed && (
                      <div className="mp-logo-wait">
                        <Loader label={cur.state === 'queued'
                          ? 'Your file is in the queue. This page updates by itself.'
                          : 'We are checking and rendering your file. This page updates by itself.'} />
                      </div>
                    )}
                    {working && delayed && <Note tone="warn">{delayedText(cur)}</Note>}
                    {cur.state === 'refused' && (
                      <Note tone="bad" title="This file was refused">
                        <span className="mp-logo-why">{cur.refusal?.message ?? 'We could not accept this file.'}</span>
                        {data.canUpload ? ' You can upload again.' : ''}
                      </Note>
                    )}
                    {cur.state === 'pending_review' && (
                      <Note title="In review">
                        {approved
                          ? 'A person at AI Stupid Level reviews every new or replaced mark; until then your approved mark stays live.'
                          : 'A person at AI Stupid Level reviews every new or replaced mark; until then we show your initials.'}
                      </Note>
                    )}
                  </Pane>

                  {curSrc && cur.pngSizes.length > 0 && (
                    <Pane
                      title="How it looks"
                      sub="On a white tile at the sizes the site uses, from the 12 px mark in a round chip to the 64 px tile of your provider page."
                      actions={(
                        <label className="st-toggle mp-safe-toggle">
                          <input type="checkbox" className="st-check" checked={safeArea} onChange={e => setSafeArea(e.target.checked)} />
                          <span className="mp-safe-text">Show the safe area</span>
                        </label>
                      )}
                    >
                      <div className="mp-logo-previews">
                        <LogoStrips src={curSrc} name={name} safeArea={safeArea} />
                        <LogoLarge src={curSrc} name={name} safeArea={safeArea} />
                      </div>
                      {safeArea && (
                        <p className="st-hint mp-logo-note">
                          The shaded band is the clear space we leave around every mark: 1/16 of the side. Your drawing stays inside the dashed line.
                        </p>
                      )}
                      <p className="st-label mp-logo-h">On the boards</p>
                      <HostedRowPreview src={curSrc} name={name} />
                    </Pane>
                  )}

                  {cur.checks.length > 0 && (
                    <Pane title="Checks" sub="What the processor measured. A person reviews every mark as well." ruled flush>
                      <div className="sw-pad mp-logo-checks">
                        <LogoChecks checks={cur.checks} />
                      </div>
                    </Pane>
                  )}
                </>
              ) : (
                <Pane title="Your upload">
                  <p className="sw-quiet">Nothing is being checked or waiting for review.</p>
                </Pane>
              )}
            </div>

            <div className="sw-col">
              <Pane title="Live mark" delay={0.06}>
                <div className="mp-live">
                  <HostLogo
                    name={name}
                    logoUrl={approved && approved.pngSizes.length ? memberLogoPng(approved.id, 64, provider) : null}
                    size={64}
                    label={approved ? 'Your approved mark' : 'Your initials, shown until a mark is approved'}
                  />
                  <p className="sw-quiet">
                    {approved
                      ? <>Approved {when(approved.decidedAt)}. It stays live until a replacement is approved.</>
                      : 'No mark is approved yet, so we show your initials.'}
                  </p>
                </div>
              </Pane>
              <Pane title={`Logo standards ${data.standardsVersion}`} delay={0.1}>
                <p className="sw-quiet">What we accept, how each file is checked, and how review works.</p>
                <div className="st-actions sw-gap-top">
                  <Link href={LOGO_STANDARDS_PATH} className="st-btn is-sm">Read the standards {ar}</Link>
                </div>
              </Pane>
              {!data.canUpload && (
                <Note title="You can read this page">Owners and admins of the provider account upload the logo.</Note>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
