import type { Metadata } from 'next';
import Link from 'next/link';
import { permanentRedirect, notFound } from 'next/navigation';
import VendorPage from '@/components/seo/vendor/VendorPage';
import { isVendorSlug, vendorMetadata } from '@/components/seo/vendor/vendor-meta';
import JsonLd from '@/components/seo/JsonLd';
import { LeaderboardCta, WatchCta } from '@/components/seo/Cta';
import { Rich } from '@/components/seo/pair/Faq';
import { DRIFT_SUITES, detectorState, listJoin, numWord, type DetectorState } from '@/components/seo/worse/worse-data';
import ModelDetailClient from './ModelDetailClient';
import { isNumericId } from '@/lib/model-slug';
import { BOARD_KEYS, standingOnBoard, type BoardKey, type Boards, type Standing } from '@/lib/boards-core';
import { lpBody, lpDisplay } from '@/lib/fonts';
import {
  TITLE_MAX, TITLE_SUFFIX, DESC_MAX, breadcrumbLd, clampDesc, dayLabel, faqLd, graphLd, isoDay, pageMeta, toDate, utcStamp, webPageLd,
} from '@/lib/seo';
import {
  boardLabel, findModel, getBoards24h, getDriftSignature, getPrice, getRoster, lastUpdatedOf, pairSlug, placementOn, placementSentence,
  relatedModels, retiredModelTarget, trendWord, vendorByKey, vendorMention,
  type DriftSignature, type Placement, type PriceSnapshot, type RelatedModels, type SeoBoards, type SeoModel, type Vendor,
} from '@/lib/seo-data';
import '@/styles/landing.css';
import '@/styles/studio.css';
import '@/styles/studio-model-panels.css';

/**
 * /models/<slug>: one model's page. The interactive dashboard (ModelDetailClient) hydrates on
 * top of server-rendered text that search engines and no-JS clients get: a unique title and
 * description, the model's place on the four boards with the leaderboard's own statistical ties,
 * the live state of its three Page-Hinkley drift detectors, and links to its siblings, its
 * closest rivals and each vendor's best. The six vendor segments (/models/openai …) are handed to
 * components/seo/vendor/VendorPage.tsx before anything is resolved as a model.
 *
 * Nothing about a model is typed here: names, counts, scores, places, dates, task counts and
 * detector states are read at render time. The text is the same for everyone: it reads the free
 * 24-hour boards, the drift signature and the last-30-days price snapshot, never a session
 * (no auth(), cookies() or headers()) and never the newest run, which is a paid view the
 * dashboard unlocks on the client (ModelDetailClient) and the API gates. The route renders per
 * request because the dashboard reads the ?track=1 intent through useSearchParams, which a
 * static render would have to wrap in a Suspense boundary; every feed behind the text is cached
 * by next.revalidate in lib/seo-data.ts.
 */
export const dynamic = 'force-dynamic';

const CADENCE = 'coding every four hours, reasoning and tool use daily, with an hourly canary probe';
/** The audit's wording for the description: the schedule the scores on this page follow. */
const CADENCE_DESC = 'coding re-tested every four hours, reasoning and tool use daily, with an hourly drift probe.';
const WINDOW = 'in the last 24 hours';

type ModelStanding = Record<BoardKey, Standing>;
type Places = Record<BoardKey, Placement>;

/** Vendor as people write it: the registry's label, or the API's own string capitalised for a vendor we have no entry for. */
function vendorLabelOf(v: Vendor | undefined, raw: string): string {
  if (v) return v.label;
  const k = String(raw || '').trim();
  return k ? k.charAt(0).toUpperCase() + k.slice(1) : 'AI';
}

