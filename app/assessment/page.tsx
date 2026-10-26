import type { Metadata } from 'next';
import { ORG_ID, SITE, breadcrumbLd, graphLd, pageMeta, webPageLd } from '@/lib/seo';
import JsonLd from '@/components/seo/JsonLd';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';
import LandingEffects from '@/components/landing/LandingEffects';
import { lpBody, lpDisplay } from '@/lib/fonts';
import { ASSESSMENT_PRICE_LABEL, ASSESSMENT_PRICE_USD } from '@/lib/assessment-price';
import AssessmentClient from './AssessmentClient';
import '@/styles/landing.css';
import '@/styles/landing-forms.css';
import '@/styles/assessment.css';

const TITLE = 'Workload assessment: your tasks, 3 models';
// The price is read from lib/assessment-price.ts, never typed here.
const DESCRIPTION = `Up to 20 of your own tasks on three candidate models, a decision report in seven business days. ${ASSESSMENT_PRICE_LABEL}, refunded if we cannot measure your workload.`;

export const metadata: Metadata = pageMeta({
  title: TITLE,
  description: DESCRIPTION,
  path: '/assessment',
});

/** The page, its breadcrumb and the assessment as a Service with its one fixed price. */
const ASSESSMENT_LD = graphLd([
  breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Workload assessment', path: '/assessment' }]),
  webPageLd({ path: '/assessment', name: TITLE, description: DESCRIPTION }),
  {
    '@type': 'Service',
    '@id': `${SITE}/assessment#service`,
    name: 'Workload assessment',
    serviceType: 'AI model evaluation on a customer’s own tasks',
    description: DESCRIPTION,
    url: `${SITE}/assessment`,
    provider: { '@id': ORG_ID },
    offers: {
      '@type': 'Offer',
      price: String(ASSESSMENT_PRICE_USD),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE}/assessment`,
      seller: { '@id': ORG_ID },
    },
  },
]);

const intro = (d: string): CSSProperties => ({ '--d': d } as CSSProperties);

const Tick = () => (
  <svg className="as-ic" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Shield = () => (
  <svg className="as-ic" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 2.5 4 4.8v4.6c0 3.7 2.5 6.6 6 8.1 3.5-1.5 6-4.4 6-8.1V4.8L10 2.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="m7.3 10 1.9 1.9 3.6-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * The assessment offer and its booking form, in the landing page's look (like /pricing and
 * /contact). States exactly what is included, what happens after payment, and the two refund
 * conditions — a fixed-scope first purchase only works if nothing about it is vague. The form
 * (AssessmentClient) stores the request and continues to Stripe Checkout (lib/assessment.ts).
 */
export default function AssessmentPage({ searchParams }: { searchParams?: { cancelled?: string } }) {
  return (
    <SubpageLayout>
      <JsonLd data={ASSESSMENT_LD} />
      <div className={`lp lp-sub lp-asmt ${lpBody.variable} ${lpDisplay.variable}`}>
        {/* Reveal-on-scroll hides blocks only once scripts run; the failsafe shows everything if they never do. */}
        <script dangerouslySetInnerHTML={{ __html: "(function(){var d=document.documentElement;d.classList.add('lp-js');setTimeout(function(){if(!window.__lpReady)d.classList.remove('lp-js')},4000)})();" }} />
        <LandingEffects />

        <header className="lp-hero lp-textured">
          <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="lp-wrap">
            <div className="lp-hero-row">
              <div>
                <p className="lp-kicker lp-intro" style={intro('.04s')}>Workload assessment</p>
                <h1 className="lp-h1 lp-intro" style={intro('.1s')}>
                  Is the model you chose <span className="lp-b">still the right one?</span>
                </h1>
                <p className="lp-lead lp-intro" style={intro('.18s')}>
                  A fixed-scope assessment of one workload against three candidate models, using your tasks rather than
                  ours. You get a decision report within seven business days of us having what we need — including, where
                  the evidence supports it, a recommendation to change nothing.
                </p>
                <p className="as-price lp-intro" style={intro('.24s')}>
                  <b>{ASSESSMENT_PRICE_LABEL}</b>
                  <span>one-off, fixed scope · USD, excluding any applicable tax</span>
                </p>
                <div className="lp-cta lp-intro" style={intro('.3s')}>
                  <a className="lp-btn lp-btn-primary lp-btn-lg" href="#book" data-cta="assessment-hero-book">Book your assessment <span className="lp-ar" aria-hidden="true">→</span></a>
                  <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/contact?topic=sales" data-cta="assessment-hero-contact">Questions first? Talk to us</Link>
                </div>
              </div>
              <dl className="lp-facts lp-intro" style={intro('.38s')}>
                <div><dt>20</dt><dd>of your own tasks at most, with the answer keys held out of the prompts</dd></div>
                <div><dt>3</dt><dd>candidate models, several trials per task</dd></div>
                <div><dt>7</dt><dd>business days from us having your tasks to the decision report</dd></div>
              </dl>
            </div>
          </div>
        </header>

        <section className="lp-sec lp-A">
          <div className="lp-wrap as-grid">
            <div className="as-info">
              <div className="as-block lp-up">
                <p className="lp-kicker">Scope</p>
                <h2 className="as-h">What is included</h2>
                <ul className="as-list">
                  <li><Tick /><span>One workload, up to 20 tasks you supply, with the answer keys held out of the prompts</span></li>
                  <li><Tick /><span>Three candidate models, up to 1,000 standard execution units, several trials per task</span></li>
                  <li><Tick /><span>Two hours of expert time, and a concise decision report</span></li>
                </ul>
              </div>

              <div className="as-block lp-up">
                <p className="lp-kicker">Process</p>
                <h2 className="as-h">How it works</h2>
                <ol className="as-steps">
                  <li><span><b>Book and pay</b> below. Payment is by card through Stripe, and an invoice with your company details is issued automatically.</span></li>
                  <li><span><b>We confirm the scope within two business days</b> — the tasks, the three models and what “good” means for your workload.</span></li>
                  <li><span><b>You send your tasks.</b> We build the suite and run it repeatedly against the candidates.</span></li>
                  <li><span><b>You get the report</b> within seven business days of us having your tasks.</span></li>
                </ol>
              </div>

              <div className="as-block lp-up">
                <p className="lp-kicker">Guarantees</p>
                <h2 className="as-h">If it does not work out</h2>
                <ul className="as-list as-guarantees">
                  <li><Shield /><span>If, once we have read your workload, we cannot measure it, we refund the full amount before any work starts.</span></li>
                  <li><Shield /><span>If we cannot deliver the agreed report, we refund in full.</span></li>
                  <li><Shield /><span>The full amount is credited against an annual plan bought within 30 days, up to that plan’s price — with Teams, the year costs nothing extra.</span></li>
                </ul>
              </div>

              <p className="as-muted lp-up">
                Provider inference is billed to your own API keys under a cap you agree first, so the cost of running
                the models is never hidden in our price. Your tasks stay yours: never published, never added to the
                public benchmark.
              </p>
            </div>

            <div className="as-form-col" id="book">
              <AssessmentClient cancelled={searchParams?.cancelled === '1'} />
            </div>
          </div>
        </section>
      </div>
    </SubpageLayout>
  );
}
