import Link from 'next/link';
import JsonLd from '@/components/seo/JsonLd';
import HostLogo from '@/components/marketplace/HostLogo';
import BecomeProvider, { PROVIDER_START } from '@/components/marketplace/BecomeProvider';
import { ReadingPage, RdSection, RdProse, RdRows, RdFinal, tocNumber } from '@/components/landing/Reading';
import { publicRead } from '@/lib/marketplace-public';
import { breadcrumbLd, graphLd, webPageLd } from '@/lib/seo';
import '@/styles/marketplace-public.css';
import '@/styles/inference-providers.css';

/**
 * /inference-providers once listing is open to everyone (Phase 3 plan §4.4, §11 M10 step 2: ASL_MARKETPLACE=on, the
 * API's status route says provider sign-up is open). Until then page.tsx renders the interest page.
 *
 * Copy rule: only checkable claims. It describes what we do to the host's own endpoint, never compares a hosted number
 * with a leaderboard number, and states no spot-check practice. Every number is a rule of the code: the cadence (4 h,
 * 24 h, 24 h, 1 h), the caps (2x a month by default, 3x a run), daily means in whole points 1-2 days late, joining the
 * main ranking only under the published criteria with fresh task versions, offers reviewed by a person. The example is
 * the estimate at the stated prices; a host's own estimate at its prices is shown before it starts. Change this page
 * with the product.
 */

export const PATH = '/inference-providers';
export const OPEN_TITLE = 'Inference providers: list your models';
export const OPEN_DESCRIPTION = 'List your models on AI Stupid Level for free. We benchmark your own endpoint with our coding, reasoning and tool-use suites and an hourly probe, publish what we measure, and the Smart Router can send you requests from people who bring your key.';

/** The set-up page (§2); "Become a provider" picks sign-up or this by the session (components/marketplace/BecomeProvider). */
const START = PROVIDER_START;

const TOC = [
  { id: 'how', label: 'How listing works' },
  { id: 'measure', label: 'What we measure and publish' },
  { id: 'cost', label: 'What it costs you' },
  { id: 'router', label: 'The Smart Router' },
  { id: 'rankings', label: 'How rankings work' },
  { id: 'page', label: 'Your page and your logo' },
  { id: 'agreement', label: 'The agreement' },
  { id: 'who', label: 'Who can list' },
  { id: 'listed', label: 'Listed providers' },
  { id: 'faq', label: 'Questions' },
];
const n = (id: string) => tocNumber(TOC, id);
const arrow = <span className="lp-ar" aria-hidden="true">→</span>;

const STEPS: Array<[string, string]> = [
  ['Create your provider account', 'Free, with no card. After you confirm your email you add your company.'],
  ['Verify your domain', 'A DNS record proves the domain is yours. Your endpoint and the links to your own site must be on a verified domain.'],
  ['Add your profile and your logo', 'Your company details, links and data-handling declaration, and a square SVG mark that a person reviews.'],
  ['Add your endpoint and your key', 'Your OpenAI-compatible base URL and an API key on an ordinary paid account. We check it with a few short, fixed requests.'],
  ['List your models', 'Each model with its precision, context and your prices, then a readiness check that confirms the settings our tests need.'],
  ['Accept the agreement', 'An owner or admin accepts the Provider Terms and Listing Agreement, and you confirm the address that receives our notices.'],
  ['Submit for review', 'A person reviews every application and every listing, and sends you the decision with its reasons.'],
  ['Choose when we start', 'You start benchmarking each listing when you are ready, see the monthly estimate first, and set a spending cap.'],
];

/** The plan's §6.5 example (our own runs' token use, 2026-11-11) at $0.50 in / $1.50 out per million tokens. */
const EXAMPLE: Array<[string, string, string]> = [
  ['Coding', '180', '$15.99'],
  ['Reasoning', '30', '$7.35'],
  ['Tool use', '30', '$1.80'],
  ['Hourly probe', '720', '$2.56'],
];

const FAQ: Array<[string, string]> = [
  ['Does listing cost anything?', 'No. There is no fee for listing, tests, rankings or routed traffic. Your own account pays for our test traffic at your own prices, and you set a monthly cap.'],
  ['Can we see our scores before they are published?', 'No. You see the same daily means as everyone else, at the same time, one to two days after the day ends: never when a run took place, and never a per-task result.'],
  ['Who chooses when the tests run?', 'We do: coding about every 4 hours, reasoning and tool use daily, and a probe every hour, at times drawn at random within each window. You choose only when measurement starts and stops.'],
  ['What if our key runs out of credit?', 'Measurement pauses with the reason, and a run that failed because of a refused key, exhausted credit or an endpoint that is down never counts. It resumes when a check request answers normally, or when you resume it.'],
  ['Can we pay for a better position?', 'No. Hosted entries are ordered by their measured scores; price breaks only a statistical tie, and offers, payments and profile fields are never used.'],
  ['How do people use our models?', 'Through the Smart Router, with their own key for your service: the request goes to your endpoint with their key, and you bill them as you bill any customer.'],
];