/** lib/seo-data's Placement from a boards-core Standing, so a place is phrased the same way everywhere. */
function placementOfStanding(st: Standing, rankedCount: number): Placement {
  if (st.kind === 'absent') {
    return { place: null, joint: false, rankedCount, score: null, se: null, trend: null, status: null, lastUpdated: null, kind: 'absent' };
  }
  const row = st.row;
  const status = (row as unknown as { status?: unknown }).status;
  const base = {
    score: row.score,
    se: typeof row.standardError === 'number' ? row.standardError : null,
    trend: row.trend || null,
    status: typeof status === 'string' ? status : null,
    lastUpdated: row.lastUpdated ?? null,
  };
  if (st.kind === 'ranked') return { place: row.rank, joint: st.tied, rankedCount: st.rankedCount, ...base, kind: 'ranked' };
  return { place: null, joint: false, rankedCount, ...base, kind: 'unranked' };
}

function standingsOf(boards: Boards, id: string): { standings: ModelStanding; places: Places } {
  const standings = {} as ModelStanding;
  const places = {} as Places;
  for (const k of BOARD_KEYS) {
    standings[k] = standingOnBoard(boards[k], id);
    places[k] = placementOfStanding(standings[k], boards[k].ranked.length);
  }
  return { standings, places };
}

/* ───────────────────────── metadata ───────────────────────── */

/**
 * "<Name> benchmark & drift check (October 2026)" when it fits the 60-character title with the
 * site suffix; the short month, then the plain "<Name> benchmark (October 2026)" form, are the
 * fallbacks, so a long model name keeps the month and the search pattern rather than a truncated tag.
 */
function modelTitle(name: string): string {
  // "<Name> benchmark & degradation tracker" for every current name: the two searches people type for
  // a model ("<model> benchmark", "<model> degradation tracker"). pageMeta adds the brand when it fits
  // within 60 characters and drops it when it does not; the shorter forms are for future long names.
  const candidates = [
    `${name} benchmark & degradation tracker`,
    `${name} benchmark & drift tracker`,
    `${name} benchmark`,
  ];
  return candidates.find((c) => c.length <= TITLE_MAX) ?? name.slice(0, TITLE_MAX);
}

/** 120–155 characters, the fullest form that fits; the audit's cadence wording is kept whole. */
function modelDescription(name: string, vendor: string): string {
  const candidates = [
    `${name} by ${vendor}: benchmark score, place, price and drift state — ${CADENCE_DESC}`,
    `${name} (${vendor}): score, place, price and drift — ${CADENCE_DESC}`,
    `${name}: score, place, price and drift — ${CADENCE_DESC}`,
  ];
  return candidates.find((c) => c.length <= DESC_MAX) ?? clampDesc(candidates[candidates.length - 1]);
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  if (isVendorSlug(params.id)) return vendorMetadata(params.id.toLowerCase());
  const roster = await getRoster();
  const model = findModel(roster, params.id);
  if (!model) return { title: { absolute: `Model not found${TITLE_SUFFIX}` }, robots: { index: false, follow: true } };

  const name = model.displayName;
  const vendor = vendorLabelOf(vendorByKey(model.vendor), model.vendor);
  return pageMeta({
    title: modelTitle(name),
    description: modelDescription(name, vendor),
    path: `/models/${model.slug}`,
    keywords: [
      `${name} benchmark`,
      `${name} performance`,
      `${name} review`,
      `${name} vs`,
      `${vendor} ${name}`,
      `is ${name} good for coding`,
      `is ${name} getting worse`,
      `${name} score`,
      `${name} price`,
      `${name} drift`,
    ],
  });
}

/* ───────────────────────── page ───────────────────────── */

