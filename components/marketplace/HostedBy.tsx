import Link from 'next/link';
import HostLogo from '@/components/marketplace/HostLogo';
import HostLines from '@/components/marketplace/HostLines';
import { Pane, ProviderMark } from '@/components/studio';
import { PROVIDER_LABEL } from '@/components/landing/types';
import { headlineText, isCalibrated, usd, type HostRow, type OfficialRef, type VsOfficialLine, type VsOfficialCalibrated } from '@/lib/marketplace-public';

type ChartSuite = 'combined' | 'coding' | 'reasoning' | 'tooling' | 'canary';
const SUITE_LABEL: Record<ChartSuite, string> = { combined: 'Combined', coding: 'Coding', reasoning: 'Reasoning', tooling: 'Tool use', canary: 'Hourly probe' };
const SUITES: ChartSuite[] = ['combined', 'coding', 'reasoning', 'tooling', 'canary'];

/**
 * The hosts of one open model, ordered as the API orders them (§4.6: measured hosts first by their combined daily
 * mean, then the rest alphabetically), for the open-model page and the fleet model pages' "Hosted by other
 * providers" pane (§7.5). Host scores appear only where the API says the comparison holds; otherwise the pane
 * reads "Measurements for each host are on its page." (neutral copy; the API decides, never the web).
 *
 * M9 (§7.5, §7.6): `suites` is the API's per-suite answer (public form only). A suite whose gate passes shows each
 * host's published headline for it and the per-host chart (HostLines, with the vendor's "Official API" line when the
 * API sends one); `chart` names the open model whose chart is drawn. The data is the server's fetch, with its own
 * `next: { revalidate: 60 }` (lib/marketplace-public.ts), because the fleet model pages are force-dynamic (rev: S13).
 *
 * M10 (design D-A1, D-A2): where the API sends them, the first row is the official API (the maker's own API, which we
 * measure with our own account), a reference with no number of its own that is never ranked among the hosts and links
 * to the page's own score; and each host row gets one line per shown suite with its number beside the official API's
 * on that host's own tests and days ("Hourly probe 96 ± 0.9 · official API 97 ± 0.6 · tied"). The official number
 * appears only there. A line the API does not send is left out, never shown as a dash; the two caption lines render
 * only where a line does. With no such line the pane is M9's, unchanged.
 *
 * F5 (design D-A2 "After the move"): a host on fresh copies is compared through its model's calibration: its line reads
 * "Coding 84 ± 1.1 · official API 90 on the standard tasks", with no tie or "N points" verdict (the tests differ), and the
 * caption says "Hosts on fresh copies are compared through <Model>'s calibration: fresh copies score within ±X points of
 * the standard tasks." The "same tests and days" caption then speaks of the hosts on the standard tasks alone, and renders
 * only where such a line does.
 */
// The site's vendor names (DeepSeek, Moonshot AI, Z.ai, …); a vendor the map does not name shows as "Official API" alone,
// never as a raw id (fix round, code review m10).
const vendorName = (v: string): string | null => PROVIDER_LABEL[v] ?? null;
const officialName = (o: OfficialRef) => { const v = vendorName(o.vendor); return v ? `${o.label} · ${v}` : o.label; };
const officialText = (x: VsOfficialLine) => `${x.official.mean} ± ${x.official.se.toFixed(1)}`;
const SUITE_WORD: Record<ChartSuite, string> = { combined: 'Combined', coding: 'coding', reasoning: 'reasoning', tooling: 'tool use', canary: 'the hourly probe' };
/**
 * F5: the calibration caption's margins. F5b (web review MINOR-5): "±3.6 points of the standard tasks for coding", and with
 * more suites "±3.6 points of the standard tasks for coding, ±1.4 for reasoning and ±0.8 for the hourly probe".
 */
export function marginsText(m: Partial<Record<ChartSuite, number>>): string {
  const xs = SUITES.filter(s => typeof m[s] === 'number').map(s => ({ s, v: m[s] as number }));
  const parts = xs.map((x, i) => (i === 0 ? `±${x.v} points of the standard tasks for ${SUITE_WORD[x.s]}` : `±${x.v} for ${SUITE_WORD[x.s]}`));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] ?? '';
}
function reading(x: VsOfficialLine): string {
  if (x.tied) return 'tied';
  const n = Math.abs(x.delta);
  return `${n} point${n === 1 ? '' : 's'} ${x.delta > 0 ? 'above' : 'below'}`;
}

