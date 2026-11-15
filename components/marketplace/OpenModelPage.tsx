import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdFacts, tocNumber } from '@/components/landing/Reading';
import HostedBy from '@/components/marketplace/HostedBy';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbLd } from '@/lib/seo';
import { tokens, usd, type OpenModelPageDTO, type PublicUserTestsDTO } from '@/lib/marketplace-public';
import UserTests from '@/components/marketplace/UserTests';
import '@/styles/marketplace-public.css';

/**
 * An open model outside the fleet (/models/<open-model>, Phase 3 plan §4.6, §7.5): the registry's facts, the hosts
 * that serve it, their prices, the per-host chart of published daily means (M9, components/marketplace/HostLines.tsx:
 * no vendor line, as there is no fleet row), and an FAQ whose answers come from those rows.
 */
export default function OpenModelPage({ data, preview, userTests }: { data: OpenModelPageDTO; preview: boolean; userTests?: PublicUserTestsDTO | null }) {
  const m = data.openModel;
  const measured = data.hosts.filter(h => h.entry.measurement.state === 'measured');
  const cheapest = [...data.hosts].sort((a, b) => a.entry.price.outPerMTok - b.entry.price.outPerMTok)[0];
  // F7: user-run tests of these hosts, only where the API shows them (its switch on, a row or a host to test).
  const tested = userTests && userTests.enabled && (userTests.rows.length > 0 || userTests.testable) ? userTests : null;
  const toc = [{ id: 'hosts', label: 'Hosted by' }, ...(tested ? [{ id: 'tested', label: 'Tested by people' }] : []), { id: 'facts', label: 'The model' }, { id: 'faq', label: 'Questions' }];
  const n = (id: string) => tocNumber(toc, id);
  const faq: Array<[string, string]> = [
    [`Who hosts ${m.name}?`, `${data.hosts.length} listed host${data.hosts.length === 1 ? '' : 's'}: ${data.hosts.map(h => h.provider.displayName).join(', ')}.`],
    [`How many hosts of ${m.name} are measured?`, measured.length ? `${measured.length} of ${data.hosts.length}.` : `None yet: we publish each day's mean one to two days after the day ends.`],
    ...(cheapest ? [[`Which host lists the lowest output price?`, `${cheapest.provider.displayName}, at ${usd(cheapest.entry.price.outPerMTok)} per million output tokens (declared by the host).`] as [string, string]] : []),
  ];
  return (
    <>
      {preview && <div className="mp-staff-banner" role="note">Staff preview — not public</div>}
      <JsonLd data={breadcrumbLd([{ name: 'Models', path: '/models' }, { name: m.name, path: `/models/${m.slug}` }])} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }} />
      <ReadingPage className="mp-openmodel-page" kicker={`Open model · ${m.maker}`} title={m.name} lead={`The hosts that serve ${m.name}, their prices, and how we test them.`} toc={toc}>
        <RdSection id="hosts" n={n('hosts')} title="Hosted by">
          <HostedBy hosts={data.hosts} comparable={data.comparable} title={`${m.name} providers`} chart={{ slug: m.slug }} />
        </RdSection>
        {tested && (
          <RdSection id="tested" n={n('tested')} title="Tested by people">
            <UserTests data={tested} scope="hosts" />
          </RdSection>
        )}
        <RdSection id="facts" n={n('facts')} title="The model">
          <RdFacts rows={[
            ['Maker', m.maker],
            ...(m.licence ? [['Licence', m.licence] as [string, string]] : []),
            ...(m.paramsB ? [['Parameters', `${m.paramsB}B${m.activeParamsB ? ` (${m.activeParamsB}B active)` : ''}`] as [string, string]] : []),
            ...(m.contextTokens ? [['Context', `${tokens(m.contextTokens)} tokens`] as [string, string]] : []),
          ]} />
          {m.weightsUrl && <RdProse><p><a href={m.weightsUrl} rel="nofollow noopener noreferrer" target="_blank">The weights ↗</a></p></RdProse>}
        </RdSection>
        <RdSection id="faq" n={n('faq')} title="Questions">
          <RdProse>{faq.map(([q, a]) => <div key={q}><h3>{q}</h3><p>{a}</p></div>)}</RdProse>
        </RdSection>
        <footer className="mp-page-foot">
          <p><Link href="/inference-providers">Are you an inference provider? List your models →</Link></p>
          <p className="mp-router-cta">The Smart Router is one OpenAI-compatible endpoint whose routing modes choose a model for each request; it reaches a listed host with your own key. <Link href="/router">Explore the Smart Router →</Link></p>
        </footer>
      </ReadingPage>
    </>
  );
}