export default async function ModelDetailPage({ params }: { params: { id: string } }) {
  // The six vendor pages share this segment and are decided before any model lookup.
  if (isVendorSlug(params.id)) {
    if (params.id !== params.id.toLowerCase()) permanentRedirect(`/models/${params.id.toLowerCase()}`);
    return <VendorPage slug={params.id} />;
  }

  const roster = await getRoster();

  // Graceful degradation: if the API is unreachable there is no roster to resolve against. For a
  // legacy numeric URL, still render the interactive client (it retries on its own); otherwise
  // there is nothing to resolve.
  if (roster.length === 0) {
    if (isNumericId(params.id)) {
      return (
        <ModelDetailClient
          modelId={parseInt(params.id, 10)}
          slug={params.id}
          initialName={params.id}
          initialVendor="AI"
        />
      );
    }
    notFound();
  }

  const model = findModel(roster, params.id);
  if (!model) {
    // A retired model's old numeric address goes to its vendor's page instead of a 404.
    const retired = await retiredModelTarget(params.id);
    if (retired) permanentRedirect(retired);
    notFound();
  }
  const m = model as SeoModel;

  // 308 any non-canonical form — legacy numeric ids and stale slugs — to the slug URL so link
  // equity consolidates on one URL.
  if (params.id !== m.slug) permanentRedirect(`/models/${m.slug}`);

  const vendor = vendorByKey(m.vendor);
  const vendorLabel = vendorLabelOf(vendor, m.vendor);
  const name = m.displayName;
  const path = `/models/${m.slug}`;

  // The free 24-hour boards, the drift signature and the price snapshot (for the suites' task
  // counts): the same three feeds for every visitor, search engines included.
  const [boards24, drift, price] = await Promise.all([getBoards24h(), getDriftSignature(m.id), getPrice()]);

  const standing = boards24 ? standingsOf(boards24.boards, m.id) : null;
  const related = relatedModels(m, roster, boards24);
  const lastUpdated = lastUpdatedOf(boards24, m.id);
  const place24 = boards24 ? placementOn(boards24, 'combined', m.id) : null;

  const h1 = `${name} benchmark and drift check — ${vendorLabel}`;
  const description = modelDescription(name, vendorLabel);
  const content = buildContent({ name, vendor, vendorLabel, model: m, standing, drift, boards24, place24, related, lastUpdated, price });

  const ld = graphLd([
    breadcrumbLd([
      { name: 'Home', path: '/' },
      { name: 'Models', path: '/models' },
      ...(vendor ? [{ name: vendor.label, path: vendor.modelsPath }] : []),
      { name, path },
    ]),
    webPageLd({
      path,
      name: h1,
      description,
      ...(lastUpdated || boards24 ? { dateModified: isoDay(lastUpdated ?? boards24?.generatedAt) } : {}),
      about: {
        '@type': 'SoftwareApplication',
        name,
        applicationCategory: 'AI Language Model',
        operatingSystem: 'Cloud / API',
        description: `${name}, a large language model from ${vendorLabel}, benchmarked by AI Stupid Level.`,
      },
    }),
    faqLd(content.faq),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      {/* The page's one h1 is the visible model name in the dashboard's hero (ModelHero), which is
          server-rendered in the loading state too, so crawlers and screen readers get it. */}
      <ModelDetailClient
        modelId={m.numericId}
        slug={m.slug}
        initialName={m.name}
        initialDisplayName={m.displayName}
        initialVendor={m.vendor || 'AI'}
      />
      <ModelSeoContent
        name={name}
        vendor={vendor}
        vendorLabel={vendorLabel}
        model={m}
        related={related}
        content={content}
      />
    </>
  );
}

/* ───────────────────────── the server-rendered text ───────────────────────── */

const fmtScore = (s: number): string => (Number.isInteger(s) ? String(s) : s.toFixed(1));
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** "95 ± 2.2 out of 100", or "" when the placement has no score. */
function scoreText(p: Placement): string {
  if (p.score === null) return '';
  const se = p.se !== null && Number.isFinite(p.se) ? ` ± ${p.se.toFixed(1)}` : '';
  return `${fmtScore(p.score)}${se} out of 100`;
}

/** Whole days from `from` to `to` (ISO or the API's "YYYY-MM-DD HH:MM:SS"); null when either is missing or `to` is earlier. */
function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = toDate(from).getTime();
  const b = toDate(to).getTime();
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.floor((b - a) / 86_400_000) : null;
}

const SUITE_WORD: Record<string, string> = { deep: 'reasoning', tooling: 'tool-use', hourly: 'coding' };

/**
 * Where the model stands, in the leaderboard's own words: "joint 3rd of the 19 models on the
 * Combined board in the last 24 hours", with "joint" where the lead is inside the measurement.
 */