export default function HostedBy({ hosts, comparable, title, staffPreview, suites, chart, official, calibrated, framed }: {
  hosts: HostRow[]; comparable: boolean; title: string; staffPreview?: boolean;
  suites?: Partial<Record<ChartSuite, { comparable: boolean; reason: string | null }>> | null;
  chart?: { slug: string; suites?: ChartSuite[] } | null;
  official?: OfficialRef | null;
  calibrated?: { model: string; margins: Partial<Record<ChartSuite, number>>; families?: Array<{ model: string; margins: Partial<Record<ChartSuite, number>> }> } | null;
  /** F5 restyle: the fleet model page's card (a studio Pane like the page's other sections, its captions in the pane's
   *  foot); the open-model reading page keeps the plain section. The words are the same either way. */
  framed?: boolean;
}) {
  if (!hosts.length) return null;
  const shown = suites ? SUITES.filter(s => suites[s]?.comparable) : [];
  const chartSuites = chart ? (chart.suites ?? (suites ? shown : SUITES)) : [];
  // Per host and shown suite, a comparison line only where the API sent the host's number and the official one. F5: a
  // host on fresh copies gets the calibrated form (the official number on the standard tasks, no verdict).
  const linesOf = (h: HostRow) => shown.flatMap(s => {
    const x = h.vsOfficial?.[s];
    const mine = headlineText(h.entry.scores?.headline?.[s]);
    if (!x || !mine) return [];
    if (isCalibrated(x)) return [{ s, fresh: true, text: `${SUITE_LABEL[s]} ${mine} · official API ${(x as VsOfficialCalibrated).official.mean} on the standard tasks` }];
    return [{ s, fresh: false, text: `${SUITE_LABEL[s]} ${mine} · official API ${officialText(x as VsOfficialLine)} · ${reading(x as VsOfficialLine)}` }];
  });
  const compared = !!official && hosts.some(h => linesOf(h).length > 0);
  const comparedSame = compared && hosts.some(h => linesOf(h).some(l => !l.fresh));
  const comparedFresh = compared && !!calibrated && hosts.some(h => linesOf(h).some(l => l.fresh));
  const list = (
    <ul className={framed ? 'mp-host-list is-framed' : 'mp-host-list'}>
      {compared && official && (
        <li className="mp-host-official">
          <ProviderMark provider={official.vendor} />
          <span className="mp-host-main">
            <b className="mp-host-name" title={officialName(official)}>{officialName(official)}</b>
            <span className="mp-chip">reference</span>
          </span>
          <span className="mp-muted">The maker&apos;s own API, measured by us with our own account</span>
          <a className="mp-host-cta" href="#top">See its score</a>
        </li>
      )}
      {hosts.map(h => {
        const lines = compared ? linesOf(h) : [];
        const inLines = new Set(lines.map(l => l.s));
        const scores = shown.flatMap(s => {
          if (inLines.has(s)) return [];
          const t = headlineText(h.entry.scores?.headline?.[s]);
          return t ? [`${SUITE_LABEL[s]} ${t}`] : [];
        });
        return (
          <li key={h.entry.publicId}>
            <HostLogo name={h.provider.displayName} logoUrl={h.provider.logoUrl} size={30} />
            <span className="mp-host-main">
              <Link href={h.entry.path}>{h.provider.displayName}</Link>
              <span className="mp-chip">{h.entry.precisionLabel}</span>
            </span>
            <span className="mp-muted">{usd(h.entry.price.inPerMTok)} in · {usd(h.entry.price.outPerMTok)} out per 1M</span>
            <span className="mp-muted">{h.entry.measurement.state === 'measured' ? 'Measured' : 'Not measured yet'}{scores.length ? ` · ${scores.join(' · ')}` : ''}</span>
            <Link className={framed ? 'mp-host-cta st-btn is-sm' : 'mp-host-cta'} href={`/router/providers?host=${h.provider.slug}`}>Use in the Smart Router</Link>
            {lines.map(l => <span key={l.s} className="mp-muted mp-host-line">{l.text}</span>)}
          </li>
        );
      })}
    </ul>
  );
  const captions = (
    <>
      {comparedSame && (
        <p className="mp-caption">
          {/* F5b (web review MINOR-5): beside hosts on fresh copies this caption speaks of the hosts on the standard tasks. */}
          {comparedFresh ? 'Hosts on the standard tasks are compared on the same tests and days' : 'Compared on the same tests and days'}: each host&apos;s newest 5 runs (at least 3) and the official API&apos;s runs over the same days, in whole points. Tied: within the measurement noise.
          {' '}The official API&apos;s number in each line covers only that host&apos;s days, so it can differ from the score at the top of this page.
        </p>
      )}
      {comparedFresh && calibrated && (
        <p className="mp-caption">
          {/* F5b (code review MINOR-12): one sentence per open model when the API names two or more (each its own margins). */}
          {calibrated.families && calibrated.families.length > 1
            ? calibrated.families.map((f, i) => <span key={f.model}>{i > 0 ? ' ' : ''}Hosts of {f.model} on fresh copies are compared through its calibration: fresh copies score within {marginsText(f.margins)}.</span>)
            : <>Hosts on fresh copies are compared through {calibrated.model}&apos;s calibration: fresh copies score within {marginsText(calibrated.margins)}.</>}
          {comparedSame ? null : <>{' '}The official API&apos;s number in each line covers only that host&apos;s days, so it can differ from the score at the top of this page.</>}
        </p>
      )}
      <p className="mp-caption">
        {comparable ? null : 'Measurements for each host are on its page. '}
        <Link href="/inference-providers/ranking-criteria">How hosts are ordered</Link>
      </p>
    </>
  );
  const lines = chart && chartSuites.length > 0 ? <HostLines slug={chart.slug} suites={chartSuites} title="Each host over time" /> : null;
  if (framed) {
    // The fleet model page: a card like the page's other sections (the rows inside its edges, the captions in its foot),
    // the per-host chart its own card below. The Pane's props never change after its first render (StudioEffects).
    return (
      <>
        <Pane className="mp-hosted-pane" title={title} sub={staffPreview ? <span className="mp-staff-chip">Staff preview — not public</span> : undefined} ruled flush
          foot={<div className="mp-hosted-foot">{captions}</div>}>
          {list}
        </Pane>
        {lines}
      </>
    );
  }
  return (
    <section className="mp-hosted" aria-labelledby="mp-hosted-h">
      {staffPreview && <p className="mp-staff-chip">Staff preview — not public</p>}
      <h2 id="mp-hosted-h">{title}</h2>
      {list}
      {captions}
      {lines}
    </section>
  );
}
