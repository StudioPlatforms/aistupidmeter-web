import type { Metadata } from 'next';
import Link from 'next/link';
import { breadcrumbLd, graphLd, pageMeta, webPageLd } from '@/lib/seo';
import JsonLd from '@/components/seo/JsonLd';
import { ReadingPage, RdSection, RdFacts, RdRows, RdFinal, tocNumber } from '@/components/landing/Reading';
import { getVisitTotal } from '@/components/landing/data';
import { agreementPublicNow, providerSignupOpenNow } from '@/lib/provider-public';
import ListingOpenPage, { OPEN_DESCRIPTION, OPEN_TITLE } from './ListingOpen';

/**
 * "Providers" in the landing header, the phone drawer and the footer: inference providers register
 * their interest in listing their models. Until listing opens, the page says only what is true
 * today (listing will be free, and every message reaches us) and sends providers to the contact
 * form's Provider listing topic; how listing works is added when it does. Every claim here must be
 * checkable: change it together with the product.
 *
 * The URL is /inference-providers because nginx sends every path that starts with /providers to the
 * API (the provider health routes), as the per-provider status pages under /status already found.
 *
 * From the opening (M10: ASL_MARKETPLACE=on, so the API's status route says provider sign-up is open) the full page
 * (ListingOpen.tsx, Phase 3 plan §4.4) replaces this one, read at most a minute late.
 */

const PATH = '/inference-providers';
const TITLE = 'Inference providers: list your models';
const DESCRIPTION = 'AI Stupid Level, which runs the Smart Router, is opening listings to inference providers. Listing will be free. Tell us about your service.';

const KEYWORDS = ['inference providers', 'list your models', 'LLM inference provider', 'AI inference API', 'open-weight model hosting'];

export async function generateMetadata(): Promise<Metadata> {
  const open = await providerSignupOpenNow();
  return pageMeta({ title: open ? OPEN_TITLE : TITLE, description: open ? OPEN_DESCRIPTION : DESCRIPTION, path: PATH, keywords: KEYWORDS });
}

const LD = graphLd([
  breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Inference providers', path: PATH }]),
  webPageLd({ path: PATH, name: TITLE, description: DESCRIPTION }),
]);

/** The contact form, opened on its Provider listing topic. */
const CONTACT = '/contact?topic=provider';

const TOC = [
  { id: 'details', label: 'What to tell us' },
  { id: 'router', label: 'The Smart Router' },
  { id: 'register', label: 'Register your interest' },
];
const n = (id: string) => tocNumber(TOC, id);

/** All-time visits, rounded down as the landing's figure strip rounds them (components/landing/Landing.tsx). */
function visitsLabel(visits: number | null): string | null {
  if (visits == null) return null;
  return visits >= 1_000_000 ? `${(Math.floor(visits / 100_000) / 10).toFixed(1)}M+` : `${Math.floor(visits / 1000)}K+`;
}

const arrow = <span className="lp-ar" aria-hidden="true">→</span>;

export default async function InferenceProvidersPage() {
  if (await providerSignupOpenNow()) return <ListingOpenPage agreementPublic={await agreementPublicNow()} />;
  // Read hourly; when the API cannot answer, the figure is left out rather than guessed.
  const visits = visitsLabel(await getVisitTotal());

  return (
    <ReadingPage
      className="rd-providers"
      kicker="For inference providers"
      title="List your models"
      accent="on AI Stupid Level"
      lead="We are opening listings to inference providers. Listing will be free. Tell us about your service and we will contact you."
      actions={(
        <>
          <Link className="lp-btn lp-btn-primary lp-btn-lg" href={CONTACT} data-cta="providers-hero-contact">Register your interest {arrow}</Link>
          <a className="lp-btn lp-btn-ghost lp-btn-lg" href="#router" data-cta="providers-hero-router">About the Smart Router</a>
        </>
      )}
      aside={(
        <dl className="lp-facts">
          <div><dt>$0</dt><dd>to list your models when listings open</dd></div>
          {visits && <div><dt>{visits}</dt><dd>visits since launch</dd></div>}
          <div><dt>0%</dt><dd>markup on tokens through the Smart Router: customers pay providers directly, with their own keys</dd></div>
        </dl>
      )}
      toc={TOC}
      final={(
        <RdFinal
          id="register"
          title="Register your interest"
          lead="Tell us which models you serve and where. We read every message ourselves and will contact you."
          actions={(
            <>
              <Link className="lp-btn lp-btn-primary lp-btn-lg" href={CONTACT} data-cta="providers-final-contact">Register your interest {arrow}</Link>
              <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/router" data-cta="providers-final-router">Explore the Smart Router</Link>
            </>
          )}
        />
      )}
    >
      <JsonLd data={LD} />

      <RdSection id="details" n={n('details')} title="What to tell us"
        lead="If you serve AI models through your own API, these details help us reply.">
        <RdFacts rows={[
          ['Your company', 'Its name, its website and the country it is registered in.'],
          ['Your models', 'The models you serve, the precision each one runs at, and the context length you offer.'],
          ['Your API', 'Its base URL and documentation, and whether it accepts OpenAI-compatible requests.'],
          ['Your prices', 'A link to your pricing page.'],
          ['Your regions', 'Where your endpoints run.'],
        ]} />
      </RdSection>

      <RdSection id="router" n={n('router')} title="The Smart Router"
        lead="AI Stupid Level also runs the Smart Router: one OpenAI-compatible endpoint whose routing modes choose a model for each request.">
        <RdRows rows={[
          ['Customers’ own keys', 'The router calls each model with the customer’s own provider key, so the provider bills the tokens to the customer directly.'],
          ['No markup', 'We add nothing to token prices.'],
          ['OpenAI-compatible', 'Tools built for the OpenAI API connect by setting our base URL, a router key and a routing mode as the model name.'],
        ]} />
        {/* The section body's grid gap already spaces the buttons from the rows. */}
        <div className="lp-cta lp-up" style={{ marginTop: 0 }}>
          <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/router" data-cta="providers-router-explore">Explore the Smart Router {arrow}</Link>
          <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/router/docs" data-cta="providers-router-docs">Read the docs</Link>
        </div>
      </RdSection>
    </ReadingPage>
  );
}