function standingText(name: string, standing: { standings: ModelStanding; places: Places } | null): string {
  if (!standing) return 'Its scores are in the dashboard above and refresh as new benchmark runs complete.';
  const { standings, places } = standing;
  const combined = standings.combined;
  const pc = places.combined;
  if (combined.kind === 'absent') return 'Its scores are in the dashboard above and refresh as new benchmark runs complete.';

  if (combined.kind === 'community') {
    const suites = combined.row.community.map((s) => SUITE_WORD[s] ?? s);
    const funded: string[] = [];
    for (const k of ['reasoning', 'tooling'] as BoardKey[]) {
      const st = standings[k];
      if (st.kind === 'community' && st.row.score !== null) funded.push(`${k === 'tooling' ? 'tool use' : k} ${fmtScore(st.row.score)}${st.row.when ? ` (last funded run, ${st.row.when})` : ''}`);
    }
    return (
      `${name}'s ${listJoin(suites)} ${suites.length === 1 ? 'test is' : 'tests are'} funded by the community rather than by us, so it is ` +
      `not ranked on the Combined board ${WINDOW}${pc.score !== null ? ` (its figure there, ${fmtScore(pc.score)}, rests on the suites we run ourselves)` : ''}. ` +
      (places.coding.kind === 'ranked' ? `On coding, which we still test every four hours, it is ${placementSentence(places.coding, boardLabel('coding'), WINDOW)}. ` : '') +
      (funded.length ? `Its most recent funded results are ${listJoin(funded)}. ` : '') +
      'Anyone can fund its next reasoning or tool-use run from this page, with their own API key.'
    );
  }

  if (combined.kind === 'ranked') {
    const parts = (['coding', 'reasoning', 'tooling'] as BoardKey[])
      .filter((k) => places[k].kind === 'ranked')
      .map((k) => placementSentence(places[k], boardLabel(k), '').trim());
    return (
      `${name} is ${placementSentence(pc, boardLabel('combined'), WINDOW)}${pc.score !== null ? `, scoring ${scoreText(pc)}` : ''}, ` +
      `and its trend is ${trendWord(pc.trend)}. ` +
      (parts.length ? `On the individual boards it is ${listJoin(parts)}. ` : '') +
      '"Joint" means its lead over, or gap to, the models around it is smaller than the measurement can resolve, so they share the place.'
    );
  }

  return (
    `It is on the Combined board but not ranked ${WINDOW}` +
    (combined.row.staleReason ? ` (${combined.row.staleReason})` : '') +
    '; its scores are shown above.'
  );
}

/**
 * The live drift verdict: each suite's Page-Hinkley detector as the API reports it (armed, fired,
 * or still inside its first days), dated by the signature, then the 24-hour trend from the boards.
 * null when neither feed answered: the method prose stands on its own and nothing is invented.
 */
