import { auth } from '@/auth';
import { DIRECTORY_PATH, marketplacePublicOpen } from '@/lib/marketplace-open';

/**
 * Server-side reads of the API's public marketplace DTOs (GET /marketplace/public/*, Phase 3 plan §4.9, §5.9).
 *
 * - The public answer is the same for everyone: fetched over loopback with `next: { revalidate: 60, tags }`, so a
 *   change reaches every page within 60 s even when the API's revalidate call is lost, and at once when it is not
 *   (POST /api/internal/revalidate runs revalidateTag on these tags).
 * - While provider pages are a staff preview (ASL_MARKETPLACE=staff, M1–M9), the public answer is empty. A
 *   signed-in visitor is then asked about again, uncached, with the internal token and their user id: the API
 *   shows the page only to staff accounts, marked as a preview. Nobody else learns anything (the site's 404).
 * - A per-slug public read is made only while the API's public gate is open (lib/marketplace-open.ts, one cached
 *   read): otherwise its answer is "unavailable" without a fetch, so made-up slugs leave nothing in the data cache.
 */
const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

export type Read<T> = { kind: 'ok'; data: T; preview: boolean } | { kind: 'unavailable' } | { kind: 'not_found' } | { kind: 'error' };

async function get<T>(path: string, init: RequestInit & { next?: { revalidate: number; tags: string[] } }): Promise<Read<T>> {
  try {
    const r = await fetch(`${API_URL}${path}`, { ...init, signal: AbortSignal.timeout(4_000) });
    if (r.status === 404) return { kind: 'not_found' };
    if (!r.ok) return { kind: 'error' };
    const j = await r.json().catch(() => null) as { success?: boolean; data?: T | null; unavailable?: boolean; notFound?: boolean; staffPreview?: boolean } | null;
    if (!j?.success) return { kind: 'error' };
    // The API answers "not found" as a 200 (routes/marketplace-public.ts, dto()), so this cache replaces a page that
    // stopped being public within 60 s: Next keeps only 200 answers and would serve the old one again after a 404.
    if (j.notFound === true) return { kind: 'not_found' };
    if (j.unavailable || j.data === null || j.data === undefined) return { kind: 'unavailable' };
    return { kind: 'ok', data: j.data, preview: j.staffPreview === true };
  } catch {
    return { kind: 'error' };
  }
}

export async function publicRead<T>(path: string, tags: string[]): Promise<Read<T>> {
  // Closed (a staff preview, the kill switch): every slug's public answer is the same "unavailable" (M5 review SHOULD-3).
  if (path !== DIRECTORY_PATH && (await marketplacePublicOpen()) === 'closed') return { kind: 'unavailable' };
  return get<T>(path, { next: { revalidate: 60, tags } });
}

async function previewRead<T>(path: string, userId: string): Promise<Read<T>> {
  const token = process.env.ROUTER_INTERNAL_TOKEN;
  if (!token || !/^[0-9]{1,15}$/.test(userId)) return { kind: 'unavailable' };
  return get<T>(path, { cache: 'no-store', headers: { 'x-internal-token': token, 'x-asl-viewer': userId } });
}

/**
 * A fleet model page's "Hosted by other providers" pane (§7.5): the public answer; while that is empty, the staff
 * preview only for a session that already belongs to a provider account (the session's `provider`, set only for
 * accounts the API lets into provider pages), so no other visitor's model page makes a second call.
 */
export async function fleetHostsRead(fleetModelId: number): Promise<Read<FleetHostsDTO>> {
  const path = `/marketplace/public/fleet-models/${fleetModelId}/hosts`;
  const pub = await publicRead<FleetHostsDTO>(path, ['mp:directory', `mp:fleet:${fleetModelId}`]);
  if (pub.kind === 'ok' || pub.kind === 'error') return pub;
  const session = await auth().catch(() => null);
  const id = session?.user?.id ? String(session.user.id) : null;
  if (!id || !(session?.user as { provider?: unknown } | undefined)?.provider) return pub;
  return previewRead<FleetHostsDTO>(path, id);
}

/** The public answer, else (signed in, while it is empty or unknown) the staff preview. */
export async function marketplaceRead<T>(path: string, tags: string[]): Promise<Read<T>> {
  const pub = await publicRead<T>(path, tags);
  if (pub.kind === 'ok' || pub.kind === 'error') return pub;
  const session = await auth().catch(() => null);
  const id = session?.user?.id ? String(session.user.id) : null;
  if (!id) return pub;
  const staff = await previewRead<T>(path, id);
  return staff.kind === 'ok' ? staff : pub;
}

// ── The DTO shapes (marketplace/public-read.ts in the API) ─────────────────────────────────────

export interface Measurement { state: 'not_measured' | 'measuring' | 'measured'; publishedDays: number; runs: number; lastPublishedDay: string | null;
  /** F5b (web review SHOULD-4): `fresh: true` on a day on fresh task versions (a suite's own; Combined's when any of its suites' is). */
  daily: Array<{ day: string; suite: string; mean: number; runs: number; fresh?: true }> }
