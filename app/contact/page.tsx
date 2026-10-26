import type { Metadata } from 'next';
import { breadcrumbLd, graphLd, pageMeta, webPageLd } from '@/lib/seo';
import JsonLd from '@/components/seo/JsonLd';
import type { CSSProperties } from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';
import LandingEffects from '@/components/landing/LandingEffects';
import { lpBody, lpDisplay } from '@/lib/fonts';
import ContactClient from './ContactClient';
import '@/styles/landing.css';
import '@/styles/landing-forms.css';
import '@/styles/contact.css';

const TITLE = 'Contact AI Stupid Level';
const DESCRIPTION = 'Talk to the AI Stupid Level team about plans, enterprise data licensing, support or security. A small team that reads and answers its own email.';

export const metadata: Metadata = pageMeta({
  title: TITLE,
  description: DESCRIPTION,
  path: '/contact',
});

const CONTACT_LD = graphLd([
  breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Contact', path: '/contact' }]),
  { ...webPageLd({ path: '/contact', name: TITLE, description: DESCRIPTION }), '@type': 'ContactPage' },
]);

/** useSearchParams needs either a Suspense boundary or a dynamic page; it has both. */
export const dynamic = 'force-dynamic';

const intro = (d: string): CSSProperties => ({ '--d': d } as CSSProperties);

/**
 * The landing page's look (styles/landing.css) inside the site's own top bar, like /status and
 * /ai-drift-detection. One screen on wider displays: who we are and the other routes on the left,
 * the form on the right. On phones the form comes straight after the introduction.
 */
export default function ContactPage() {
  return (
    <SubpageLayout>
      <JsonLd data={CONTACT_LD} />
      <div className={`lp lp-sub lp-contact ${lpBody.variable} ${lpDisplay.variable}`}>
        {/* Reveal-on-scroll hides blocks only once scripts run; the failsafe shows everything if they never do. */}
        <script dangerouslySetInnerHTML={{ __html: "(function(){var d=document.documentElement;d.classList.add('lp-js');setTimeout(function(){if(!window.__lpReady)d.classList.remove('lp-js')},4000)})();" }} />
        <LandingEffects />

        <header className="lp-hero lp-textured">
          <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="lp-wrap ct-grid">
            <div className="ct-intro">
              <p className="lp-kicker lp-intro" style={intro('.04s')}>Contact</p>
              <h1 className="lp-h1 lp-intro" style={intro('.1s')}>
                Talk to us <span className="lp-b">A person reads every message</span>
              </h1>
              <p className="lp-lead lp-intro" style={intro('.18s')}>
                We are a small team and we answer our own email. Whether you are evaluating a plan, running
                into something broken, or reporting a security issue, this reaches us directly.
              </p>
            </div>

            <div className="ct-form-col">
              <Suspense fallback={<div className="lf-card lf-card-wait" aria-busy="true" aria-label="Loading the form" />}>
                <ContactClient />
              </Suspense>
            </div>

            <ul className="ct-notes lp-intro" style={intro('.3s')}>
              <li>
                <h2>Evaluating for a team?</h2>
                <p>
                  Enterprise covers single sign-on, SCIM provisioning, the audit trail, contracted scope
                  and invoicing. Tell us your identity provider and seat count and we will come back with
                  specifics.
                </p>
                <Link href="/pricing" className="ct-more" data-cta="contact-plans">Compare the plans <span aria-hidden="true">→</span></Link>
              </li>
              <li>
                <h2>Want a decision, not a dashboard?</h2>
                <p>
                  The workload assessment runs your own tasks against three candidate models and returns a
                  written recommendation.
                </p>
                <Link href="/assessment" className="ct-more" data-cta="contact-assessment">About the assessment <span aria-hidden="true">→</span></Link>
              </li>
              <li>
                <h2>Security reports</h2>
                <p>
                  We will not pursue anyone who reports a genuine issue in good faith, gives us reasonable
                  time to fix it, and does not access other people&rsquo;s data while proving it.
                </p>
              </li>
              <li>
                <h2>What helps us answer quickly</h2>
                <p>
                  For support, the page or request that went wrong and roughly when, so we can find it in
                  the logs. For data licensing, which fields and which time span you need, and what you
                  will build with them. For a security report, the steps that reproduce it. Replies come
                  by email, on business days.
                </p>
                <Link href="/faq" className="ct-more" data-cta="contact-faq">Questions the FAQ already answers <span aria-hidden="true">→</span></Link>
              </li>
            </ul>
          </div>
        </header>
      </div>
    </SubpageLayout>
  );
}