function driftVerdict(name: string, drift: DriftSignature | null, place24: Placement | null): string | null {
  const out: string[] = [];
  if (drift) {
    const detectors: DetectorState[] = DRIFT_SUITES.map((s) => detectorState(s.key, drift.pageHinkleyBySuite?.[s.key], drift.timestamp));
    const label = (d: DetectorState) => d.label.toLowerCase();
    const fired = detectors.filter((d) => d.kind === 'fired');
    const armed = detectors.filter((d) => d.kind === 'armed');
    const cold = detectors.filter((d) => d.kind === 'cold');
    const none = detectors.filter((d) => d.kind === 'none');
    const days = DRIFT_SUITES.map((s) => drift.pageHinkleyBySuite?.[s.key]?.days).filter((d): d is number => typeof d === 'number' && d > 0);
    const history = days.length ? ` with ${Math.min(...days) === Math.max(...days) ? `${Math.min(...days)}` : `${Math.min(...days)}–${Math.max(...days)}`} days of history on the current tests` : '';

    const stamp = `As of ${utcStamp(drift.timestamp)}`;
    if (fired.length) {
      out.push(`${stamp}, the ${listJoin(fired.map(label))} ${fired.length === 1 ? 'detector has' : 'detectors have'} fired: a sustained decline against ${name}'s own baseline on ${fired.length === 1 ? 'that suite' : 'those suites'}.`);
      if (armed.length) out.push(`The ${listJoin(armed.map(label))} ${armed.length === 1 ? 'detector is' : 'detectors are'} armed with no detection.`);
    } else if (armed.length === detectors.length) {
      out.push(`${stamp}: no sustained decline detected on the coding, reasoning or tool-use suite. All three Page-Hinkley detectors are armed${history}.`);
    } else if (armed.length) {
      out.push(`${stamp}: no sustained decline detected on the ${listJoin(armed.map(label))} suite${armed.length === 1 ? '' : 's'}, where the detector${armed.length === 1 ? ' is' : 's are'} armed${history}.`);
    } else {
      out.push(`${stamp}, no detector has fired.`);
    }
    if (cold.length) out.push(`The ${listJoin(cold.map(label))} detector${cold.length === 1 ? ' is' : 's are'} still in ${cold.length === 1 ? 'its' : 'their'} first ${numWord(cold[0].coldStart)} days of daily results on the current version of the tests and cannot fire yet.`);
    if (none.length && !fired.length && !armed.length && !cold.length) out.push(`The detectors have no baseline for ${name} yet.`);
  }
  if (place24 && place24.kind !== 'absent' && place24.trend) {
    out.push(`On the Combined board over the last 24 hours its trend is ${trendWord(place24.trend)}${place24.score !== null ? `, at ${scoreText(place24)}` : ''}.`);
  }
  return out.length ? out.join(' ') : null;
}

/**
 * "As of 23 Oct 2026, 22:23 UTC (24-hour boards) · tracked since 22 Sep 2026 (31 days) · last
 * re-tested 23 Oct 2026, 22:00 UTC.", with only the parts that exist. The day count is the API's
 * own and is shown only when it agrees with the date it sits next to.
 */
function trackedLine(model: SeoModel, lastUpdated: string | null, asOf: string | null): string | null {
  const bits: string[] = [];
  if (asOf) bits.push(`As of ${utcStamp(asOf)} (24-hour boards)`);
  if (model.createdAt) {
    const since = daysBetween(model.createdAt, asOf);
    const days = model.daysTracked !== null && since !== null && Math.abs(since - model.daysTracked) <= 1 ? model.daysTracked : null;
    bits.push(`tracked since ${dayLabel(model.createdAt)}${days !== null ? ` (${days.toLocaleString('en-US')} days)` : ''}`);
  }
  if (lastUpdated) bits.push(`last re-tested ${utcStamp(lastUpdated)}`);
  return bits.length ? `${cap(bits.join(' · '))}.` : null;
}

interface FaqRow { q: string; a: string }

interface PageContent {
  /** The four questions and their full visible answers; the same strings feed the FAQPage structured data. */
  faq: FaqRow[];
  /** True when the first answer ends with the dated "As of" line (rendered muted). */
  dated: boolean;
  /** True when the drift answer opens with the live verdict (rendered bold). */
  verdict: boolean;
}

/**
 * The page's text. Every answer is one string with blank-line paragraphs and [label](/path)
 * links, rendered by <Answer> and copied into the FAQPage data, so the structured data can never
 * say something the page does not.
 */
