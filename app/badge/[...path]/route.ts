import { publicRead, providerTags, headlineText, type ProviderPageDTO, type EntryPageDTO } from '@/lib/marketplace-public';
import { badgeSvg, badgeDay as day } from '@/lib/badge';

/**
 * The badge (Phase 3 plan §4.6 "The badge", MD2; M6b): /badge/<provider> and /badge/<provider>/<entry>, an SVG we
 * generate (never one a provider uploads), at an extension-less URL so nginx's static block (a one-day cache) never
 * catches it; this route keeps it at most 300 s. Text is XML-escaped. Headers: image/svg+xml, nosniff, and a CSP of
 * default-src 'none' with inline styles only.
 *   provider  "Measured by AI Stupid Level · <n> models · <date>"
 *   entry     "<Model> on <Provider> · coding 91 ± 1 · <last published day>", "measuring" before the headline exists,
 *             "paused" while measurement is paused. A rank only for an entry that joined the main ranking: none can in
 *             Phase 3 (MD22), so no badge states one.
 * Only what is PUBLIC: while provider pages are a staff preview (M1-M9) every badge answers 404, and a delisted one
 * 410 (middleware.ts). Badges are embedded on other sites, so there is no signed-in preview here.
 */
export const dynamic = 'force-dynamic';

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const HEADERS = {
  'Content-Type': 'image/svg+xml; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
  'Cache-Control': 'public, max-age=300',
};

function svg(body: string, status = 200): Response {
  return new Response(body, { status, headers: HEADERS });
}

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' } });
}

export async function GET(_req: Request, props: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const params = await props.params;
  const parts = Array.isArray(params.path) ? params.path : [];
  if (parts.length < 1 || parts.length > 2 || !parts.every(p => SLUG.test(p))) return notFound();
  const [provider, entry] = parts;
  if (!entry) {
    const r = await publicRead<ProviderPageDTO>(`/marketplace/public/providers/${provider}`, providerTags(provider));
    if (r.kind !== 'ok') return notFound();
    const live = r.data.entries.filter(e => e.status.kind !== 'no_longer_listed');
    const measured = live.filter(e => e.measurement.state === 'measured');
    const last = measured.map(e => e.measurement.lastPublishedDay).filter(Boolean).sort().pop() ?? null;
    if (!measured.length) return svg(badgeSvg('AI Stupid Level', `${r.data.provider.displayName} · listed, not measured yet`, 'muted'));
    return svg(badgeSvg('Measured by AI Stupid Level', `${measured.length} model${measured.length === 1 ? '' : 's'} · ${day(last)}`, 'ok'));
  }
  const r = await publicRead<EntryPageDTO>(`/marketplace/public/providers/${provider}/${entry}`, [...providerTags(provider), `mp:entry:${provider}/${entry}`]);
  if (r.kind !== 'ok') return notFound();
  const e = r.data.entry;
  const model = e.openModel?.name ?? e.upstreamModel;
  const label = `${model} on ${r.data.provider.displayName}`;
  if (e.status.kind === 'measurement_paused' || e.status.kind === 'under_review' || e.status.kind === 'security_check' || e.status.kind === 'suspended') {
    return svg(badgeSvg(label, 'paused', 'warn'));
  }
  const coding = headlineText(e.scores?.headline.coding);
  if (!coding) return svg(badgeSvg(label, e.measurement.state === 'not_measured' ? 'not measured yet' : 'measuring', 'muted'));
  return svg(badgeSvg(label, `coding ${coding} · ${day(e.scores?.headline.coding?.lastDay)}`, 'ok'));
}
