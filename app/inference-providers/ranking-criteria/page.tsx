import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdRows, tocNumber } from '@/components/landing/Reading';
import { marketplaceStaffGate, providerPageMetadata } from '@/lib/provider-gate';
import { marketplaceRead, type DirectoryDTO } from '@/lib/marketplace-public';
import { DIRECTORY_PATH } from '@/lib/marketplace-open';
import { PublishedParagraph } from '@/components/marketplace/SpotCopy';

/**
 * Ranking criteria v1 (Phase 3 plan §7.4, §9.4; P2B Art. 5): how hosted entries are ordered and when one joins the
 * main ranking. Annex A of the Provider Listing Agreement says the same. Published at the opening (M10); until then
 * shown only to accounts the API lets into the provider pages, the site's 404 for everyone else, never indexed.
 */
const PATH = '/inference-providers/ranking-criteria';
// The page's lead, and from the opening its description too (fix round, code review m9: the same words, nothing new).
const LEAD = "How hosted entries are ordered on AI Stupid Level, and when one joins the main ranking.";
export const generateMetadata = providerPageMetadata(PATH, 'Ranking criteria v1', LEAD);
export const dynamic = 'force-dynamic';

const TOC = [
  { id: 'order', label: 'How hosts are ordered' },
  { id: 'join', label: 'Joining the main ranking' },
  { id: 'published', label: 'What we publish, and when' },
  { id: 'changes', label: 'Changes' },
];
const n = (id: string) => tocNumber(TOC, id);

export default async function RankingCriteriaPage() {
  const { preview } = await marketplaceStaffGate(PATH);
  // M9b (D-C7): the spot-check sentences only while some listing has a published spot month (the directory's spotPractice).
  const dir = await marketplaceRead<DirectoryDTO>(DIRECTORY_PATH, ['mp:directory']);
  const spotPractice = dir.kind === 'ok' && dir.data.spotPractice === true;
  // F6 (phase4-plan §6.5): the fresh stated limit, sent only with the practice while fresh task versions are in use or announced.
  const spotOnFresh = dir.kind === 'ok' && dir.data.spotOnFresh === true;
  return (
    <ReadingPage
      className="rd-ranking-criteria"
      kicker="For inference providers"
      title="Ranking criteria"
      accent="v1"
      lead={LEAD}
      note={preview ? 'Not public yet: only staff accounts can open this page.' : undefined}
      toc={TOC}
    >
      <RdSection id="order" n={n('order')} title="How hosts are ordered">
        <RdProse>
          <ol>
            <li><b>The measured score decides.</b> On each board, hosted entries are ordered by that board&apos;s score: the combined mean on Combined, and that suite&apos;s mean on Coding, Reasoning and Tool use. Two entries whose difference is within 1.96 times the square root of the sum of their squared standard errors are tied.</li>
            <li><b>Price breaks a statistical tie, and nothing else.</b> Within a tie, the cheaper entry comes first. The price used is the highest price the host declared in the last 7 days, and a change counts only 72 hours after it is made. Price never moves an entry past one it is not tied with.</li>
            <li><b>The display name, alphabetically,</b> only when score and price are equal.</li>
          </ol>
          <p>Never used: offers, the agreement version, the approval date, profile fields, and payment, which does not exist. The directory of providers is alphabetical. On an open model&apos;s page, measured hosts come first by their combined mean, then the others alphabetically.</p>
        </RdProse>
      </RdSection>

      <RdSection id="join" n={n('join')} title="Joining the main ranking">
        <RdProse><p>A hosted entry joins the main ranking after two consecutive daily evaluations on which every criterion holds:</p></RdProse>
        <RdRows rows={[
          ['P1', 'Listing published by an approved company under the current agreement; standing good'],
          ['P2', 'Measured for at least 14 days on the current task version'],
          ['P3', 'The leaderboard is comparable for every suite of the board: every ranked model’s newest result of each suite is a measured run'],
          ['P4', 'Fresh task versions in use: a new instance of each task per run. Until fresh versions exist, P4 fails for every listing'],
          ['D1', 'Runs on the current version: coding at least 12, reasoning at least 6, tool use at least 6, and probes at least 72'],
          ['D2', 'The newest run is within 2 cadences'],
          ['D3', 'The standard error is at most twice the median standard error of the ranked rows on that board'],
          ['D4', 'Completed runs are at least 90% of completed runs plus runs abandoned for credit, key, rate or reachability, over 14 days'],
          ['D5', 'No capped trials over 14 days'],
          ['I1', 'Spot checks, last full calendar month: at least 2 consistent checks, a 30-day minimum detectable effect of at most 3 coding points, and no confirmed inconsistency in the last 90 days'],
          ['I2', 'No open integrity event'],
          ['I3', 'The listing’s configuration unchanged for at least 7 days'],
          ['S', 'Our switch for joining the main ranking is on'],
        ]} />
        <RdProse>
          <p>An entry leaves the main ranking when P1, P3, P4, D2, D3 or I2 fails on two consecutive evaluations, and at once when it is under review, paused for more than 48 hours or suspended. Each automatic departure or return comes with a statement of reasons.</p>
        </RdProse>
      </RdSection>

      <RdSection id="published" n={n('published')} title="What we publish, and when">
        <RdProse>
          <PublishedParagraph spotPractice={spotPractice} spotOnFresh={spotOnFresh} />
        </RdProse>
      </RdSection>

      <RdSection id="changes" n={n('changes')} title="Changes">
        <RdProse>
          <p>A change to any criterion, threshold or parameter is announced 15 days before it applies. These criteria are Annex A of the <Link href="/inference-providers/agreement">Provider Listing Agreement</Link>.</p>
        </RdProse>
      </RdSection>
    </ReadingPage>
  );
}
