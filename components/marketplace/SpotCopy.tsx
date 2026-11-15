/**
 * The spot-check practice sentences (Phase 3 plan §6.7, §2.13; M9b, design-features §2.5a, D-C7: "omit, never deny").
 * Each describes spot checks as a practice, so each renders only when the API says it is true and already public:
 * `spotPractice`, a published spot month among the recent ones (never an active key, which is not public). Without it
 * the sentence is left out, never denied. The count sentence (spotSentence, which names its month) still renders
 * wherever a published month exists, as before. No hooks: the provider console (a client component) and the server
 * pages use these alike.
 */
import { spotSentence, type SpotMonth } from '@/lib/marketplace-spot';

/** The provider console's Benchmarks section: the "Spot checks" sub-heading and its sentences, with the practice only. */
export function ConsoleSpotChecks({ spotPractice, spotChecks }: { spotPractice?: boolean; spotChecks?: SpotMonth | null }) {
  if (spotPractice !== true) return null;
  return (
    <>
      <h3 className="mp-bench-sub">Spot checks</h3>
      <p className="sw-quiet">
        {spotChecks ? `${spotSentence(spotChecks)}.` : 'None published for this listing yet.'} We test at random times through ordinary customer
        accounts that we buy and pay for; their counts and what they detect are published once a month, for the month before, here and on your public page at the same time.
      </p>
    </>
  );
}

export interface SpottedEntry { publicId: string; label: string; spot: SpotMonth }

/**
 * The public provider page's "How we test this host" items, inside its list: with the practice, the sentences as
 * before; without it, each published month's count sentence alone (a fact about a published month).
 */
export function HowWeTestSpotItems({ spotPractice, spotted }: { spotPractice?: boolean; spotted: SpottedEntry[] }) {
  if (spotPractice === true) {
    return (
      <>
        {spotted.length === 0 && <li>Spot checks through ordinary customer accounts that we buy and pay for are published once a month, for the month before; none is published for this host yet.</li>}
        {spotted.length === 1 && <li>We also test through ordinary customer accounts that we buy and pay for, at times we choose: {spotSentence(spotted[0].spot)}. These counts are published once a month, for the month before.</li>}
        {spotted.length > 1 && <li>We also test through ordinary customer accounts that we buy and pay for, at times we choose; these counts are published once a month, for the month before:</li>}
      </>
    );
  }
  return spotted.length === 1 ? <li>{spotSentence(spotted[0].spot)}.</li> : null;
}

/** The list of several entries' published months under those items (more than one entry with a published month). */
export function HowWeTestSpotList({ spotted }: { spotted: SpottedEntry[] }) {
  if (spotted.length <= 1) return null;
  return (
    <ul>
      {spotted.map(e => <li key={e.publicId}>{e.label}: {spotSentence(e.spot)}.</li>)}
    </ul>
  );
}

/**
 * The ranking criteria page's "What we publish, and when": the spot-check sentence and clause with the practice only.
 * F6 (phase4-plan §6.5's stated limit; draft copy for the lawyer with Annex A v2): once fresh task versions are in use or
 * announced (`spotOnFresh`, which the API sends only with the practice), the clause says what spot checks of hosts on
 * fresh task versions detect and what they do not; hosts on the standard tasks keep the sentence as it was.
 */
export function PublishedParagraph({ spotPractice, spotOnFresh }: { spotPractice?: boolean; spotOnFresh?: boolean }) {
  const practice = spotPractice === true;
  const fresh = practice && spotOnFresh === true;
  return (
    <p>
      Hosted scores appear only as daily means in whole points, one to two days after the day ends, for everyone, the provider included.
      {practice ? ' Spot-check counts, their detectable effect and spot-run speed are published once a month.' : ''} Single runs on a fixed task set would let a host
      work out our hidden tests{practice && !fresh ? ', and spot checks cannot see special treatment of our prompts by their content until fresh task versions exist' : ''}.
      {fresh ? ' For hosts on fresh task versions, spot checks use new task versions in our standard request format, so they detect special treatment of our benchmark key, not of our request format or of the family our tasks come from. For hosts on the standard tasks, spot checks cannot see special treatment of our prompts by their content.' : ''}
    </p>
  );
}
