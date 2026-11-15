import Link from 'next/link';
import HostLogo from '@/components/marketplace/HostLogo';
import { Pane, Note, Empty } from '@/components/studio';
import '@/styles/marketplace-public.css';
import { longDay, type PublicUserTestsDTO, type PublicUserTestRow } from '@/lib/marketplace-public';

/**
 * User-run tests of listed hosts (Phase 3 plan §7.7, as Phase 4 §6.4 changes it; F7): runs people made with their own
 * key at a host, on fresh task versions, in the anonymous-aggregate form of the model pages' "Tested by others with their
 * own keys" (ModelDetailCommunityTests). The honesty note comes first. Each row is one host and suite (reasoning: one
 * scenario, by its number of the four, so two scenarios never share a median): the median of the independent testers'
 * tests in whole points, their range (from two tests), how many tests from how many accounts, the newest day. Testers who
 * chose to show their name are named; a provider's own accounts are shown apart and never in the median. Never a task, a
 * turn or a single run's detail. The API decides everything (nothing while its switch is off); a row is never computed here.
 * "Test it with your own key" opens Test your keys on its Listed host option (`?listed=1`, with the first row's listing
 * when there is one: F7 review web SHOULD-5).
 *
 * `framed`: the fleet model page's studio Pane; the entry and open-model reading pages keep their own section look
 * (F5's D18: a reading page is not the studio app). The words are the same either way.
 */
const SUITE_LABEL: Record<PublicUserTestRow['suite'], string> = { coding: 'Coding', reasoning: 'Reasoning', tooling: 'Tool use' };

function suiteText(r: PublicUserTestRow): string {
  return r.suite === 'reasoning' && r.scenario !== null ? `Reasoning, scenario ${r.scenario}${r.scenarios ? ` of ${r.scenarios}` : ''}` : SUITE_LABEL[r.suite];
}
/** "3 tests from 3 accounts: Ada Tester and 2 more" (accounts, as the API counts them: F7 review code-security MINOR-4). */
function testersText(r: PublicUserTestRow): string {
  const names = r.named.slice(0, 3);
  const more = r.testers - names.length;
  const n = `${r.runs} test${r.runs === 1 ? '' : 's'} from ${r.testers} account${r.testers === 1 ? '' : 's'}`;
  if (!names.length) return n;
  return `${n}: ${names.join(', ')}${more > 0 ? ` and ${more} more` : ''}`;
}

export default function UserTests({ data, scope, framed, testHref }: {
  data: PublicUserTestsDTO; scope: 'entry' | 'hosts'; framed?: boolean; testHref?: string;
}) {
  if (!data.enabled || (!data.rows.length && !data.testable)) return null;
  const href = testHref ?? `/router/test-keys?listed=1${data.rows.length ? `&listing=${data.rows[0].listing}` : ''}`;
  const runs = data.rows.reduce((a, r) => a + r.runs + r.providerRuns, 0);
  const title = scope === 'entry' ? 'Tested by people with their own key at this host' : 'Tested at these hosts by people with their own keys';
  const sub = data.rows.length ? `${runs} test${runs === 1 ? '' : 's'} in the last 90 days` : undefined;
  const list = data.rows.length ? (
    <ul className={framed ? 'mp-ut-list is-framed' : 'mp-ut-list'}>
      {data.rows.map(r => (
        <li key={`${r.listing}-${r.suite}-${r.scenario ?? 0}`}>
          {scope === 'hosts' && (
            <span className="mp-ut-host">
              <HostLogo name={r.host.displayName} logoUrl={r.host.logoUrl} size={framed ? 30 : 24} />
              <Link href={r.entry.path}>{r.host.displayName}</Link>
            </span>
          )}
          <span className="mp-ut-suite">{suiteText(r)}</span>
          <span className="mp-ut-med">
            {r.median !== null ? <><b>{r.median}</b> <span className="mp-muted">median of {r.runs}</span></> : <span className="mp-muted">no independent test yet</span>}
          </span>
          {r.min !== null && r.max !== null && r.runs >= 2 && <span className="mp-muted">range {r.min}–{r.max}</span>}
          {r.runs > 0 && <span className="mp-muted">{testersText(r)}</span>}
          <span className="mp-muted">latest {longDay(`${r.latest}T12:00:00Z`)}</span>
          {r.providerRuns > 0 && (
            <span className="mp-muted mp-ut-own">
              Also tested by {r.host.displayName}&apos;s own accounts, not in the median: {r.providerRuns} test{r.providerRuns === 1 ? '' : 's'}{r.providerMedian !== null ? `, median ${r.providerMedian}` : ''}
            </span>
          )}
        </li>
      ))}
    </ul>
  ) : null;
  const action = data.testable ? <Link className={framed ? 'st-btn is-sm' : 'mp-ut-cta'} href={href}>Test it with your own key</Link> : null;
  if (framed) {
    // The Pane's props are the same on every render (StudioEffects keeps its reveal class): the data is the server's.
    return (
      <Pane className="mp-ut-pane" title={title} sub={sub} actions={action} ruled flush>
        <div className="mp-ut-note"><Note>{data.note}</Note></div>
        {list ?? <div className="mp-ut-empty"><Empty title="No tests yet">Run one from Test your keys, with your own key at the host.</Empty></div>}
      </Pane>
    );
  }
  return (
    <div className="mp-ut">
      <p className="mp-ut-lead">{data.note}</p>
      {list ?? <p className="mp-caption">No tests yet. Run one from Test your keys, with your own key at the host.</p>}
      {action && <p className="mp-caption">{action}</p>}
    </div>
  );
}
