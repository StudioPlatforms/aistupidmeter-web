import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import SubpageLayout from '@/components/SubpageLayout';
import LandingEffects from '@/components/landing/LandingEffects';
import ReadingToc from '@/components/landing/ReadingToc';
import { RdFinal, RdProse, RdSection, tocNumber } from '@/components/landing/Reading';
import { duration, pct, per1k, times } from '@/components/landing/price-format';
import { CtaRow, LeaderboardCta, RouterCta, WatchCta } from '@/components/seo/Cta';
import JsonLd from '@/components/seo/JsonLd';
import { AsOf, Verdict } from '@/components/seo/Verdict';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { Glance, type GlanceRow } from '@/components/seo/pair/Glance';
import {
  chooseWhen, compareAll, driftCell, driftSentence, fmtScore, makeSide, nothingSeparates, pairDescription, pairTitle,
  passRateSentence, placeShort, priceParagraph, pricePair, relatedPairs, speedParagraph, suiteParagraph, trackedSince, usd, verdict, word,
  type Side,
} from '@/components/seo/pair/pair-data';
import { BOARD_KEYS } from '@/lib/boards-core';
import { PLANS } from '@/lib/entitlements';
import { lpBody, lpDisplay } from '@/lib/fonts';
import { SITE, TITLE_SUFFIX, breadcrumbLd, faqLd, graphLd, isoDay, monthLabel, pageMeta, utcStamp, webPageLd } from '@/lib/seo';
import { boardLabel, getBoards24h, getDriftSignature, getPrice, getRoster, parsePairSlug, vendorMention, type Vendor } from '@/lib/seo-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';
import '@/styles/seo-pair.css';

/**
 * /compare/<a>-vs-<b>: two models from the roster side by side on the 24-hour boards (with the
 * leaderboard's statistical ties), the list prices, the price view's last 30 days and both drift
 * signatures. Every figure and every name is read at render time; nothing about a model is typed
 * here. The slug is canonical in ascending order (lib/seo-data pairSlug): the reverse order is a
 * permanent redirect, an unknown half or the same model twice is a 404. ISR, no auth(): the
 * newest run is paid, so the page only ever asks for period=24h.
 */
export const revalidate = 900;

const FAILSAFE = "(function(){var d=document.documentElement;d.classList.add('lp-js');setTimeout(function(){if(!window.__lpReady)d.classList.remove('lp-js')},4000)})();";
const intro = (d: string): CSSProperties => ({ '--d': d } as CSSProperties);

const TOC = [
  { id: 'glance', label: 'At a glance' },
  { id: 'coding', label: 'Coding' },
  { id: 'reasoning', label: 'Reasoning' },
  { id: 'agents', label: 'Agents and tool calling' },
  { id: 'price', label: 'Price' },
  { id: 'speed', label: 'Speed' },
  { id: 'drift', label: 'Getting worse?' },
  { id: 'choose', label: 'Which to use' },
  { id: 'router', label: 'Route automatically' },
  { id: 'method', label: 'How we test' },
  { id: 'faq', label: 'FAQ' },
  { id: 'related', label: 'Related comparisons' },
];
const num = (id: string) => tocNumber(TOC, id);

const CADENCE = 'coding every four hours, reasoning and tool use daily, with an hourly canary probe';
const OPENNESS = 'The methodology is public — every weight, statistical test and drift constant. The test tasks are private, so no lab can train on them.';
const DRIFT_METHOD = 'Page-Hinkley change-point detection (a CUSUM-family test) runs per suite on each model’s daily median, with every constant published; a real shift is confirmed over days, not hours. An hourly canary of two fixed coding probes catches sharp drops.';

/** The "is X getting worse" page for a model's family; the hub where a family has none. */
function worseLink(v: Vendor | undefined): { href: string; label: string } {
  if (v?.worsePath) return { href: v.worsePath, label: v.key === 'openai' ? 'Is ChatGPT getting worse?' : `Is ${v.family} getting worse?` };
  return { href: '/is-ai-getting-worse', label: 'Are AI models getting worse?' };
}