function buildContent(p: {
  name: string; vendor: Vendor | undefined; vendorLabel: string; model: SeoModel; standing: { standings: ModelStanding; places: Places } | null;
  drift: DriftSignature | null; boards24: SeoBoards | null; place24: Placement | null; related: RelatedModels; lastUpdated: string | null; price: PriceSnapshot | null;
}): PageContent {
  const { name, vendor, vendorLabel, model, standing, drift, boards24, place24, related, lastUpdated, price } = p;
  const mention = vendor ? vendorMention(vendor) : vendorLabel;
  const family = vendor ? vendor.family : vendorLabel;
  const worseHref = vendor?.worsePath ?? '/is-ai-getting-worse';
  const community = standing?.standings.combined.kind === 'community';
  const tracked = trackedLine(model, lastUpdated, boards24?.generatedAt ?? null);
  const verdict = driftVerdict(name, drift, place24);

  /* ── suite task counts from the price snapshot (never typed) ── */
  const tasks = {
    coding: price?.coding?.tasks ?? null,
    trials: price?.coding?.trials ?? null,
    reasoning: price?.reasoning?.tasks ?? null,
    tooling: price?.tooling?.tasks ?? null,
  };
  const codingIntro = tasks.coding
    ? `: ${numWord(tasks.coding)} tasks${tasks.trials ? `, ${numWord(tasks.trials)} attempts each` : ''}, most of them`
    : ', most of its tasks';
  const reasoningIntro = tasks.reasoning ? `${numWord(tasks.reasoning)} long working sessions` : 'long working sessions';
  const toolingIntro = tasks.tooling ? `${numWord(tasks.tooling)} tasks` : 'tasks';

  /** The days a detector needs before it can fire, as the API states it (ten unless it says otherwise). */
  const coldStart = Math.max(10, ...DRIFT_SUITES.map((s) => drift?.pageHinkleyBySuite?.[s.key]?.coldStart ?? 0));

  /** "Claude Opus 5.5 (95)": the neighbour and its 24-hour Combined score, where it has one. */
  const withScore = (x: SeoModel): string => {
    const pl = boards24 ? placementOn(boards24, 'combined', x.id) : null;
    return pl && pl.score !== null ? `${x.displayName} (${fmtScore(pl.score)})` : x.displayName;
  };
  const nearest = related.nearest.map(withScore);
  const siblings = related.siblings.map(withScore);

  const faq: FaqRow[] = [
    {
      q: `What is the ${name} benchmark score?`,
      a:
        `${name} is a large language model from ${mention}. AI Stupid Level re-tests it on a fixed schedule (${CADENCE}) and publishes a Combined score ` +
        `from 0 to 100: half coding, a quarter reasoning and a quarter tool use, where higher is better. ${standingText(name, standing)} ` +
        `The scores come from our own runs through the provider's public API, not from vendor-reported numbers, so they show how the model behaves as it is served.` +
        (tracked ? `\n\n${tracked}` : ''),
    },
    {
      q: `How is ${name} tested?`,
      a:
        `On the same schedule as every model on the board: ${CADENCE}. The coding suite runs every four hours${codingIntro} real debugging jobs in which the ` +
        `model gets a small working project and a bug report and has to find and fix the fault. It is graded by running the project's own tests, including ` +
        `tests the model never sees, and scored on nine measures led by correctness (60%), with stability, edge cases and debugging at 10% each; complexity ` +
        `and efficiency are scored but carry no weight. The reasoning suite runs daily: ${reasoningIntro}, scored on correctness, recovery after a failed step, ` +
        `and three continuity measures (memory retention, plan coherence and context use) checked by running code against rules stated earlier in the ` +
        `conversation. The tool-use suite runs daily: ${toolingIntro} in sandboxed machines, scored on task completion (30%), tool selection (20%), parameter ` +
        `accuracy, efficiency, error handling, context awareness and safety. A suite that is missing or out of date drops out of the Combined score and the ` +
        `others are reweighted.` +
        (community ? ` For ${name}, the reasoning and tool-use suites run only when a member of the community funds a run; the coding suite runs on our schedule, as for every model.` : '') +
        ` Full details, including every weight, are on the [benchmarking methodology page](/methodology).`,
    },
    {
      q: `Is ${name} getting worse over time?`,
      a:
        (verdict ? `${verdict}\n\n` : '') +
        `This section is ${name}'s degradation tracker, and the question the platform exists to answer. A provider can change a model behind the same API name, and without continuous re-testing that ` +
        `change is invisible to the people relying on it. Each of ${name}'s suites has its own Page-Hinkley (a CUSUM-family test) change-point detector, run on ` +
        `daily results, which separates a sustained decline from ordinary run-to-run noise; it arms after ${numWord(coldStart)} days of daily results on the ` +
        `current version of the tests. An hourly canary of two fixed probes watches for a sudden collapse, tests it against the previous week with Welch's ` +
        `t-test, and records an incident when the fall is large and significant. A Page-Hinkley detection is marked on the chart above and changes ${name}'s ` +
        `status on the drift monitor. If you are wondering whether ${name} has been nerfed, or why it seems dumber lately, see ` +
        `[the current answer for every ${family} model](${worseHref}) and [how AI drift detection works](/ai-drift-detection) for the method.`,
    },
    {
      q: `How does ${name} compare with other models?`,
      a:
        (nearest.length ? `Closest to ${name} on the Combined board in the last 24 hours: ${listJoin(nearest)}, each with a head-to-head page. ` : '') +
        (siblings.length ? `Other ${vendorLabel} models on the board: ${listJoin(siblings)}. ` : '') +
        `Every model gets the same tasks on the same schedule, so places are comparable across vendors. Each pair page puts both models on the four boards ` +
        `with the leaderboard's statistical ties, list price per 1M tokens, cost per correct result over the last 30 days and drift state; the full boards ` +
        `are on the leaderboard.`,
    },
  ];
  return { faq, dated: !!tracked, verdict: !!verdict };
}

