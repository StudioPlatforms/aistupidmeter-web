import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdRows, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { AsOf, Verdict } from '@/components/seo/Verdict';
import { CtaRow, RouterCta } from '@/components/seo/Cta';
import { breadcrumbLd, faqLd, graphLd, isoDay, utcStamp, webPageLd } from '@/lib/seo';
import { getBoards24h } from '@/lib/seo-data';
import {
  CATEGORY_LABEL, DOCS_INTEGRATIONS_PATH, DOCS_STRATEGIES_PATH, GETS_PASSTHROUGH, GETS_ROUTED, INTEGRATIONS_PATH, TROUBLE_SHARED,
  integrationLabel, integrationPath, type Integration,
} from '@/lib/integrations';
import { IntegrationFaq, ModeRows, OtherTools, SettingsCard, Steps, TroubleRows } from './IntegrationBlocks';
import { RichText, plainText } from './RichText';
import '@/styles/seo.css';
import '@/styles/seo-integrations.css';

/**
 * /router/integrations/<tool>: one tool's guide to the Smart Router, rendered by
 * app/router/integrations/[tool]/page.tsx from lib/integrations.ts. Reading style inside
 * SubpageLayout (ReadingPage brings the layout, the fonts, landing.css and reading.css).
 *
 * The static copy names the tool, the provider families and the routing modes. Model names
 * appear solely as the current top of each board the tool's modes read, from the 24-hour boards
 * through lib/boards-core's statistical ranks. Never calls auth(), cookies() or
 * headers(), so the page stays ISR; when the boards do not answer, the live lines are left out.
 */

const ACCENT = 'with the AI Stupid Level Smart Router';

const TOC = [
  { id: 'what', label: 'What you get' },
  { id: 'setup', label: 'Setup' },
  { id: 'modes', label: 'Routing mode' },
  { id: 'supports', label: 'What it supports' },
  { id: 'trouble', label: 'Troubleshooting' },
  { id: 'faq', label: 'FAQ' },
  { id: 'more', label: 'Other tools' },
];
const num = (id: string) => tocNumber(TOC, id);