export async function generateMetadata({ params }: { params: { pair: string } }): Promise<Metadata> {
  const roster = await getRoster();
  const parsed = parsePairSlug(params.pair, roster);
  if (!parsed) return { title: { absolute: `Comparison not found${TITLE_SUFFIX}` }, robots: { index: false, follow: true } };
  const boards = await getBoards24h();
  const A = parsed.a.displayName;
  const B = parsed.b.displayName;
  return pageMeta({
    title: pairTitle(A, B, monthLabel(boards?.generatedAt)),
    description: pairDescription(A, B),
    path: `/compare/${parsed.canonical}`,
    keywords: [`${A} vs ${B}`, `${B} vs ${A}`, `${A} vs ${B} for coding`, `${A} vs ${B} benchmark`, `${A} or ${B}`, 'LLM comparison', 'AI model comparison'],
  });
}

export default async function PairPage({ params }: { params: { pair: string } }) {
  const roster = await getRoster();
  const parsed = parsePairSlug(params.pair, roster);
  if (!parsed) notFound();
  if (params.pair !== parsed.canonical) permanentRedirect(`/compare/${parsed.canonical}`);

  const [boards, price, driftA, driftB] = await Promise.all([
    getBoards24h(), getPrice(), getDriftSignature(parsed.a.id), getDriftSignature(parsed.b.id),
  ]);
  const a = makeSide(parsed.a, boards, price, driftA);
  const b = makeSide(parsed.b, boards, price, driftB);
  const cmp = compareAll(a, b);
  const A = a.name;
  const B = b.name;
  const path = `/compare/${parsed.canonical}`;
  const verdictText = verdict(a, b, cmp);
  const description = pairDescription(A, B);
  const asOf = boards
    ? `As of ${utcStamp(boards.generatedAt)} · 24-hour board`
    : price ? `As of ${utcStamp(price.generatedAt)} · last 30 days` : null;

  /* ── hero facts ── */
  const facts: { dt: string; dd: ReactNode }[] = [];
  for (const s of [a, b]) {
    const p = s.place?.combined;
    if (p && p.score !== null) facts.push({ dt: String(p.score), dd: <><b>{s.name}</b> on the Combined board, last 24 hours · {placeShort(p)}</> });
  }
  if (a.price && b.price) {
    const [cheap, dear] = a.price.blended <= b.price.blended ? [a, b] : [b, a];
    const ratio = cheap.price!.blended > 0 ? dear.price!.blended / cheap.price!.blended : 1;
    facts.push(ratio >= 1.05
      ? { dt: times(ratio), dd: <>price gap per token: <b>{dear.name}</b> lists at {pricePair(dear.price!)} per 1M tokens, {cheap.name} at {pricePair(cheap.price!)}</> }
      : { dt: 'same', dd: <>list price per 1M tokens: both {pricePair(a.price)}</> });
  }

  /* ── at a glance ── */
  const rows: GlanceRow[] = [];
  for (const k of BOARD_KEYS) {
    const pa = a.place?.[k];
    const pb = b.place?.[k];
    if (!pa || !pb || pa.score === null || pb.score === null) continue;
    rows.push({
      label: boardLabel(k), note: 'score ± standard error · place, 24-hour board',
      a: { main: fmtScore(pa.score, pa.se), sub: placeShort(pa) },
      b: { main: fmtScore(pb.score, pb.se), sub: placeShort(pb) },
    });
  }
  if (a.price && b.price) {
    rows.push({
      label: 'List price per 1M tokens', note: 'input / output · blended 40/60',
      a: { main: `${usd(a.price.input)} / ${usd(a.price.output)}`, sub: `${usd(a.price.blended)} blended` },
      b: { main: `${usd(b.price.input)} / ${usd(b.price.output)}`, sub: `${usd(b.price.blended)} blended` },
    });
  }
  if (a.coding?.medianMs != null && b.coding?.medianMs != null) {
    rows.push({ label: 'Median response time', note: 'coding tasks, last 30 days', a: { main: duration(a.coding.medianMs) }, b: { main: duration(b.coding.medianMs) } });
  }
  if (a.coding && b.coding) {
    rows.push({ label: 'Pass rate', note: 'coding attempts, last 30 days', a: { main: pct(a.coding.passRate) }, b: { main: pct(b.coding.passRate) } });
  }
  if (a.coding?.costPerSuccess != null && b.coding?.costPerSuccess != null) {
    rows.push({
      label: 'Cost per 1,000 correct answers', note: 'coding, last 30 days, every attempt billed',
      a: { main: per1k(a.coding.costPerSuccess) }, b: { main: per1k(b.coding.costPerSuccess) },
    });
  }
  const da = driftCell(a);
  const db = driftCell(b);
  if (da && db) rows.push({ label: 'Drift status', note: 'trend on the 24-hour board · Page-Hinkley per suite', a: { main: da.main, sub: da.sub }, b: { main: db.main, sub: db.sub } });
  const ta = trackedSince(a.m);
  const tb = trackedSince(b.m);
  if (ta && tb) {
    rows.push({
      label: 'Tracked since',
      a: { main: ta, sub: a.m.daysTracked ? `${a.m.daysTracked} days` : null },
      b: { main: tb, sub: b.m.daysTracked ? `${b.m.daysTracked} days` : null },
    });
  }

  /* ── section text ── */
  const codingText = suiteParagraph(a, b, cmp.coding);
  const reasoningText = suiteParagraph(a, b, cmp.reasoning);
  const toolingText = suiteParagraph(a, b, cmp.tooling);
  const passRate = passRateSentence(a, b);
  const priceText = priceParagraph(a, b);
  const speedText = speedParagraph(a, b);
  const driftTexts = [driftSentence(a), driftSentence(b)].filter((s): s is string => !!s);
  const choose = chooseWhen(a, b, cmp);
  const anyChoose = choose.a.length + choose.b.length > 0;
  const related = relatedPairs(a.m, b.m, roster, boards);
  const worseA = worseLink(a.vendor);
  const worseB = worseLink(b.vendor);
  const sameWorse = worseA.href === worseB.href;
  const codingTasks = price?.coding?.tasks ?? null;
  const reasoningTasks = price?.reasoning?.tasks ?? null;
  const toolingTasks = price?.tooling?.tasks ?? null;
  const freeRequests = PLANS.free.routerRequestsPerMonth.toLocaleString('en-US');

  const boardFallback = (what: string, href: string, label: string) =>
    `Both models get the same ${what} on the same schedule; their current places, with standard errors and statistical ties, are on the [${label}](${href}) page.`;
  const chooseSummary = anyChoose
    ? [
      choose.a.length ? `Choose ${A} when ${choose.a.join('; ')}.` : '',
      choose.b.length ? `Choose ${B} when ${choose.b.join('; ')}.` : '',
    ].filter(Boolean).join(' ')
    : nothingSeparates(a, b);
  const routerAnswer = `Yes. The Smart Router is one OpenAI-compatible endpoint with 14 auto-* routing modes: a quality mode such as auto-coding sends each request to the model placing highest on that board, the value modes pick within 5 points of the best and then the cheapest measured cost per run, and auto-split sends traffic by weights you set. Routing is drift-aware by default, uses your own provider keys and adds zero markup on tokens. Free includes ${freeRequests} routed requests a month.`;

  const faq: FaqItem[] = [
    { q: `Is ${A} better than ${B} for coding?`, a: [codingText, passRate].filter(Boolean).join(' ') || boardFallback('repository debugging tasks, re-tested every four hours', '/best-llm-for-coding', 'best LLM for coding') },
    { q: `Is ${A} better than ${B} for reasoning?`, a: reasoningText || boardFallback('multi-turn reasoning sessions, daily', '/best-llm-for-reasoning', 'best LLM for reasoning') },
    { q: `Is ${A} or ${B} better for agents and tool calling?`, a: toolingText || boardFallback('sandboxed tool-use tasks, daily', '/best-ai-model-for-agents', 'best AI model for agents') },
    { q: `Which is cheaper, ${A} or ${B}?`, a: priceText.join(' ') || `List prices and cost per correct answer for every model are on the [best value AI model](/best-value-ai-model) page.` },
    { q: `Which is faster, ${A} or ${B}?`, a: speedText.join(' ') || `Both models are timed on every run; the current medians are on the [fastest AI model](/fastest-ai-model) page.` },
    { q: `Is ${A} or ${B} getting worse?`, a: `${driftTexts.join(' ')} ${DRIFT_METHOD}`.trim() },
    { q: `Should I use ${A} or ${B}?`, a: `${verdictText} ${chooseSummary}` },
    { q: `Can I route between ${A} and ${B} automatically?`, a: routerAnswer },
  ];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Compare', path: '/compare' }, { name: `${A} vs ${B}`, path }]),
    webPageLd({
      path, name: `${A} vs ${B}`, description,
      ...(boards ? { dateModified: isoDay(boards.generatedAt) } : {}),
      about: [a, b].map((s: Side) => ({ '@type': 'SoftwareApplication', name: s.name, applicationCategory: 'AI Language Model', url: `${SITE}/models/${s.slug}` })),
    }),
    faqLd(faq),
  ]);

  const modelLinks = (
    <>
      each model’s own page, <Link href={`/models/${a.slug}`}>{A}</Link> and <Link href={`/models/${b.slug}`}>{B}</Link>
    </>
  );

  return (
    <SubpageLayout>
      <div className={`lp lp-sub rd-page sp-page ${lpBody.variable} ${lpDisplay.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: FAILSAFE }} />
        <LandingEffects />
        <JsonLd data={ld} />

        <header className="lp-hero lp-textured rd-hero sp-hero">
          <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="lp-wrap">
            <nav className="sp-crumbs lp-intro" style={intro('.04s')} aria-label="Breadcrumb">
              <Link href="/">Home</Link><i aria-hidden="true">›</i>
              <Link href="/compare">Compare</Link><i aria-hidden="true">›</i>
              <span>{A} vs {B}</span>
            </nav>
            <h1 className="lp-h1 lp-intro" style={intro('.1s')}>{A} vs {B}</h1>
            <div className="lp-hero-row">
              <div>
                <Verdict className="lp-intro">{verdictText}</Verdict>
                <CtaRow className="lp-intro">
                  <RouterCta cta="pair-hero-router" label={`Route between ${A} and ${B} →`} />
                  <LeaderboardCta ghost cta="pair-hero-leaderboard" />
                </CtaRow>
                {asOf && <AsOf className="lp-intro">{asOf}</AsOf>}
              </div>
              {facts.length >= 2 && (
                <div className="rd-aside lp-intro" style={intro('.34s')}>
                  <dl className="lp-facts">
                    {facts.map((f, i) => <div key={i}><dt>{f.dt}</dt><dd>{f.dd}</dd></div>)}
                  </dl>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="rd">
          <ReadingToc items={TOC} />

          <RdSection id="glance" n={num('glance')} title={`${A} vs ${B} at a glance`}
            lead="Both models on the same four boards, the same list-price view and the same drift detectors. Scores carry their standard error; a place is shared, written joint, when the gap is inside that noise.">
            <Glance a={A} b={B} rows={rows} caption={asOf ?? 'Scores on the 24-hour board; prices per 1M tokens; the last 30 days for time and cost'} />
            <RdProse>
              <p>The boards re-rank after every run, so the figures here follow the leaderboard: {modelLinks}, carry the full history. The whole board for each category is on <Link href="/best-llm-for-coding">best LLM for coding</Link>, <Link href="/best-llm-for-reasoning">best LLM for reasoning</Link> and <Link href="/best-ai-model-for-agents">best AI model for agents</Link>.</p>
            </RdProse>
          </RdSection>

          <RdSection id="coding" n={num('coding')} title={`Is ${A} better than ${B} for coding?`}
            lead={`The Coding board: ${codingTasks ? `${word(codingTasks)} ` : ''}repository debugging tasks graded by running the project’s own tests, including hidden tests the model never sees, re-tested every four hours.`}>
            <RdProse>
              {codingText ? <p>{codingText}</p> : <p>Both models get the same coding tasks on the same schedule; their current places are on the Coding board.</p>}
              {passRate && <p>{passRate}</p>}
              <p>See every model on the Coding board on <Link href="/best-llm-for-coding">best LLM for coding</Link>, or {modelLinks}.</p>
            </RdProse>
          </RdSection>

          <RdSection id="reasoning" n={num('reasoning')} title={`Is ${A} better than ${B} for reasoning?`}
            lead={`The Reasoning board: ${reasoningTasks ? `${word(reasoningTasks)} ` : ''}long, multi-turn working sessions every day, with continuity checked by running code against rules stated earlier in the session.`}>
            <RdProse>
              {reasoningText ? <p>{reasoningText}</p> : <p>Both models get the same reasoning sessions on the same schedule; their current places are on the Reasoning board.</p>}
              <p>See every model on the Reasoning board on <Link href="/best-llm-for-reasoning">best LLM for reasoning</Link>.</p>
            </RdProse>
          </RdSection>

          <RdSection id="agents" n={num('agents')} title={`Is ${A} or ${B} better for agents and tool calling?`}
            lead={`The Tool use board: ${toolingTasks ? `${word(toolingTasks)} tasks` : 'tasks'}, each in a real sandboxed machine — either the job is done at the end or it is not. Task completion, tool selection, parameter accuracy, efficiency, error handling, context awareness and safety are scored.`}>
            <RdProse>
              {toolingText ? <p>{toolingText}</p> : <p>Both models get the same tool-use tasks on the same schedule; their current places are on the Tool use board.</p>}
              <p>See every model on the Tool use board on <Link href="/best-ai-model-for-agents">best AI model for agents</Link>.</p>
            </RdProse>
          </RdSection>

          <RdSection id="price" n={num('price')} title={`Which is cheaper, ${A} or ${B}?`}
            lead="List prices are each provider’s standard rate per million tokens, cache-miss input and output. Cost per correct answer counts every attempt on the coding tasks, failed ones included, over the last 30 days.">
            <RdProse>
              {priceText.length ? priceText.map((p, i) => <p key={i}>{p}</p>) : <p>List prices and cost per correct answer for every model are on the price view.</p>}
              <p>The cheapest model that still passes the tests is on <Link href="/best-value-ai-model">best value AI model</Link>.</p>
            </RdProse>
          </RdSection>

          <RdSection id="speed" n={num('speed')} title={`Which is faster, ${A} or ${B}?`}
            lead="Median response time of one attempt or one session, from the same runs as the scores, over the last 30 days.">
            <RdProse>
              {speedText.length ? speedText.map((p, i) => <p key={i}>{p}</p>) : <p>Both models are timed on every run.</p>}
              <p>Every model’s median is on <Link href="/fastest-ai-model">fastest AI model</Link>.</p>
            </RdProse>
          </RdSection>

          <RdSection id="drift" n={num('drift')} title={`Is ${A} or ${B} getting worse?`} lead={DRIFT_METHOD}>
            <RdProse>
              {driftTexts.map((p, i) => <p key={i}>{p}</p>)}
              <p>
                The family pages answer the question for every model of a provider: <Link href={worseA.href}>{worseA.label}</Link>
                {!sameWorse && <> and <Link href={worseB.href}>{worseB.label}</Link></>}. The method is on <Link href="/ai-drift-detection">AI drift detection</Link>.
              </p>
            </RdProse>
            <CtaRow className="lp-up">
              <WatchCta slug={a.slug} cta="pair-drift-watch-a" label={`Get an email when ${A} changes →`} />
              <WatchCta slug={b.slug} cta="pair-drift-watch-b" label={`Get an email when ${B} changes →`} ghost />
            </CtaRow>
          </RdSection>

          <RdSection id="choose" n={num('choose')} title={`Should I use ${A} or ${B}?`}
            lead="Only a difference that clears a threshold counts: a board lead beyond the measurement noise (the leaderboard’s own tie rule), 10% on list price, 20% on response time or cost per correct answer.">
            {anyChoose ? (
              <div className="sp-choose lp-up">
                {choose.a.length > 0 && (
                  <div>
                    <h3>Choose {A} when</h3>
                    <ul>{choose.a.map((t) => <li key={t}>{t}</li>)}</ul>
                  </div>
                )}
                {choose.b.length > 0 && (
                  <div>
                    <h3>Choose {B} when</h3>
                    <ul>{choose.b.map((t) => <li key={t}>{t}</li>)}</ul>
                  </div>
                )}
              </div>
            ) : (
              <RdProse><p>{nothingSeparates(a, b)}</p></RdProse>
            )}
            {anyChoose && a.place && b.place && (choose.a.length === 0 || choose.b.length === 0) && (
              <RdProse><p>No difference clears a threshold in favour of {choose.a.length === 0 ? A : B}.</p></RdProse>
            )}
          </RdSection>

          <RdSection id="router" n={num('router')} title={`Can I route between ${A} and ${B} automatically?`}
            lead="One OpenAI-compatible endpoint sends each request to whichever model the boards favour for that kind of work, with your own provider keys.">
            <RdProse>
              <p>{routerAnswer}</p>
              <p>Every mode is described in the <Link href="/router/docs#strategies">router documentation</Link>.</p>
            </RdProse>
            <CtaRow className="lp-up">
              <RouterCta cta="pair-router-key" />
            </CtaRow>
          </RdSection>

          <RdSection id="method" n={num('method')} title={`How we test ${A} and ${B}`}
            lead={`Every model on the board runs the same tasks on the same schedule: ${CADENCE}.`}>
            <RdProse>
              <p>Scores come from our own runs through each provider’s public API, not vendor-reported numbers. Every model gets the same prompts and output budget, and the same sampling settings wherever a provider accepts them, and is graded by executing what it produces. Every score carries a standard error from its own run-to-run repeatability; models whose lead is inside that noise share a place, written joint.</p>
              <p>{OPENNESS} The full method, weights and constants are on the <Link href="/methodology">methodology page</Link>.</p>
            </RdProse>
          </RdSection>

          <RdSection id="faq" n={num('faq')} title={`${A} vs ${B}: questions people ask`}>
            <Faq items={faq} />
          </RdSection>

          <RdSection id="related" n={num('related')} title="Related comparisons"
            lead="Each model’s nearest neighbours on the Combined board and the versions before and after it in its own line.">
            {related.length > 0 && (
              <div className="sp-related lp-up">
                <ul className="rd-tags">
                  {related.map((r) => <li key={r.slug}><Link href={`/compare/${r.slug}`}>{r.label}</Link></li>)}
                </ul>
              </div>
            )}
            <RdProse>
              <p>
                Every tracked model of each provider: {a.vendor && <Link href={a.vendor.modelsPath}>{vendorMention(a.vendor)}</Link>}
                {a.vendor && b.vendor && a.vendor.key !== b.vendor.key && <> and <Link href={b.vendor.modelsPath}>{vendorMention(b.vendor)}</Link></>}
                {!a.vendor && b.vendor && <Link href={b.vendor.modelsPath}>{vendorMention(b.vendor)}</Link>}
                . All head-to-head pages are listed on <Link href="/compare">Compare</Link>.
              </p>
            </RdProse>
          </RdSection>
        </div>

        <RdFinal
          id="final"
          title="Route between them automatically"
          lead={`The Smart Router sends each request to whichever of ${A} and ${B} — or any model on the board — the boards favour for that kind of work, with your own provider keys and zero markup on tokens.`}
          actions={(
            <CtaRow>
              <RouterCta cta="pair-final-router" />
              <LeaderboardCta ghost cta="pair-final-leaderboard" />
            </CtaRow>
          )}
          explore={(
            <>
              <Link href="/best-llm-for-coding">Best LLM for coding</Link>
              <Link href="/best-ai-model-for-agents">Best AI model for agents</Link>
              <Link href="/best-value-ai-model">Best value AI model</Link>
              <Link href="/compare">All comparisons</Link>
            </>
          )}
        />
      </div>
    </SubpageLayout>
  );
}