/** An answer's paragraphs, [label](/path) links as anchors. `boldFirst` sets the opening paragraph bold, `muteLast` the closing one small. */
function Answer({ text, boldFirst = false, muteLast = false }: { text: string; boldFirst?: boolean; muteLast?: boolean }) {
  const paras = text.split(/\n{2,}/);
  return (
    <>
      {paras.map((para, i) => {
        if (boldFirst && i === 0 && paras.length > 1) return <p key={i}><b><Rich text={para} /></b></p>;
        const mute = muteLast && paras.length > 1 && i === paras.length - 1;
        return <p key={i} className={mute ? 'sq-about-when' : undefined}><Rich text={para} /></p>;
      })}
    </>
  );
}

/* The few rules the rows below need that studio-model-panels.css does not have: link chips, the
   dated line and a CTA that keeps its button colours inside a row whose links are accent-coloured.
   The button and the chips wrap: a long model name ("Get an email when Gemini 3.5 Flash Lite
   changes") must never push a phone's layout wider than the screen. */
const ROW_CSS = `
.st .sq-about-a > * + * { margin-top: 14px; }
.st .sq-about-row p.sq-about-when { font-size: 13.5px; line-height: 1.5; color: var(--lp-fg3); font-variant-numeric: tabular-nums; }
.st .sq-about-row .sq-about-h { margin: 18px 0 8px; font-size: 12.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--lp-fg3); }
.st .sq-about-links { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; max-width: 100%; }
.st .sq-about-links li { min-width: 0; max-width: 100%; }
.st .sq-about-row .sq-about-links a { display: inline-flex; align-items: center; min-height: 36px; max-width: 100%; padding: 6px 12px; border: 1px solid var(--lp-line2); border-radius: 999px; color: var(--lp-fg) !important; font-size: 14px; font-weight: 500; line-height: 1.3; text-decoration: none; white-space: normal; }
.st .sq-about-row .sq-about-links a:hover { border-color: var(--lp-accent); color: var(--lp-accent) !important; }
.st .sq-about-row .sq-about-cta { margin-top: 20px; }
.st .sq-about-row .sq-about-cta .seo-cta { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; justify-items: start; min-width: 0; }
.st .sq-about-row .sq-about-cta a.lp-btn { box-sizing: border-box; max-width: 100%; min-width: 0; height: auto; min-height: 44px; padding: 10px 20px; white-space: normal; text-align: center; line-height: 1.3; text-decoration: none; font-weight: 600; }
.st .sq-about-row .sq-about-cta a.lp-btn-primary { color: var(--lp-on-accent) !important; }
.st .sq-about-row .sq-about-cta a.lp-btn-ghost { color: var(--lp-fg) !important; }
.st .sq-about-row .sq-about-cta p { font-size: 13.5px; line-height: 1.5; color: var(--lp-fg3); max-width: 46ch; }
@media (max-width: 760px) { .st .sq-about-row .sq-about-cta .seo-cta { justify-items: stretch; } .st .sq-about-row .sq-about-cta a.lp-btn { width: 100%; } }
`;