export interface EntryDTO {
  publicId: string; entrySlug: string; path: string; mpId: string; label: string;
  openModel: { slug: string; name: string; maker: string; licence: string | null; weightsUrl: string | null; paramsB: number | null; activeParamsB: number | null; contextTokens: number | null; fleetModelId: number | null } | null;
  precision: string; precisionLabel: string; precisionNote: string | null; upstreamModel: string; contextTokens: number; maxOutputTokens: number;
  price: { inPerMTok: number; outPerMTok: number; cachedInPerMTok: number | null; checkedAt: string | null };
  regions: string[]; rateLimits: string | null; modelUrl: string | null;
  status: { kind: string; text: string; since: string | null };
  measurement: Measurement; scores?: PublishedScores; notes: { outputLimit: number | null; refusedParameters: string[] };
  routerEnabled: boolean; publishedAt: string | null; delistedAt: string | null; noindex: boolean; chartSlot: number | null;
  /** M8 (§8.7): the host's live offers for this model; absent from an API before M8. */
  offers?: OfferDTO[];
}
/** M8 (§8.7): an offer a host makes, display only, with the disclosure line the API words. */
export interface OfferDTO {
  id: number; kind: string; kindLabel: string; title: string; details: string | null; code: string | null; percent: number | null;
  termsUrl: string; endsAt: string | null; listingId: number | null; disclosure: string;
}
/** Published days only (M6b): the headline mean ± SE per suite, coverage counts, speed, availability, drift, completion. */
/** `se` is null where the API withholds it (a set of runs whose spread would give single runs' scores; M10). */
export interface Headline { mean: number; se: number | null; runs: number; lastDay: string | null }
export interface PublishedScores {
  headline: { combined: Headline | null; coding: Headline | null; reasoning: Headline | null; tooling: Headline | null; canary: Headline | null };
  measuring: { runs: number; of: number } | null;
  coverage: Partial<Record<'coding' | 'reasoning' | 'tooling' | 'canary', string>>;
  /** M7: from the spot runs of the newest published calendar month (an ordinary customer key) when there is one, else the benchmark key's runs. */
  speed: { ttftP50Ms: number | null; outputTpsP50: number | null; source: 'benchmark_key' | 'spot'; runs: number; month?: string } | null;
  /** M7: the newest published month of spot checks (published once a month for the month before, never right after a check). */
  spotChecks?: import('./marketplace-spot').SpotMonth | null;
  availability: { apiReachability: number | null; checks: number; inferenceAvailability: number | null; probes: number; days: number };
  drift: Partial<Record<'coding' | 'reasoning' | 'tooling' | 'canary', string>>;
  completion: { completed: number; total: number; days: number } | null;
  publishedDays: number;
  /** F5: per suite whose series broke when the listing moved to fresh task versions, until 3 runs are published; absent otherwise. */
  remeasuring?: Partial<Record<'coding' | 'reasoning' | 'tooling' | 'canary', { runs: number; of: number }>>;
}
export const headlineText = (h: Headline | null | undefined) => (h ? (h.se === null ? `${h.mean}` : `${h.mean} ± ${h.se.toFixed(1)}`) : null);

export interface Declaration {
  version: number; promptsRetention: string; retentionDays: number | null; trainingUse: string; logContents: string | null; processingRegions: string[];
  subprocessors: string[]; certifications: string[]; privacyUrl: string | null; termsUrl: string | null; dpaUrl: string | null; declaredAt: string;
}
export interface PublicProvider {
  slug: string; kind: 'company' | 'individual'; displayName: string; operatedBy: string | null; country: string | null; standing: string;
  website: string | null; pricingUrl: string | null; getKeyUrl: string | null; docsUrl: string | null; statusUrl: string | null; support: string | null;
  about: string | null; foundedYear: number | null; hqCity: string | null; regions: string[]; x: string | null; linkedin: string | null; github: string | null;
  logoSha256: string | null; publishedAt: string | null; domains: Array<{ domain: string; since: string }>; logoUrl: string | null;
}
export interface ProviderPageDTO { provider: PublicProvider; entries: EntryDTO[]; offers?: OfferDTO[]; declaration: Declaration | null; health: { endpoints: number; up: number; checkedAt: string | null }; noindex: boolean; staffPreview: boolean; internal: boolean;
  /** M9b (D-C7): a listing on this page has a published spot month among the recent ones; missing reads as false. */
  spotPractice?: boolean }
/** The directory (GET /marketplace/public/providers); M9b: `spotPractice`, fleet-wide, for the ranking criteria page. */
export interface DirectoryDTO { providers: unknown[]; spotPractice?: boolean; /** F6: sent only with spotPractice while fresh task versions are in use or announced. */ spotOnFresh?: boolean }
export type PaneSuite = 'combined' | 'coding' | 'reasoning' | 'tooling' | 'canary';
/** M10 (design D-A2): one host's number beside the official API's for one suite, both on that host's own tests and days. */
export interface VsOfficialLine { official: { mean: number; se: number; runs: number }; delta: number; tied: boolean }
/**
 * F5 (design D-A2 "After the move"): a host on fresh copies, compared through its model's calibration: the official API's
 * number on the standard tasks over the host's days, no tie verdict (the tests differ), and the calibration's margin.
 */