export default async function IntegrationPage({ integration: i }: { integration: Integration }) {
  const boards = await getBoards24h();
  const name = integrationLabel(i);
  const path = integrationPath(i.slug);
  const h1 = `${name} ${ACCENT}`;
  const cta = `integration-${i.slug}`;
  const passthrough = i.routing === 'passthrough';
  const trouble = [...(i.troubleshooting ?? []), ...TROUBLE_SHARED];

  const ld = graphLd([
    breadcrumbLd([
      { name: 'Home', path: '/' },
      { name: 'Smart Router', path: '/router' },
      { name: 'Integrations', path: INTEGRATIONS_PATH },
      { name, path },
    ]),
    webPageLd({
      path,
      name: h1,
      description: i.description,
      type: 'TechArticle',
      ...(boards ? { dateModified: isoDay(boards.generatedAt) } : {}),
      about: { '@type': 'SoftwareApplication', name: i.name, applicationCategory: 'DeveloperApplication' },
    }),
    faqLd(i.faq.map((f) => ({ q: f.q, a: plainText(f.a) }))),
  ]);

  return (
    <ReadingPage
      className="rd-in"
      kicker={`Smart Router · ${CATEGORY_LABEL[i.category]}`}
      title={name}
      accent={ACCENT}
      lead={<RichText text={i.summary} />}
      actions={(
        <CtaRow className="is-stack">
          <RouterCta cta={`${cta}-key`} />
          <div className="seo-cta">
            <Link className="lp-btn lp-btn-ghost" href={i.docsAnchor} data-cta={`${cta}-hero-docs`}>The router documentation</Link>
          </div>
        </CtaRow>
      )}
      note={<>Part of <Link href={INTEGRATIONS_PATH}>Smart Router integrations</Link> · <Link href="/router">About the Smart Router</Link> · <Link href="/router/help">Help centre</Link></>}
      aside={<SettingsCard code={i.settings} name={i.name} />}
      toc={TOC}
      final={(
        <RdFinal
          title={`Connect ${i.name} in a few minutes`}
          lead="A free account gives you a router key, the Providers page for your own keys, and the request allowance. No card."
          actions={(
            <CtaRow className="is-stack">
              <RouterCta cta={`${cta}-final-key`} />
              <div className="seo-cta">
                <Link className="lp-btn lp-btn-ghost" href={DOCS_INTEGRATIONS_PATH} data-cta={`${cta}-final-docs`}>Every integration in the docs</Link>
              </div>
            </CtaRow>
          )}
        />
      )}
    >
      <JsonLd data={ld} />

      <RdSection id="what" n={num('what')} title={`What ${i.name} gets from the Smart Router`}>
        <Verdict className="lp-up"><RichText text={i.summary} /></Verdict>
        <RdRows rows={(passthrough ? GETS_PASSTHROUGH : GETS_ROUTED).map(([k, v]) => [k, <RichText key={k} text={v} />])} />
      </RdSection>

      <RdSection
        id="setup"
        n={num('setup')}
        title={`How to set up ${i.name} with the Smart Router`}
        lead={<>Every value below is the one in the <Link href={i.docsAnchor}>router documentation</Link>; paste it as shown.</>}
      >
        <Steps steps={i.steps} name={i.name} cta={`${cta}-setup`} />
      </RdSection>

      <RdSection
        id="modes"
        n={num('modes')}
        title={passthrough ? `Which model does ${i.name} use?` : `Which routing mode should ${i.name} use?`}
        lead={passthrough ? undefined : <>A routing mode goes where the tool asks for a model name. The quality modes read the same scores the leaderboard shows; the value modes choose among models within 5 points of the best and take the lowest measured cost per run. Every mode is described in the <Link href={DOCS_STRATEGIES_PATH}>Virtual models</Link> section of the docs.</>}
      >
        {i.modesNote && <RdProse><p><RichText text={i.modesNote} /></p></RdProse>}
        {passthrough && boards && (
          <AsOf className="lp-up">
            As of {utcStamp(boards.generatedAt)} · this path passes through to Anthropic and does not route · the boards the routed tools use are on <Link href="/">the full leaderboard</Link>
          </AsOf>
        )}
        {!passthrough && i.modes.length > 0 && <ModeRows modes={i.modes} boards={boards} />}
        {!passthrough && boards && (
          <AsOf className="lp-up">
            24-hour boards as of {utcStamp(boards.generatedAt)} · places follow the leaderboard’s statistical ties · <Link href="/">the full leaderboard</Link>
          </AsOf>
        )}
        {!passthrough && (
          <RdProse>
            <p>
              Any real model id from <code>GET /v1/models</code> pins that model and bypasses routing; your plan allowance and key budgets
              still apply. Unknown <code>auto-*</code> names get a <code>400 model_not_found</code> that lists the valid ones.
            </p>
          </RdProse>
        )}
      </RdSection>

      <RdSection id="supports" n={num('supports')} title={`What ${i.name} supports behind the router`}>
        <ul className="rd-ticks lp-up">
          {i.caveats.map((c) => <li key={c}><RichText text={c} /></li>)}
        </ul>
      </RdSection>

      <RdSection
        id="trouble"
        n={num('trouble')}
        title={`${i.name} not working with the router?`}
        lead={<>The errors a tool shows, with the fix from the docs’ <Link href="/router/docs#errors">error table</Link> and the <Link href="/router/help">help centre</Link>.</>}
      >
        <TroubleRows rows={trouble} />
      </RdSection>

      <RdSection id="faq" n={num('faq')} title={`Questions about ${i.name} and the Smart Router`}>
        <IntegrationFaq items={i.faq} />
      </RdSection>

      <RdSection
        id="more"
        n={num('more')}
        title="Other tools that work with the Smart Router"
        lead={<>Every tool takes the same base URL and key. The <Link href={INTEGRATIONS_PATH}>integrations hub</Link> lists them all; the <Link href={DOCS_INTEGRATIONS_PATH}>docs</Link> add samples for frameworks and SDKs.</>}
      >
        <OtherTools current={i.slug} />
      </RdSection>
    </ReadingPage>
  );
}