function LinkChips({ items, label }: { items: { href: string; text: string }[]; label: string }) {
  if (!items.length) return null;
  return (
    <ul className="sq-about-links" aria-label={label}>
      {items.map((it) => <li key={it.href}><Link href={it.href}>{it.text}</Link></li>)}
    </ul>
  );
}

/**
 * The editorial block beneath the dashboard, in the landing's FAQ style: display-face questions
 * on the left, answers at reading width on the right, ruled between. The four questions and
 * their answers are the page's FAQ (the same strings feed the FAQPage structured data above);
 * the link chips, the closing paragraph and the calls to action sit after the answers.
 */
function ModelSeoContent({ name, vendor, vendorLabel, model, related, content }: {
  name: string;
  vendor: Vendor | undefined;
  vendorLabel: string;
  model: SeoModel;
  related: RelatedModels;
  content: PageContent;
}) {
  const { faq } = content;
  const siblingChips = related.siblings.map((x) => ({ href: `/models/${x.slug}`, text: x.displayName }));
  const nearestChips = related.nearest.map((x) => ({ href: `/compare/${pairSlug(model, x)}`, text: `${name} vs ${x.displayName}` }));
  const flagshipChips = related.flagships.map((x) => ({ href: `/compare/${pairSlug(model, x)}`, text: `${name} vs ${x.displayName}` }));

  return (
    <section className={`st st-page sq-about ${lpBody.variable} ${lpDisplay.variable}`}>
      <style dangerouslySetInnerHTML={{ __html: ROW_CSS }} />
      <div className="sq-about-in">
        <p className="st-kicker">About this page</p>
        <div className="sq-about-list">
          <div className="sq-about-row">
            <h2>{faq[0].q}</h2>
            <div className="sq-about-a">
              <Answer text={faq[0].a} muteLast={content.dated} />
            </div>
          </div>

          <div className="sq-about-row">
            <h2>{faq[1].q}</h2>
            <div className="sq-about-a">
              <Answer text={faq[1].a} />
            </div>
          </div>

          <div className="sq-about-row">
            <h2>{faq[2].q}</h2>
            <div className="sq-about-a">
              <Answer text={faq[2].a} boldFirst={content.verdict} />
              <div className="sq-about-cta">
                <WatchCta slug={model.slug} cta="model-worse-watch" label={`Get an email when ${name} changes →`} />
              </div>
            </div>
          </div>

          <div className="sq-about-row">
            <h2>{faq[3].q}</h2>
            <div className="sq-about-a">
              <Answer text={faq[3].a} />
              {siblingChips.length > 0 && (
                <>
                  <p className="sq-about-h">Other {vendorLabel} models we track</p>
                  <LinkChips label={`Other ${vendorLabel} models`} items={[...siblingChips, ...(vendor ? [{ href: vendor.modelsPath, text: `All ${vendorLabel} models →` }] : [])]} />
                </>
              )}
              {nearestChips.length > 0 && (
                <>
                  <p className="sq-about-h">Closest on the same tests</p>
                  <LinkChips label={`Models closest to ${name}`} items={nearestChips} />
                </>
              )}
              {flagshipChips.length > 0 && (
                <>
                  <p className="sq-about-h">Against each vendor&apos;s best</p>
                  <LinkChips label={`${name} against each vendor's best-placed model`} items={flagshipChips} />
                </>
              )}
              <p>
                {vendor && <><Link href={vendor.modelsPath}>Every {vendorLabel} model on the board</Link>, </>}
                <Link href="/compare">every model family compared</Link>, <Link href="/best-llm-for-coding">the best LLM for coding</Link>,{' '}
                <Link href="/best-ai-model-for-agents">the best AI model for agents</Link>
                {vendor && <> and <Link href={vendor.statusPath}>{vendorLabel} API status</Link></>}.
                Sign in and star {name} to add it to your watchlist: it then appears at the top of the leaderboards with its place on
                each board, and we email you if its coding score falls five points or more in a week, plus a weekly summary of
                what changed.
              </p>
              <div className="sq-about-cta">
                <LeaderboardCta cta="model-compare-leaderboard" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