export interface VsOfficialCalibrated { basis: 'standard_tasks'; official: { mean: number; se: number; runs: number }; margin: number }
export type VsOfficial = Partial<Record<PaneSuite, VsOfficialLine | VsOfficialCalibrated | null>>;
export const isCalibrated = (x: VsOfficialLine | VsOfficialCalibrated | null | undefined): x is VsOfficialCalibrated => !!x && (x as VsOfficialCalibrated).basis === 'standard_tasks';
/** M10: `vsOfficial` only where the API sends a comparison (older APIs and the zero-host pane: absent). */
export interface HostRow { provider: { slug: string; displayName: string; logoUrl: string | null }; entry: EntryDTO; vsOfficial?: VsOfficial | null }
/** M10 (D-A1): the official API's reference row on a fleet model's page: a label with no number, sent only beside a line. */
export interface OfficialRef { label: string; vendor: string; model: { id: number; name: string; displayName: string } }
export interface EntryPageDTO { provider: PublicProvider; entry: EntryDTO; otherHosts: HostRow[]; declaration: Declaration | null; staffPreview: boolean }
export interface OpenModelPageDTO { openModel: NonNullable<EntryDTO['openModel']>; hosts: HostRow[]; vendorLine: null; comparable: boolean; reason: string | null; staffPreview: boolean; noindex: boolean }
/** M9 (§7.5): `suites`, the API's per-suite comparability (public form only); host scores exist only for passing suites. */
export interface FleetHostsDTO {
  openModels: Array<{ slug: string; name: string }>; hosts: HostRow[]; comparable: boolean; reason: string | null;
  suites?: Partial<Record<'combined' | 'coding' | 'reasoning' | 'tooling' | 'canary', { comparable: boolean; reason: string | null }>> | null;
  /** M10: present only where some host has a comparison line (older APIs, zero hosts and failing suites: absent). */
  official?: OfficialRef | null;
  /** F5: present only where a host on fresh copies has a calibrated line: the model's name and each suite's margin. F5b
   *  (code review MINOR-12): `families` too when two or more open models of the fleet model have such lines, one each. */
  calibrated?: { model: string; margins: Partial<Record<PaneSuite, number>>; families?: Array<{ model: string; margins: Partial<Record<PaneSuite, number>> }> } | null;
}
export interface AgreementDTO { version: string; title: string; body: string; bodySha256: string; state: string; legalReview: string; effectiveAt: string | null; publishedAt: string | null; versions: Array<{ version: string; state: string; effectiveAt: string | null; publishedAt: string | null }> }

export const providerTags = (slug: string) => [`mp:provider:${slug}`, 'mp:directory'];

/** Provider-given URLs are rendered only when they are https (the API checked their host at save). */
export function safeHttps(u: string | null | undefined): string | null {
  if (!u) return null;
  try { const x = new URL(u); return x.protocol === 'https:' ? x.toString() : null; } catch { return null; }
}

export const usd = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? `$${n.toFixed(n < 1 ? 3 : 2)}` : '—');
export const tokens = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? (n >= 1000 ? `${Math.round(n / 1000)}K` : String(n)) : '—');
export const longDay = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');


// ── F7 (Phase 4 §6.4, Phase 3 §7.7): user-run tests of listed hosts, the public rows ──────────────────────────────
export type UserTestSuite = 'coding' | 'reasoning' | 'tooling';
/** One row: a host's tests of one suite (reasoning: of one scenario, by anonymous index). Independent testers only in the median. */
export interface PublicUserTestRow {
  listing: string; suite: UserTestSuite; scenario: number | null; scenarios: number | null;
  median: number | null; min: number | null; max: number | null; runs: number; testers: number;
  named: string[]; unnamedRuns: number; providerRuns: number; providerMedian: number | null; latest: string;
  host: { slug: string; displayName: string; logoUrl: string | null }; entry: { label: string; path: string };
}
export interface PublicUserTestsDTO { enabled: boolean; note: string; rows: PublicUserTestRow[]; testable: boolean }

/** The rows of an entry, an open model or a fleet model (absent before F7's API: not_found, so nothing renders). */
export function userTestsRead(scope: { entry: [string, string] } | { openModel: string } | { fleetModel: number }): Promise<Read<PublicUserTestsDTO>> {
  if ('entry' in scope) {
    const [p, e] = scope.entry;
    return marketplaceRead<PublicUserTestsDTO>(`/marketplace/public/user-tests/entry/${p}/${e}`, [...providerTags(p), `mp:entry:${p}/${e}`]);
  }
  if ('openModel' in scope) return marketplaceRead<PublicUserTestsDTO>(`/marketplace/public/user-tests/open-model/${scope.openModel}`, [`mp:openmodel:${scope.openModel}`, 'mp:directory']);
  return marketplaceRead<PublicUserTestsDTO>(`/marketplace/public/user-tests/fleet-model/${scope.fleetModel}`, [`mp:fleet:${scope.fleetModel}`, 'mp:directory']);
}
