import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReadingPage, RdSection, RdProse, RdFacts, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { ScoreTable, type ScoreTableRow } from '@/components/seo/ScoreTable';
import { AsOf, Verdict } from '@/components/seo/Verdict';
import { CtaRow, LeaderboardCta, RouterCta, WatchCta } from '@/components/seo/Cta';
import { PLANS } from '@/lib/entitlements';
import type { BoardKey } from '@/lib/boards-core';
import { breadcrumbLd, dayLabel, faqLd, graphLd, isoDay, itemListLd, toDate, utcStamp, webPageLd } from '@/lib/seo';
import {
  VENDORS, boardLabel, byDisplayName, getBoards24h, getPrice, getProviders, getRoster, hourCells, listPrice,
  modelsOfVendor, ordinal, pairSlug, placementOn, placementSentence, providerStatusOf, relatedModels,
  vendorByKey, vendorMention,
  type Placement, type ProviderStatus, type SeoBoards, type SeoModel, type Vendor,
} from '@/lib/seo-data';
import { VENDOR_COPY, isVendorSlug, vendorDescription, vendorH1, worsePathOf } from './vendor-meta';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';

/**
 * /models/<vendor>: one vendor's models on the same tests, server-rendered from the 24-hour
 * boards, the roster, the provider probe and the price snapshot (lib/seo-data.ts). Rendered by
 * app/models/[id]/page.tsx when the segment is a vendor key, before it resolves a model slug.
 *
 * Every model name, count, score, place, price and uptime on the page is read from the API at
 * render time; the static copy names only the vendor and its family. Places come from
 * lib/boards-core through placementOn, so a "joint 3rd" here is the leaderboard's "=3".
 * When a feed is down the prose stays and the table, facts or figures that needed it are
 * left out: nothing is invented and no placeholder is shown.
 */

const FREE = PLANS.free;
const SUITES: BoardKey[] = ['coding', 'reasoning', 'tooling'];
const n = (x: number) => x.toLocaleString('en-US');
/** "an OpenAI model", "a Claude model". */
const an = (word: string): string => (/^[aeiou]/i.test(word) ? 'an' : 'a');

/** Whole days from `from` to `to`; null when either is missing or `to` is earlier. */
function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = toDate(from).getTime();
  const b = toDate(to).getTime();
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.floor((b - a) / 86_400_000) : null;
}

/** "$2", "$0.10", "$1.32", "$0.075": the list price per 1M tokens as the pricing table writes it. */
function usd(x: number): string {
  if (Number.isInteger(x)) return `$${n(x)}`;
  const cents = Math.round(x * 100);
  return Math.abs(cents - x * 100) < 1e-9 ? `$${x.toFixed(2)}` : `$${x.toFixed(3)}`;
}

const fmtScore = (s: number): string => (Number.isInteger(s) ? String(s) : s.toFixed(1));

/** "95 ± 2.2", or "" when the placement has no score. */
function scoreText(p: Placement): string {
  if (p.score === null) return '';
  return p.se !== null && Number.isFinite(p.se) ? `${fmtScore(p.score)} ± ${p.se.toFixed(1)}` : fmtScore(p.score);
}

/** "=2" / "7" / "not ranked": the place as the leaderboard prints it. */
function placeMark(p: Placement): string {
  return p.kind === 'ranked' && p.place !== null ? `${p.joint ? '=' : ''}${p.place}` : 'not ranked';
}

const pct = (u: number): string => `${Number.isInteger(u) ? u : u.toFixed(1)}%`;

const STATE_TEXT: Record<ProviderStatus['status'], string> = {
  operational: 'Answering',
  degraded: 'Slow',
  down: 'Not answering',
  unmeasured: 'Not measured',
};
const STATE_PILL: Record<ProviderStatus['status'], string> = { operational: 'ok', degraded: 'warn', down: 'bad', unmeasured: 'na' };
/** Past tense for the FAQ answer ("was answering our probe"). */
const STATE_PAST: Record<ProviderStatus['status'], string> = {
  operational: 'was answering our probe',
  degraded: 'was answering our probe slowly',
  down: 'was not answering our probe',
  unmeasured: 'could not be measured from our side',
};

