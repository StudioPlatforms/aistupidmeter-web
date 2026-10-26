import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdRows, RdFinal, tocNumber } from '@/components/landing/Reading';

/**
 * Terms of Service. Prices, trials and cancellation match the pricing page (lib/entitlements.ts,
 * app/pricing/PricingClient.tsx) as of 2026-10-19; keep them in step.
 */

export const metadata: Metadata = pageMeta({
  title: 'Terms of service',
  description: 'Terms for using AI Stupid Level: accounts, the Smart Router with your own provider keys, plans and payments, acceptable use, benchmark data and liability.',
  path: '/terms',
});

const UPDATED = '19 October 2026';
const EMAIL = 'hello@aistupidlevel.info';

const TOC = [
  { id: 'agreement', label: 'The agreement' },
  { id: 'service', label: 'The service' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'router', label: 'Smart Router and your provider keys' },
  { id: 'plans', label: 'Plans, trials and payment' },
  { id: 'withdrawal', label: 'EU consumers: right of withdrawal' },
  { id: 'use', label: 'Acceptable use' },
  { id: 'data', label: 'Benchmark data and the Data API' },
  { id: 'content', label: 'Your content' },
  { id: 'ip', label: 'Our intellectual property' },
  { id: 'warranty', label: 'No warranty' },
  { id: 'liability', label: 'Liability' },
  { id: 'termination', label: 'Suspension and termination' },
  { id: 'changes', label: 'Changes' },
  { id: 'law', label: 'Governing law' },
];
const n = (id: string) => tocNumber(TOC, id);
const Mail = () => <a href={`mailto:${EMAIL}`}>{EMAIL}</a>;