interface DirRow { slug: string; displayName: string; kind: string; regions: string[]; models: string[]; measured: boolean; logoUrl: string | null; offer: boolean }

/** M12: `agreementPublic`: a version of the agreement is public (published or later); until then its page is staff-only, so it is not linked. */
export default async function ListingOpenPage({ agreementPublic = false }: { agreementPublic?: boolean } = {}) {
  const dir = await publicRead<{ providers: DirRow[] }>('/marketplace/public/providers', ['mp:directory']).catch(() => null);
  const providers = dir && dir.kind === 'ok' ? dir.data.providers.filter(p => /^[a-z0-9-]{1,64}$/.test(p.slug)) : [];
  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Inference providers', path: PATH }]),
    webPageLd({ path: PATH, name: OPEN_TITLE, description: OPEN_DESCRIPTION }),
    { '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ]);

  return (
    <ReadingPage
      className="rd-providers rd-providers-open"
      kicker="For inference providers"
      title="List your models"
      accent="measured with our own tests"
      lead="Add your endpoint and your API key, test it, and choose when we start. We benchmark your models on our schedule with your credit, publish what we measure on your own page, and the Smart Router can send you requests from people who bring your key. Listing is free."
      actions={(
        <>
          <BecomeProvider className="lp-btn lp-btn-primary lp-btn-lg" cta="providers-hero-list">Become a provider {arrow}</BecomeProvider>
          {agreementPublic && <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/inference-providers/agreement" data-cta="providers-hero-agreement">Read the agreement</Link>}
        </>
      )}
      note={agreementPublic
        ? <>Already have an account? <Link href={START}>Set up your provider account</Link>.</>
        : <>You can set up your account and test your endpoints now: submission for review opens when the Provider Terms and Listing Agreement is final, and we will email your account&apos;s owner and admins then. Already have an account? <Link href={START}>Set up your provider account</Link>.</>}
      aside={(
        <dl className="lp-facts">
          <div><dt>$0</dt><dd>to list, and no fees on router traffic</dd></div>
          <div><dt>Our schedule</dt><dd>coding every 4 hours, reasoning and tool use daily, a probe every hour</dd></div>
          <div><dt>Your credit</dt><dd>you choose the start, we choose the times</dd></div>
        </dl>
      )}
      toc={TOC}
      final={(
        <RdFinal
          id="list"
          title="List your models"
          lead="Create your provider account, verify your domain and add your endpoint. A person reviews every application."
          actions={(
            <>
              <BecomeProvider className="lp-btn lp-btn-primary lp-btn-lg" cta="providers-final-list">Become a provider {arrow}</BecomeProvider>
              <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/router" data-cta="providers-final-router">Explore the Smart Router</Link>
            </>
          )}
        />
      )}
    >
      <JsonLd data={ld} />

      <RdSection id="how" n={n('how')} title="How listing works" lead="Eight steps, in this order. Your console shows which are done and what is missing.">
        <ol className="ip-steps lp-up" role="list">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="ip-step"><span className="ip-step-n" aria-hidden="true">{i + 1}</span><b>{t}</b><span>{d}</span></li>
          ))}
        </ol>
      </RdSection>

      <RdSection id="measure" n={n('measure')} title="What we measure and publish"
        lead="We test your models with our coding, reasoning and tool-use suites and an hourly probe, on our schedule.">
        <RdRows rows={[
          ['On your endpoint', 'Our benchmark runs go to the endpoint you listed, with your key, at times we choose.'],
          ['From the first run', 'Results count from the first run after you start measurement, good or bad.'],
          ['Daily means, a day or two later', 'We publish each day’s mean per suite in whole points, one to two days after the day ends: never when a run took place, and never a per-task result. You see the same numbers at the same time as everyone else.'],
          ['Failures that never count', 'A run that fails because your key is refused or out of credit, or because your endpoint is down, never counts: measurement pauses with the reason until it works again. A run we interrupt never counts either.'],
          ['Drift', 'A sustained change in a listing’s scores is shown on its page, after the same delay as the scores.'],
        ]} />
      </RdSection>

      <RdSection id="cost" n={n('cost')} title="What it costs you"
        lead="Nothing to us. Your own account pays for our test traffic at your own prices.">
        <RdProse>
          <p>Before you start, we show the monthly estimate for each listing at the prices you declared, and you set a monthly spending cap (by default twice the estimate). Reaching it pauses measurement until the next month or until you raise it. A single run may use at most three times its own estimate.</p>
        </RdProse>
        <div className="ip-table-wrap lp-up">
          <table className="ip-table">
            <caption>An example at $0.50 per million input tokens and $1.50 per million output tokens</caption>
            <thead><tr><th scope="col">Suite</th><th scope="col">Runs a month</th><th scope="col">A month</th></tr></thead>
            <tbody>
              {EXAMPLE.map(([s, r, c]) => <tr key={s}><th scope="row">{s}</th><td>{r}</td><td>{c}</td></tr>)}
              <tr className="is-total"><th scope="row">Total</th><td /><td>about $27.70</td></tr>
            </tbody>
          </table>
        </div>
        <RdProse><p>Your own estimate uses your prices, and your listing’s own runs once it has a week of them.</p></RdProse>
      </RdSection>

      <RdSection id="router" n={n('router')} title="The Smart Router"
        lead="People who use the Smart Router can send requests to your models with their own key for your service.">
        <RdRows rows={[
          ['Keys from your site', 'A user gets a key from you, as any customer does, and adds it to the router. The request goes to your endpoint with that key, and you bill them directly. We add no fee.'],
          ['The router signature', <>Every request the router sends you carries a signature you can verify, so you can tell router traffic from other traffic. See <Link key="s" href="/inference-providers/router-signature">the router signature</Link>.</>],
          ['Offers', 'You can show an offer for router users, such as a discount on router traffic. A person reviews each offer, and offers never change rankings or routing.'],
        ]} />
      </RdSection>

      <RdSection id="rankings" n={n('rankings')} title="How rankings work">
        <RdProse>
          <p>Hosted entries are ordered among themselves by their measured scores; price breaks a statistical tie, and nothing else. A hosted entry joins the main ranking only under the published <Link href="/inference-providers/ranking-criteria">ranking criteria</Link>, which include fresh task versions: until those exist, hosted entries keep their own section. The directory of providers is alphabetical.</p>
        </RdProse>
      </RdSection>

      <RdSection id="page" n={n('page')} title="Your page and your logo">
        <RdRows rows={[
          ['Your page', 'aistupidlevel.info/inference-providers/<you>: your models and prices, what we measured, availability, how to get a key, and your data-handling declaration, marked as declared by you.'],
          ['A page per model', 'Each listing has its own page with its measured history and the model id for the Smart Router.'],
          ['Your logo', <>A square SVG mark, shown on a white tile in both themes. A person reviews every mark against the <Link key="l" href="/inference-providers/logo-standards">logo standards</Link>.</>],
          ['A badge', 'An image you can embed on your own site, linking to your page.'],
        ]} />
      </RdSection>

      <RdSection id="agreement" n={n('agreement')} title="The agreement">
        <RdProse>
          {agreementPublic
            ? <p>Listing is governed by the <Link href="/inference-providers/agreement">Provider Terms and Listing Agreement</Link>, which you can read before you sign. We announce any change to it, and to the ranking criteria, at least 15 days before it applies, and you can close your account before then.</p>
            : <p>Listing is governed by our Provider Terms and Listing Agreement, which is being finalised. You can create your account, set up your endpoints and models and test them now; submission for review opens once the agreement is final, and we will email your account’s owner and admins then. We announce any change to it, and to the ranking criteria, at least 15 days before it applies, and you can close your account before then.</p>}
        </RdProse>
      </RdSection>

      <RdSection id="who" n={n('who')} title="Who can list">
        <RdRows rows={[
          ['Companies', 'Hosts that run, or directly contract, the inference they sell, under a company name, on a domain they verify. Routers and aggregators that forward requests to other providers cannot list.'],
          ['Individuals', 'Individual hosts can’t open a provider account yet. Public listing will open to companies first.'],
        ]} />
      </RdSection>

      <RdSection id="listed" n={n('listed')} title="Listed providers">
        {providers.length ? (
          <ul className="ip-dir lp-up" role="list">
            {providers.map(p => (
              <li key={p.slug}>
                <HostLogo name={p.displayName} logoUrl={p.logoUrl} size={30} />
                <span className="ip-dir-main">
                  <Link href={`/inference-providers/${p.slug}`}>{p.displayName}</Link>
                  <span className="ip-dir-sub">{p.kind === 'company' ? 'Company' : 'Individual'}{p.regions.length ? ` · ${p.regions.join(', ')}` : ''}{p.models.length ? ` · ${p.models.join(', ')}` : ''}</span>
                </span>
                {p.measured && <span className="mp-chip">Measured</span>}
                {p.offer && <span className="mp-chip">Offer</span>}
              </li>
            ))}
          </ul>
        ) : (
          <RdProse><p>No provider is listed yet.</p></RdProse>
        )}
        <RdProse><p className="ip-dir-note">Alphabetical, never by score. <Link href="/inference-providers/ranking-criteria#order">How hosts are ordered</Link></p></RdProse>
      </RdSection>

      <RdSection id="faq" n={n('faq')} title="Questions">
        <RdRows rows={FAQ.map(([q, a]) => [q, a] as [string, string])} />
      </RdSection>
    </ReadingPage>
  );
}