/** "[label](/path)" to links, so one string feeds the page and the FAQ structured data. */
function Rich({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<Link key={m.index} href={m[2]}>{m[1]}</Link>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

function Answer({ text }: { text: string }) {
  return <>{text.split(/\n{2,}/).map((p, i) => <p key={i}><Rich text={p} /></p>)}</>;
}

/** The two slugs' models in the pair page's (canonical, slug-sorted) order. */
const pairOrder = (a: SeoModel, b: SeoModel): [SeoModel, SeoModel] => (a.slug <= b.slug ? [a, b] : [b, a]);

const TOC_BASE = [
  { id: 'scores', label: 'Scores' },
  { id: 'models', label: 'Models tracked' },
  { id: 'coding', label: 'Best for coding' },
  { id: 'reasoning', label: 'Best for reasoning' },
  { id: 'agents', label: 'Best for agents' },
  { id: 'status', label: 'API status' },
  { id: 'worse', label: 'Getting worse?' },
  { id: 'compare', label: 'Compare' },
  { id: 'how', label: 'How we test' },
  { id: 'faq', label: 'FAQ' },
];

export default async function VendorPage({ slug }: { slug: string }): Promise<JSX.Element> {
  const v: Vendor | undefined = isVendorSlug(slug) ? vendorByKey(slug) : undefined;
  if (!v) notFound();
  const vendor = v as Vendor;
  const copy = VENDOR_COPY[vendor.key];
  const { name } = copy;
  /** "Moonshot AI (Kimi)" and "Z.ai (GLM)" as the owner writes them; the other four by their label. */
  const companyOf = (x: Vendor): string => (x.key === 'kimi' || x.key === 'glm' ? vendorMention(x) : x.label);
  const mention = companyOf(vendor);
  const worsePath = worsePathOf(vendor);

  const [roster, boards, providers, price] = await Promise.all([getRoster(), getBoards24h(), getProviders(), getPrice()]);

  /* ── the vendor's models, in Combined board order, then any on no board by name ── */
  const mine = modelsOfVendor(roster, vendor.key);
  const byId = new Map(mine.map((m) => [m.id, m] as const));
  const ordered: SeoModel[] = [];
  if (boards) {
    const b = boards.boards.combined;
    for (const row of [...b.ranked, ...b.community, ...b.other]) {
      const m = byId.get(row.id);
      if (m && !ordered.includes(m)) ordered.push(m);
    }
  }
  for (const m of [...mine].sort(byDisplayName)) if (!ordered.includes(m)) ordered.push(m);
  const onBoard = boards ? ordered.filter((m) => !!boards.byId[m.id]) : [];
  const count = onBoard.length;
  const plural = count === 1 ? 'model' : 'models';

  /** The vendor's ranked models on one board, best place first (board order), with placements. */
  const rankedOn = (b: SeoBoards, key: BoardKey): Array<{ m: SeoModel; p: Placement }> => {
    const out: Array<{ m: SeoModel; p: Placement }> = [];
    for (const row of b.boards[key].ranked) {
      const m = byId.get(row.id);
      if (m) out.push({ m, p: placementOn(b, key, m.id) });
    }
    return out;
  };
  const bestOn = (key: BoardKey) => (boards ? rankedOn(boards, key)[0] ?? null : null);
  const bestC = bestOn('combined');
  const bestCoding = bestOn('coding');
  const bestReasoning = bestOn('reasoning');
  const bestTooling = bestOn('tooling');
  const secondOn = (key: BoardKey) => (boards ? rankedOn(boards, key)[1] ?? null : null);
  const secondC = secondOn('combined');

  /* ── verdict and trend sentence ── */
  const verdict = count > 0
    ? `${count} ${name} ${plural} ${count === 1 ? 'is' : 'are'} on the board.` +
      (bestC ? ` The best placed is ${bestC.m.displayName}, ${placementSentence(bestC.p, boardLabel('combined'))}.` : '')
    : null;

  let trendSentence = '';
  if (boards && count > 0) {
    const trends = onBoard.map((m) => placementOn(boards, 'combined', m.id)).filter((p) => p.kind !== 'absent').map((p) => p.trend);
    const up = trends.filter((t) => t === 'up').length;
    const down = trends.filter((t) => t === 'down').length;
    const steady = trends.length - up - down;
    const parts: string[] = [];
    if (steady) parts.push(`${steady} ${steady === 1 ? 'is' : 'are'} holding steady`);
    if (up) parts.push(`${up} ${up === 1 ? 'is' : 'are'} improving`);
    if (down) parts.push(`${down} ${down === 1 ? 'is' : 'are'} declining`);
    if (trends.length) {
      trendSentence = `On the Combined board over the last 24 hours, of the ${trends.length} ${name} ${trends.length === 1 ? 'model' : 'models'} with a current score, ${parts.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`;
    }
  }

  /* ── the score table: Combined as the main columns, the three suites as extra columns ── */
  const rows: ScoreTableRow[] = boards
    ? onBoard.map((m) => {
      const c = placementOn(boards, 'combined', m.id);
      const extra: Record<string, string> = {};
      for (const k of SUITES) {
        const p = placementOn(boards, k, m.id);
        if (p.kind === 'absent' || p.score === null) continue;
        extra[boardLabel(k)] = `${fmtScore(p.score)} (${placeMark(p)})`;
      }
      return {
        name: m.displayName,
        slug: m.slug,
        vendor: vendor.label,
        score: c.score,
        se: c.se,
        place: c.kind === 'ranked' ? c.place : null,
        joint: c.kind === 'ranked' && c.joint,
        trend: c.trend,
        extra,
      };
    })
    : [];

  /* ── per-model facts ── */
  const modelFacts: [ReactNode, ReactNode][] = ordered.map((m) => {
    const bits: string[] = [];
    if (m.createdAt) {
      // The API's day count is shown only when it agrees with the date it sits next to.
      const since = daysBetween(m.createdAt, boards?.generatedAt ?? null);
      const days = m.daysTracked !== null && since !== null && Math.abs(since - m.daysTracked) <= 1 ? m.daysTracked : null;
      bits.push(`Tracked since ${dayLabel(m.createdAt)}${days !== null ? ` (${n(days)} days)` : ''}.`);
    }
    const lp = listPrice(m);
    if (lp) bits.push(`List price ${usd(lp.input)} per 1M input tokens and ${usd(lp.output)} per 1M output tokens.`);
    if (boards) {
      const c = placementOn(boards, 'combined', m.id);
      if (c.kind === 'ranked' && c.place !== null) {
        const s = placementSentence(c, boardLabel('combined'));
        bits.push(`${s.charAt(0).toUpperCase()}${s.slice(1)}${c.score !== null ? `, scoring ${scoreText(c)}` : ''}.`);
      } else if (c.kind === 'unranked') {
        bits.push(`On the Combined board but not ranked in the last 24 hours${c.score !== null ? ` (score ${scoreText(c)})` : ''}.`);
      }
    }
    return [<Link key={m.slug} href={`/models/${m.slug}`}>{m.displayName}</Link>, bits.join(' ')];
  });

  /* ── pair links: every pair among the six best placed, the rest against the best ── */
  const pairs = new Map<string, [SeoModel, SeoModel]>();
  const top = ordered.slice(0, 6);
  for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) pairs.set(pairSlug(top[i], top[j]), pairOrder(top[i], top[j]));
  for (const m of ordered.slice(6)) if (ordered[0]) pairs.set(pairSlug(ordered[0], m), pairOrder(ordered[0], m));
  const samePairs = Array.from(pairs.entries());
  const flag = bestC ? relatedModels(bestC.m, roster, boards).flagships : [];
  const crossPairs = bestC ? flag.map((f) => [pairSlug(bestC.m, f), pairOrder(bestC.m, f)] as const) : [];
  const otherVendors = VENDORS.filter((x) => x.key !== vendor.key);

  /* ── provider status ── */
  const ps = providerStatusOf(providers, vendor.key);
  const interval = providers?.meta.checkIntervalMinutes ?? null;
  const retention = providers?.meta.retentionDays ?? null;
  const probe = providers?.meta.probe?.trim() || 'One short completion on our own key, from one machine.';
  const historyWord = retention ? `The ${retention}-day history` : 'The full history';
  const OTHERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const cells = ps ? hourCells(ps) : '';
  const statusFacts: [ReactNode, ReactNode][] = [];
  if (ps) {
    statusFacts.push(['Status', <><span className={`lp-pill ${STATE_PILL[ps.status]}`}>{STATE_TEXT[ps.status]}</span>{ps.status === 'unmeasured' ? ' The check could not be made from our side, so it says nothing about the provider.' : ''}</>]);
    const answered: string[] = [];
    if (ps.uptime24h !== null) answered.push(`${pct(ps.uptime24h)} of checks in the last 24 hours`);
    if (ps.uptime7d !== null) answered.push(`${pct(ps.uptime7d)} over the last 7 days`);
    if (answered.length) statusFacts.push(['Answered', answered.join(' · ')]);
    const lat = ps.medianLatencyMs ?? ps.responseTime;
    if (lat !== null && Number.isFinite(lat)) statusFacts.push(['Median response', `${n(Math.round(lat))} ms to one short completion on our own key`]);
    if (ps.lastChecked) statusFacts.push(['Last checked', `${utcStamp(ps.lastChecked)}${interval ? ` · checked every ${interval} minutes` : ''}`]);
  }

  /* ── suite task counts from the price snapshot (never typed) ── */
  const tasks = {
    coding: price?.coding?.tasks ?? null,
    reasoning: price?.reasoning?.tasks ?? null,
    tooling: price?.tooling?.tasks ?? null,
  };
  const countWord = (k: number | null, noun: string) => (k ? `${k} ${noun}` : noun);

  /* ── list prices for the FAQ ── */
  const priced = ordered.map((m) => ({ m, lp: listPrice(m) })).filter((e): e is { m: SeoModel; lp: NonNullable<ReturnType<typeof listPrice>> } => !!e.lp);
  const cheapest = priced.length ? priced.reduce((a, b) => (b.lp.blended < a.lp.blended ? b : a)) : null;
  const dearest = priced.length ? priced.reduce((a, b) => (b.lp.blended > a.lp.blended ? b : a)) : null;

  /* ── headings ── */
  const h1 = vendorH1(vendor);
  const h1Text = `${h1.title} ${h1.accent}`;
  const description = vendorDescription(vendor);
  const codingH2 = `Which ${name} model is best for coding right now?`;
  const reasoningH2 = `Which ${name} model is best for reasoning?`;
  const agentsH2 = `Which ${name} model is best for agents and tool calling?`;
  const statusH2 = `Is the ${vendor.label} API down?`;
  const compareH2 = `Compare ${vendor.family} models`;
  const howH2 = `How we test ${name} models`;
  const faqH2 = `Questions people ask about ${name} models`;
  const toc = TOC_BASE.map((t) => (t.id === 'worse' ? { ...t, label: copy.worseQuestion.replace(/\?$/, '') } : t));
  const num = (id: string) => tocNumber(toc, id);
  const asOf = boards ? utcStamp(boards.generatedAt) : null;

  const CADENCE = 'coding every four hours, reasoning and tool use daily, with an hourly canary probe';
  const OPENNESS = 'The methodology is public — every weight, statistical test and drift constant. The test tasks are private, so no lab can train on them.';
  const FREE_TIER = `Free account: every ranking over 24 hours, 7 days and ${FREE.historyDays} days, a ${FREE.watchedModels}-model watchlist with email alerts, ${n(FREE.routerRequestsPerMonth)} routed requests a month and a Data API key. No card.`;

  /* ── FAQ: one array feeds the visible questions and the FAQPage structured data ── */
  const faq: { q: string; a: string }[] = [];
  faq.push({
    q: `How many ${name} models does AI Stupid Level benchmark?`,
    a: count > 0
      ? `${count} ${mention} ${plural} ${count === 1 ? 'is' : 'are'} on the board: ${onBoard.map((m) => m.displayName).join(', ').replace(/, ([^,]*)$/, ' and $1')}. ` +
        `Each is called through ${vendor.apiHost} on our own account and gets the same tasks as every other vendor's models: ${CADENCE}.`
      : `Every ${mention} model on the board is called through ${vendor.apiHost} on our own account and gets the same tasks as every other vendor's models: ${CADENCE}. The current list is on the [leaderboard](/).`,
  });
  faq.push({
    q: `Which ${name} model has the highest Combined score?`,
    a: bestC
      ? `${bestC.m.displayName}: ${scoreText(bestC.p)}, ${placementSentence(bestC.p, boardLabel('combined'))}.` +
        (secondC ? ` Next among ${name} models is ${secondC.m.displayName} at ${scoreText(secondC.p)}, ${placementSentence(secondC.p, boardLabel('combined'))}.` : '') +
        ` The Combined score weights coding 50%, reasoning 25% and tool use 25%; "joint" means the models sharing a place are closer than the measurement can separate.`
      : `The Combined score weights coding 50%, reasoning 25% and tool use 25%, and the boards rank every model with statistical ties. The current ${name} places are on the [leaderboard](/).`,
  });
  faq.push({
    q: `Which ${name} model is best for coding?`,
    a: bestCoding
      ? `${bestCoding.m.displayName}: ${placementSentence(bestCoding.p, boardLabel('coding'))}, scoring ${scoreText(bestCoding.p)}. ` +
        `The coding suite is re-tested every four hours and graded by running the project's own tests, including hidden tests the model never sees. Every vendor's models are on [the best LLM for coding](/best-llm-for-coding).`
      : `The Coding board is re-tested every four hours and graded by running the project's own tests, including hidden tests the model never sees. The current ${name} places are on [the best LLM for coding](/best-llm-for-coding).`,
  });
  faq.push({
    q: `Which ${name} model is the cheapest?`,
    a: cheapest && dearest
      ? `By list price, ${cheapest.m.displayName}: ${usd(cheapest.lp.input)} per 1M input tokens and ${usd(cheapest.lp.output)} per 1M output tokens` +
        (dearest.m.id !== cheapest.m.id ? `, against ${usd(dearest.lp.input)} and ${usd(dearest.lp.output)} for ${dearest.m.displayName}` : '') +
        `. List prices are the cache-miss rate on ${vendor.apiHost}. What a correct result costs is a different question, answered over the last 30 days on [the best-value AI model](/best-value-ai-model).`
      : `List prices are the cache-miss rate on ${vendor.apiHost}, shown per model on its page. What a correct result costs is a different question, answered over the last 30 days on [the best-value AI model](/best-value-ai-model).`,
  });
  faq.push({
    q: statusH2,
    a: ps
      ? `As of ${utcStamp(ps.lastChecked)} the ${vendor.label} API ${STATE_PAST[ps.status]}` +
        (ps.uptime24h !== null && ps.uptime7d !== null ? `; ${pct(ps.uptime24h)} of checks in the last 24 hours and ${pct(ps.uptime7d)} over the last 7 days answered` : '') +
        `. ${interval ? `We check every ${interval} minutes: ${probe.charAt(0).toLowerCase()}${probe.slice(1)} ` : ''}${historyWord} and every episode are on [${vendor.label} API status](${vendor.statusPath}).`
      : `We probe the ${vendor.label} API on a fixed interval with one short completion on our own key. The current result, the history and every episode are on [${vendor.label} API status](${vendor.statusPath}).`,
  });
  faq.push({
    q: copy.worseQuestion,
    a: `${vendor.consumerNote} Each ${name} model on the board is compared with its own past: every suite has its own Page-Hinkley (a CUSUM-family test) change-point detector, which separates a sustained decline from ordinary run-to-run noise. ` +
      (trendSentence ? `${trendSentence} ` : '') +
      `The current answer, model by model, is on [${copy.worseQuestion}](${worsePath}).`,
  });
  faq.push({
    q: `How often are ${name} models re-tested?`,
    a: `On the same schedule as every other vendor's models: ${CADENCE}. ${OPENNESS} Every weight is on the [methodology page](/methodology).`,
  });

  /* ── structured data ── */
  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Models', path: '/models' }, { name: vendor.label, path: vendor.modelsPath }]),
    webPageLd({
      path: vendor.modelsPath,
      name: h1Text,
      description,
      type: 'CollectionPage',
      ...(boards ? { dateModified: isoDay(boards.generatedAt) } : {}),
    }),
    ...(ordered.length ? [itemListLd({ name: `${name} models benchmarked by AI Stupid Level`, items: ordered.map((m) => ({ name: m.displayName, url: `/models/${m.slug}` })) })] : []),
    faqLd(faq),
  ]);

  /** "On the Coding board, re-tested every four hours, the best-placed … " for the three suite sections. */
  const suiteAnswer = (key: BoardKey, cadence: string, best: { m: SeoModel; p: Placement } | null, second: { m: SeoModel; p: Placement } | null) => (
    best
      ? <>
          On the {boardLabel(key)} board, re-tested {cadence}, the best-placed {name} model in the last 24 hours is{' '}
          <Link href={`/models/${best.m.slug}`}>{best.m.displayName}</Link>: {placementSentence(best.p, boardLabel(key))}, scoring {scoreText(best.p)}.
          {second && <> Next among {name} models is <Link href={`/models/${second.m.slug}`}>{second.m.displayName}</Link>, {placementSentence(second.p, boardLabel(key))}.</>}
        </>
      : <>The {boardLabel(key)} board is re-tested {cadence} and ranks every model with statistical ties; the current {name} places are on the leaderboard.</>
  );

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        className="rd-vendor"
        kicker={`Models by vendor · ${mention}`}
        title={h1.title}
        accent={h1.accent}
        lead={<>
          AI Stupid Level gives every {name} model on the board the same tasks as every other vendor&apos;s models: {CADENCE}.
          The scores are ASL&apos;s own, from the 24-hour boards, never the vendor&apos;s published numbers.
        </>}
        actions={<>
          <a className="lp-btn lp-btn-primary lp-btn-lg" href="#scores" data-cta="vendor-hero-scores">See the scores <span className="lp-ar" aria-hidden="true">→</span></a>
          <Link className="lp-btn lp-btn-ghost lp-btn-lg" href={vendor.statusPath} data-cta="vendor-hero-status">{vendor.label} API status</Link>
        </>}
        note={<>
          <span className="lp-lgc"><img src={`/logos/${vendor.key}.svg`} alt="" width={18} height={18} /></span>
          <span>Called through {vendor.apiHost} on our own account, as an application would.</span>
        </>}
        aside={count > 0 ? (
          <dl className="lp-facts">
            <div><dt>{count}</dt><dd>{name} {plural} on the 24-hour boards</dd></div>
            {bestC && bestC.p.place !== null && (
              <div>
                <dt>{bestC.p.joint ? '=' : ''}{ordinal(bestC.p.place)}</dt>
                <dd>best Combined place among the {bestC.p.rankedCount} ranked models, held by {bestC.m.displayName}</dd>
              </div>
            )}
            {ps && ps.uptime7d !== null && (
              <div><dt>{pct(ps.uptime7d)}</dt><dd>of our probes to the {vendor.label} API answered in the last 7 days</dd></div>
            )}
          </dl>
        ) : undefined}
        toc={toc}
        final={(
          <RdFinal
            title={`Watch ${name} models, or let the router choose`}
            lead={FREE_TIER}
            actions={(
              <CtaRow>
                <WatchCta cta="vendor-final-watch" label={`Watch ${an(name)} ${name} model →`} sub="Free alerts: an email when a watched model's coding score falls five points in a week." />
                <RouterCta cta="vendor-final-router" label="Let the router pick the best-placed model →" sub={`Routes across every vendor on the board, on your own provider keys · ${n(FREE.routerRequestsPerMonth)} requests a month free`} />
              </CtaRow>
            )}
          />
        )}
      >
        <RdSection id="scores" n={num('scores')} title={`How do ${name} models score on the same tests?`}>
          {verdict && <Verdict>{verdict}</Verdict>}
          {asOf && <AsOf>As of {asOf} · 24-hour boards · score, then place in brackets; &ldquo;=&rdquo; marks a statistical tie</AsOf>}
          {rows.length > 0 && (
            <ScoreTable
              rows={rows}
              showVendor={false}
              caption={`${name} models on the four boards over the last 24 hours. Score is the Combined board (coding 50%, reasoning 25%, tool use 25%); Coding, Reasoning and Tool use give each suite's score and place.`}
            />
          )}
          <RdProse>
            <p>
              Places are the leaderboard&apos;s own: walking down a board, a model joins the group above it unless that group&apos;s leader is ahead by
              more than the measurement can resolve, so &ldquo;joint&rdquo; places are normal. The same boards hold every vendor&apos;s models; sign in for the full leaderboard.
            </p>
          </RdProse>
          <LeaderboardCta cta="vendor-scores-leaderboard" sub={FREE_TIER} />
        </RdSection>

        <RdSection id="models" n={num('models')} title={`Which ${name} models are tracked?`}
          lead={ordered.length
            ? `${ordered.length} ${mention} ${ordered.length === 1 ? 'model has a page of its own, with its place' : 'models have a page of their own, each with its place'} on every board and its history.`
            : `Each ${mention} model on the board has a page of its own, with its place on every board and its history.`}>
          {modelFacts.length > 0 && <RdFacts rows={modelFacts} />}
          <RdProse>
            <p>
              Prices are list prices per 1M tokens on {vendor.apiHost}, cache-miss rate, as the leaderboard&apos;s price view quotes them. What a correct result costs
              over the last 30 days is on <Link href="/best-value-ai-model">the best-value AI model</Link>; response times are on <Link href="/fastest-ai-model">the fastest AI model</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="coding" n={num('coding')} title={codingH2}>
          <RdProse>
            <p>{suiteAnswer('coding', 'every four hours', bestCoding, secondOn('coding'))}</p>
            <p>
              The coding suite gives a model a small working project and a bug report{tasks.coding ? ` (${tasks.coding} tasks a sweep)` : ''} and grades the fix by running the
              project&apos;s own tests, including hidden tests the model never sees. Every vendor&apos;s models get the same tasks:
              see <Link href="/best-llm-for-coding">the best LLM for coding</Link> across all vendors and <Link href="/methodology#coding">how coding is scored</Link>.
            </p>
          </RdProse>
          <RouterCta cta="vendor-coding-router" label="Let the router pick the best-placed model →" sub={`One OpenAI-compatible endpoint, your own provider keys, ${n(FREE.routerRequestsPerMonth)} requests a month free · no card`} />
        </RdSection>

        <RdSection id="reasoning" n={num('reasoning')} title={reasoningH2}>
          <RdProse>
            <p>{suiteAnswer('reasoning', 'daily', bestReasoning, secondOn('reasoning'))}</p>
            <p>
              The reasoning suite runs {countWord(tasks.reasoning, 'long multi-turn working sessions')} a day, scored on correctness, recovery after a failed step and
              continuity: whether the model still honours rules stated earlier in the session, checked by running code rather than by a judge model.
              See <Link href="/best-llm-for-reasoning">the best LLM for reasoning</Link> across all vendors and <Link href="/methodology#reasoning">how reasoning is scored</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="agents" n={num('agents')} title={agentsH2}>
          <RdProse>
            <p>{suiteAnswer('tooling', 'daily', bestTooling, secondOn('tooling'))}</p>
            <p>
              The tool-use suite runs {countWord(tasks.tooling, 'tasks')} in sandboxed machines, each with tools to call: either the job is done at the end or it is not.
              It is scored on task completion, tool selection, parameter accuracy, efficiency, error handling, context awareness and safety.
              See <Link href="/best-ai-model-for-agents">the best AI model for agents</Link> across all vendors and <Link href="/methodology#tooling">how tool use is scored</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="status" n={num('status')} title={statusH2}
          lead={`${probe} ${interval ? `Checked every ${interval} minutes: what` : 'What'} an application calling ${vendor.apiHost} would see.`}>
          {statusFacts.length > 0 && <RdFacts rows={statusFacts} />}
          {cells.length > 0 && (
            <div className="lp-up">
              <div className="seo-bars" style={{ '--n': cells.length } as CSSProperties} aria-hidden="true">
                {cells.split('').map((c, i) => <i key={i} className={c === '.' ? undefined : c} />)}
              </div>
              <div className="seo-bars-axis" aria-hidden="true"><span>7 days ago</span><span>now</span></div>
              <ul className="seo-bars-legend" aria-label="Legend">
                <li><i />Answered</li>
                <li className="w"><i />Slow</li>
                <li className="b"><i />Did not answer</li>
                <li className="o"><i />Our side, not counted</li>
                <li className="e"><i />No check</li>
              </ul>
            </div>
          )}
          <RdProse>
            <p>
              {historyWord}, every episode and the other {OTHERS[otherVendors.length] ?? otherVendors.length} providers are on <Link href={vendor.statusPath}>{vendor.label} API status</Link> and
              the <Link href="/status">provider status hub</Link>. When a provider stops answering, the Smart Router&apos;s fallback order moves traffic to the next model on the board.
            </p>
          </RdProse>
          <RouterCta cta="vendor-status-router" label="Route around an outage →" sub={`Fallback order across every vendor on the board · ${n(FREE.routerRequestsPerMonth)} requests a month free · no card`} />
        </RdSection>

        <RdSection id="worse" n={num('worse')} title={copy.worseQuestion}>
          <RdProse>
            <p>
              {vendor.consumerNote} A provider can change a model behind the same API name, and without continuous re-testing that change is invisible to the people relying on it.
              AI Stupid Level compares each {name} model with its own past: every suite has its own Page-Hinkley (a CUSUM-family test) change-point detector, which separates a sustained
              decline from ordinary run-to-run noise, and the hourly canary probe watches for a sudden collapse. {trendSentence}{trendSentence ? ' ' : ''}
              Searches for &ldquo;{copy.worseQuery}&rdquo; and &ldquo;AI model nerfed&rdquo; end at the same place: the current answer, model by model, is on{' '}
              <Link href={worsePath}>{copy.worseQuestion}</Link>, and the method is on <Link href="/ai-drift-detection">AI drift detection</Link>.
            </p>
          </RdProse>
          <WatchCta cta="vendor-worse-watch" label={`Watch ${an(name)} ${name} model →`} sub={`Free alerts: an email when a watched model's coding score falls five points in a week · ${FREE.watchedModels} models on a free account`} />
        </RdSection>

        <RdSection id="compare" n={num('compare')} title={compareH2}
          lead="Every pair page puts two models side by side, board by board, on the same tests over the last 24 hours.">
          {samePairs.length > 0 && (
            <ul className="rd-tags lp-up" aria-label={`${vendor.family} models compared with each other`}>
              {samePairs.map(([s, [a, b]]) => <li key={s}><Link href={`/compare/${s}`}>{a.displayName} vs {b.displayName}</Link></li>)}
            </ul>
          )}
          {crossPairs.length > 0 && bestC && (
            <RdProse>
              <p>{bestC.m.displayName}, the best-placed {name} model on the Combined board, against each other vendor&apos;s best-placed model:</p>
              <ul className="rd-tags" aria-label="Cross-vendor comparisons">
                {crossPairs.map(([s, [a, b]]) => <li key={s}><Link href={`/compare/${s}`}>{a.displayName} vs {b.displayName}</Link></li>)}
              </ul>
            </RdProse>
          )}
          <RdProse>
            <p>
              Other vendors on the same tests:{' '}
              {otherVendors.map((o, i) => <span key={o.key}>{i > 0 && (i === otherVendors.length - 1 ? ' and ' : ', ')}<Link href={o.modelsPath}>{companyOf(o)} models</Link></span>)}.
              The <Link href="/compare">compare hub</Link> lists every family, and <Link href="/best-ai-model">the best AI model</Link> ranks them across vendors.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="how" n={num('how')} title={howH2}>
          <RdProse>
            <p>
              Every model on the board gets the same tasks on the same schedule: {CADENCE}. {name} models are called through {vendor.apiHost} on our own account, exactly as an
              application would call them, so a score describes the model as it is served, not as it was announced.
            </p>
            <p>
              The coding suite{tasks.coding ? ` (${tasks.coding} tasks)` : ''} grades a bug fix by running the project&apos;s own tests, including hidden tests the model never sees.
              The reasoning suite{tasks.reasoning ? ` (${tasks.reasoning} sessions)` : ''} scores long multi-turn working sessions on correctness, recovery and continuity.
              The tool-use suite{tasks.tooling ? ` (${tasks.tooling} tasks)` : ''} runs in sandboxed machines, where the job is either done or not. The Combined score weights
              coding 50%, reasoning 25% and tool use 25%.
            </p>
            <p>
              {OPENNESS} Read the <Link href="/methodology">methodology</Link> and <Link href="/ai-drift-detection">how drift detection works</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="faq" n={num('faq')} title={faqH2}>
          <div className="rd-qas lp-up">
            {faq.map((qa, i) => (
              <details key={i} className="rd-qa" open={i === 0}>
                <summary>{qa.q}</summary>
                <div className="rd-qa-a"><Answer text={qa.a} /></div>
              </details>
            ))}
          </div>
        </RdSection>
      </ReadingPage>
    </>
  );
}