export default function TermsPage() {
  return (
    <ReadingPage
      className="rd-legal"
      kicker="Legal"
      title="Terms of Service"
      lead={<>The rules for using AI Stupid Level, its Smart Router and its data. Last updated {UPDATED}.</>}
      actions={(
        <>
          <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/pricing">Plans and pricing <span className="lp-ar" aria-hidden="true">→</span></Link>
          <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/privacy">Privacy Policy</Link>
        </>
      )}
      toc={TOC}
      final={(
        <RdFinal
          id="contact-terms"
          title="Questions about these terms?"
          lead={<>Write to <Mail /> or use the contact form.</>}
          actions={<Link className="lp-btn lp-btn-primary lp-btn-lg" href="/contact">Contact us <span className="lp-ar" aria-hidden="true">→</span></Link>}
        />
      )}
    >
      <RdSection id="agreement" n={n('agreement')} title="The agreement">
        <RdProse>
          <p>
            These terms are an agreement between you and <b>S.C. STUDIO PLATFORMS S.R.L.</b>, Craiova, Dolj County, Romania
            (&ldquo;we&rdquo;), which operates AI Stupid Level at aistupidlevel.info (&ldquo;ASL&rdquo;). By using the site, creating an
            account or using the API, you accept them. If you use ASL for an organisation, you accept them for that organisation and
            confirm you may do so. Our <Link href="/privacy">Privacy Policy</Link> explains how we handle personal data.
          </p>
          <p>
            A separately signed agreement (for example an Enterprise contract or an assessment order) takes precedence over these terms
            where they differ.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="service" n={n('service')} title="The service">
        <RdProse>
          <p>
            ASL measures AI models on a fixed schedule and publishes the results (leaderboards, model pages, drift detection and
            alerts). It also offers the Smart Router, an OpenAI-compatible API that chooses a model for each request based on our
            measurements, and the Data API, which serves our data as JSON. Features differ by plan, as shown on
            the <Link href="/pricing">pricing page</Link>. We improve and change the service over time and may add, change or remove
            features. If we remove a paid feature you rely on, we will tell you in advance where we reasonably can.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="accounts" n={n('accounts')} title="Accounts">
        <RdRows rows={[
          ['Who can sign up', 'You must be at least 16 and give a real email address.'],
          ['Keep it secure', 'Keep your password, router keys, Data API keys and provider keys secret. You are responsible for what happens under your account and keys. Tell us at once if you think one has been misused, and revoke the key.'],
          ['One person per account', 'An account is for one person. Teams use a workspace, with a seat for each member.'],
        ]} />
      </RdSection>

      <RdSection id="router" n={n('router')} title="Smart Router and your provider keys">
        <RdRows rows={[
          ['Your keys, your provider accounts', 'The Smart Router calls AI providers (OpenAI, Anthropic, Google, DeepSeek, Moonshot, Zhipu) with the provider keys you add. The provider bills you directly for that usage, under your agreement with it. We do not resell model access and do not mark up provider prices.'],
          ['Provider terms apply', 'You are responsible for complying with each provider’s terms and usage policies for the requests you send, and for having the rights to the content you send.'],
          ['Routing is a recommendation', 'We choose models based on our measurements, your settings and the providers you enabled. We do not guarantee that a chosen model gives a correct, complete or suitable answer, or that a provider is available. Check outputs before relying on them.'],
          ['Allowances and limits', 'Each plan includes a monthly request allowance and rate limits, shown on the pricing page. Requests beyond the allowance may be refused until the next period, unless you have prepaid credits.'],
          ['Sandbox', 'Requests marked as sandbox requests return mock answers, call no provider and do not count against your allowance.'],
        ]} />
      </RdSection>

      <RdSection id="plans" n={n('plans')} title="Plans, trials and payment">
        <RdRows rows={[
          ['Prices', 'Prices are in US dollars and shown on the pricing page, excluding any applicable tax. Payments are processed by Stripe.'],
          ['Free trials', 'Some plans start with a free trial, which collects a payment method. Unless you cancel before the trial ends, the subscription starts and you are charged.'],
          ['Renewal', 'Subscriptions renew automatically, monthly or yearly, until you cancel.'],
          ['Cancelling', 'Cancel any time from the billing portal in Settings. You keep the paid plan until the end of the period already paid for, and you are not charged again.'],
          ['Price changes', 'We will tell you about a price change for your subscription at least 30 days before it applies. You can cancel before then.'],
          ['Refunds', 'Except where the law requires it (see the next section) or we say otherwise in writing (for example the assessment’s refund promise), payments are not refunded.'],
          ['Failed payments', 'If a payment fails, Stripe retries it. If the subscription is cancelled because payment could not be collected, the account returns to the Free plan.'],
        ]} />
      </RdSection>

      <RdSection id="withdrawal" n={n('withdrawal')} title="EU consumers: right of withdrawal">
        <RdProse>
          <p>
            If you are a consumer in the European Union, you may withdraw from a paid subscription within 14 days of buying it, without
            giving a reason, by telling us at <Mail />. We refund what you paid within 14 days, by the method you paid with. If you
            asked us to start the paid plan during those 14 days, we may keep an amount in proportion to the service already provided.
            A free trial costs nothing, so withdrawal during a trial is simply cancelling it.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="use" n={n('use')} title="Acceptable use">
        <RdProse><p>You must not:</p></RdProse>
        <RdRows rows={[
          ['Break the law', 'or use ASL to harm others, or to send requests that violate a provider’s usage policies.'],
          ['Scrape or overload', 'Collect our data with bots or scrapers, or exceed rate limits, instead of using the Data API with a key.'],
          ['Get around limits', 'Share or resell accounts or keys, use several accounts to get around plan limits, or bypass payment, authentication or security.'],
          ['Attack the service', 'Probe, scan or test our systems for vulnerabilities without our written permission, or interfere with other users. Report security issues to us instead.'],
          ['Game the benchmarks', 'Try to extract our private test tasks, or manipulate measurements, ratings or community runs.'],
          ['Abuse the community', 'Post spam, harassment or illegal content in the forum or through our forms.'],
        ]} />
      </RdSection>

      <RdSection id="data" n={n('data')} title="Benchmark data and the Data API">
        <RdRows rows={[
          ['Citing our results', 'You may quote and link to individual results, charts and rankings, with credit to “AI Stupid Level” and a link to aistupidlevel.info.'],
          ['Using the Data API', 'Use the data within your plan’s limits, in your own products and analysis. Keep your Data API key private.'],
          ['What needs a licence', 'Republishing the dataset in bulk, reselling it, or offering it as a competing dataset or service needs a written data licence from us.'],
          ['Measurements, not guarantees', 'Scores are measurements made with our tests at a given time. Models change, and our methods change too (they are published on the methodology page). We correct errors when we find them, but we do not guarantee that any score is complete or error-free.'],
        ]} />
      </RdSection>

      <RdSection id="content" n={n('content')} title="Your content">
        <RdProse>
          <p>
            You keep all rights to what you send through the Smart Router and to the answers you receive, as between you and us. You give
            us permission to process it only to provide the service to you. We do not use your requests to train models or to build our
            benchmarks. Forum posts are public: by posting, you let us display them on ASL. You can delete your account at any time.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="ip" n={n('ip')} title="Our intellectual property">
        <RdProse>
          <p>
            The ASL name and logo, the site&rsquo;s design and text, our test tasks and our data belong to us. The web application&rsquo;s
            source code and the official SDKs are published under their own open-source licences, which apply to that code. These terms
            do not give you any other right to our trademarks or intellectual property.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="warranty" n={n('warranty')} title="No warranty">
        <RdProse>
          <p>
            ASL is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the extent the law allows, we make no warranties that it will be
            uninterrupted, error-free or fit for a particular purpose, or about the outputs of the AI models it routes to. Nothing here
            limits rights you have as a consumer that cannot be limited by contract.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="liability" n={n('liability')} title="Liability">
        <RdProse>
          <p>
            To the extent the law allows, we are not liable for indirect or consequential loss, lost profits, lost data, or what an AI
            model outputs or a provider charges. Our total liability for any claims about ASL in any 12 months is limited to the amount
            you paid us in those 12 months, or EUR 100 if that is more. These limits do not apply to liability for intent or gross
            negligence, for death or personal injury, or to any liability that cannot be limited by law.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="termination" n={n('termination')} title="Suspension and termination">
        <RdProse>
          <p>
            You can stop using ASL and delete your account at any time. We may suspend or close an account, or revoke keys, that breach
            these terms or put the service or other users at risk. Unless the breach is serious or the law prevents it, we will warn you
            first and give you a chance to fix it. If we close a paid account without a breach on your part, we refund the unused part of
            the period you paid for.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="changes" n={n('changes')} title="Changes">
        <RdProse>
          <p>
            We may update these terms. We change the date at the top, and for a material change we email account holders at least 30 days
            before it takes effect. If you do not agree, you can cancel before then. Continuing to use ASL after that means you accept the
            new terms.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="law" n={n('law')} title="Governing law">
        <RdProse>
          <p>
            These terms are governed by Romanian law. Disputes go to the competent courts of Craiova, Romania. If you are a consumer, you
            also keep the protection of the mandatory laws of the country where you live, and you may bring a claim in the courts there.
          </p>
        </RdProse>
      </RdSection>
    </ReadingPage>
  );
}
