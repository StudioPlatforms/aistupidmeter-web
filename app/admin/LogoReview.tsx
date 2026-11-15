'use client';

/**
 * A provider's logo uploads in the admin's provider detail (Phase 3 plan §3.4 step 4, §10.4; M3 API
 * contract §3), read-only in M3: approving and refusing come with M5's decision views.
 *
 * Newest first; the newest is open. Each shows its state, the refusal with its sentence, the
 * "looks like another brand's mark" flag, the processor's checks, and the mark at 12–64 px on the
 * light theme's ground and the dark theme's — always the PNGs the server rendered, from
 * /api/admin/marketplace/logos/:id/png/:size, never the SVG: inlined in this privileged page it
 * would be a cross-site-scripting surface. Opening an upload also asks for its detail (the dHash
 * and the nearest reference mark).
 */

import { useEffect, useState } from 'react';
import { Note, Tag } from '@/components/studio';
import { LogoChecks, LogoStatePill, LogoStrips } from '@/components/marketplace/LogoPreview';
import { adminLogoPng, delayedText, isWorking, type AdminLogoDetail, type AdminLogoRow, type LogoState } from '@/lib/provider-logo';
import { fullDate } from './format';

const bytesText = (b: number) => (b < 1024 ? `${b} bytes` : `${(b / 1024).toFixed(1)} KB`);

/**
 * What `decidedAt` is, by state (contract §1): when processing ended for a refused or in-review
 * upload, otherwise the later decision itself (a newer upload withdrawing this one, an approval, a
 * retirement).
 */
const DECIDED_LABEL: Partial<Record<LogoState, string>> = { withdrawn: 'Withdrawn', approved: 'Approved', retired: 'Retired' };

/**
 * Why an upload shows no previews. `sha8` stays after the renditions are deleted, 90 days after a
 * refusal, withdrawal or retirement (the bench's retention), so it tells "never drawn" from "deleted".
 */
function noRenditions(logo: AdminLogoRow): string {
  if (isWorking(logo)) return 'Not rendered yet.';
  const drawn = logo.sha8 !== null;
  if (drawn && (logo.state === 'refused' || logo.state === 'withdrawn' || logo.state === 'retired')) {
    return 'No renditions: they are deleted 90 days after an upload is refused, withdrawn or retired.';
  }
  if (!drawn && logo.state === 'refused') return 'No renditions: the file was refused before it was drawn.';
  if (!drawn && logo.state === 'withdrawn') return 'No renditions: the upload was withdrawn before it was drawn.';
  return 'No renditions.';
}

function AdminLogo({ logo, name, first }: { logo: AdminLogoRow; name: string; first: boolean }) {
  const [open, setOpen] = useState(first);
  const [detail, setDetail] = useState<AdminLogoDetail | null>(null);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    if (!open || detail || detailError) return;
    let live = true;
    (async () => {
      try {
        const r = await fetch(`/api/admin/marketplace/logos/${logo.id}`, { cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (!live) return;
        if (r.ok && j?.success && j.data?.logo) setDetail(j.data.logo as AdminLogoDetail);
        else setDetailError(j?.message || j?.error || `The API answered ${r.status}.`);
      } catch {
        if (live) setDetailError('Could not reach the server.');
      }
    })();
    return () => { live = false; };
  }, [open, detail, detailError, logo.id]);

  const lookalike = logo.checks.some(c => c.key === 'lookalike' && !c.ok);
  const delayed = delayedText(logo);
  const src = (px: number) => adminLogoPng(logo.id, px);
  return (
    <details className="mp-admin-logo" open={first} onToggle={e => setOpen(e.currentTarget.open)}>
      <summary>
        <LogoStatePill state={logo.state} />
        <span className="mp-admin-logo-when" title={fullDate(logo.createdAt)}>{fullDate(logo.createdAt)}</span>
        <span className="st-faint">{bytesText(logo.bytes)}</span>
        {lookalike && <Tag tone="warn" title="The nearest reference mark is within the lookalike distance: a person checks it is the provider's own">Lookalike</Tag>}
        {logo.refusal && <Tag tone="bad">{logo.refusal.code.replace(/_/g, ' ')}</Tag>}
      </summary>
      <div className="mp-admin-logo-body">
        {logo.refusal && <Note tone="bad" title="Refused"><span className="mp-admin-logo-why">{logo.refusal.message}</span></Note>}
        {delayed && <Note tone="warn">{delayed}</Note>}
        {logo.pngSizes.length > 0
          ? <LogoStrips src={src} name={name} />
          : <p className="st-faint mp-admin-logo-none">{noRenditions(logo)}</p>}
        <LogoChecks checks={logo.checks} empty={isWorking(logo) ? 'Not checked yet.' : 'No checks were run.'} />
        <dl className="st-kv is-tight mp-admin-logo-kv">
          <div><dt>Upload</dt><dd>#{logo.id}, {fullDate(logo.createdAt)}</dd></div>
          <div><dt>{DECIDED_LABEL[logo.state] ?? 'Checked'}</dt><dd>{logo.decidedAt ? fullDate(logo.decidedAt) : '—'}{logo.attempts > 0 ? ` · ${logo.attempts} interrupted attempt${logo.attempts === 1 ? '' : 's'}` : ''}</dd></div>
          <div><dt>Rendition</dt><dd>{logo.sha8 ?? '—'}</dd></div>
          {detail && <div><dt>dHash</dt><dd>{detail.dhash ?? '—'}</dd></div>}
          {detail && (
            <div>
              <dt>Nearest brand</dt>
              <dd>
                {detail.lookalike
                  ? `${detail.lookalike.brand}, distance ${detail.lookalike.distance} of 64 (10 or less is flagged)`
                  : detail.dhash ? 'None within the lookalike distance' : 'Not compared'}
              </dd>
            </div>
          )}
          {detailError && <div><dt>Detail</dt><dd className="st-faint">{detailError}</dd></div>}
        </dl>
      </div>
    </details>
  );
}

export default function LogoReview({ logos, name }: { logos: AdminLogoRow[]; name: string }) {
  if (!logos.length) return <p className="st-faint mp-admin-logo-none">No uploads yet.</p>;
  return (
    <div className="mp-admin-logos">
      {logos.map((l, i) => <AdminLogo key={l.id} logo={l} name={name} first={i === 0} />)}
    </div>
  );
}
