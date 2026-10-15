import type { Metadata } from 'next';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdFacts, RdFinal, tocNumber } from '@/components/landing/Reading';
import ContextRotResults from './ContextRotResults';
import '@/styles/context-rot.css';
import '@/styles/context-rot-page.css';

export const metadata: Metadata = {
  title: 'Context Rot Benchmark (Pilot) | Long-Context Accuracy by Length',
  description:
    'Does an AI model get worse as its context gets longer? A weekly benchmark from 8K to 1M tokens: finding a fact, linking facts, tracking a value that changes and counting across the document, graded exactly. Pilot with DeepSeek, Kimi and GLM.',
  keywords: ['context rot', 'lost in the middle', 'long context benchmark', '1M context window', 'needle in a haystack',
    'effective context length', 'LLM long context accuracy'],
  alternates: { canonical: '/context-rot' },
  openGraph: {
    title: 'Context Rot Benchmark (Pilot) | AI Stupid Level',
    description: 'How much of a 1M-token context can a model actually use? Tracked weekly, from 8K to 1M tokens.',
    url: 'https://aistupidlevel.info/context-rot',
    type: 'article',
  },
};

const TOC = [
  { id: 'results', label: 'Results' },
  { id: 'what', label: 'What we test' },
  { id: 'how', label: 'How it works' },
  { id: 'pilot', label: 'The pilot' },
  { id: 'limits', label: 'What it cannot tell you' },
];
const num = (id: string) => tocNumber(TOC, id);

export default function ContextRotPage() {
  return (
    <ReadingPage
      className="rd-crt"
      kicker="Context rot · Pilot"
      title="Does a model get worse"
      accent="as its context gets longer?"
      lead="Every week we give each model the same kind of document at six lengths, from 8,000 to 1 million tokens, and ask it sixteen questions whose answers are buried inside. The answers are graded exactly. This shows how much of a model's advertised context it can actually use, and what breaks first."
      toc={TOC}
      actions={(
        <>
          <a className="lp-btn lp-btn-primary lp-btn-lg" href="#results">See the results <span className="lp-ar" aria-hidden="true">→</span></a>
          <a className="lp-btn lp-btn-ghost lp-btn-lg" href="#how">How it works</a>
        </>
      )}
      note={<><span className="crt-pill">Pilot</span> DeepSeek, Kimi and GLM models for now. OpenAI, Anthropic, Google and more providers will follow soon.</>}
      aside={(
        <dl className="lp-facts">
          <div><dt>6</dt><dd>lengths every week, from 8K to 1M tokens, as far as each model&apos;s window allows</dd></div>
          <div><dt>16</dt><dd>questions per document — finding, linking, tracking and counting — graded exactly, with no judge model</dd></div>
          <div><dt>90%</dt><dd>of its own 8K accuracy: the bar a model must hold for a length to count as usable context</dd></div>
        </dl>
      )}
      final={(
        <RdFinal
          title="Questions about the pilot?"
          lead="We are a small team and we answer our own email."
          actions={(
            <>
              <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/contact">Talk to us <span className="lp-ar" aria-hidden="true">→</span></Link>
              <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/methodology#context-rot">Full methodology</Link>
            </>
          )}
        />
      )}
    >
      <RdSection id="results" n={num('results')} title="Results">
        <ContextRotResults />
      </RdSection>

      <RdSection id="what" n={num('what')} title="What we test"
        lead="Finding one fact in a long document is largely solved: in our first runs every pilot model answered those questions at the longest length it supports, up to a million tokens. Using the document is harder. Each trial asks sixteen questions of four kinds.">
        <RdFacts rows={[
          ['Finding a fact (9 questions)', 'A person is said to have lived near a famous landmark — “a flat within sight of the Semperoper”. The question names only the city: “Who has lived in Dresden?” The nine facts sit 10%, 20% … 90% of the way through, so “lost in the middle” shows up if it is there.'],
          ['Linking facts (3 questions)', 'A shipment gets a tracking code in one record; the passphrase for that code is set out in another, half the document away — once in reading order, once reversed. A three-step version adds who leads the project, with the three facts read out of order.'],
          ['Tracking updates (2 questions)', 'One room’s door code changes five to nine times through the archive; another’s changes four times and the last change is later withdrawn, so its current code is the one before. The question asks for the current code. An earlier code is a wrong answer.'],
          ['Counting (2 questions)', 'How many times was one room’s door code changed — among hundreds of other rooms’ changes? And of twenty-five staff profiles scattered through the whole document, how many people have lived in a city in, say, Asia? Both need every relevant record found.'],
        ]} />
        <RdProse>
          <p>Every fact is written as an ordinary record, in the same format as the thousands around it: the archive also holds hundreds of other rooms’ door-code changes, other projects’ tracking codes, other passphrases and other project leads, none of which answers a question. That interference grows with the document, which is what context rot is. Our first version placed the facts as bare sentences among formatted records; every model we tried found them by their format alone, even at a million tokens, so it measured nothing.</p>
        </RdProse>
      </RdSection>

      <RdSection id="how" n={num('how')} title="How it works">
        <RdFacts rows={[
          ['Lengths', '8K, 32K, 128K, 256K, 512K and 1M tokens — each model runs every length its context window can hold, with room left for its answer. The real token count is measured and shown.'],
          ['Same test for every model', 'Within a week every model gets the same facts, the same questions and the same distractors. Tokenizers differ, so the amount of filler is sized from each model’s own measured characters per token.'],
          ['Trials', 'Three documents per length per model, each week: 48 graded answers per length. The position grid pools the last four weeks.'],
          ['Grading', 'Exact: the full name, the passphrase, the code or the number. No judge model. Only the visible answer counts, never the model’s reasoning. A reply with no answer counts as wrong in a model’s overall accuracy and in “holds up to”, and is marked where it happens; the per-skill figures and the position grid count only replies that answered, because an empty reply says nothing about which skill failed. A provider error is excluded, never scored as zero.'],
          ['Effective context', 'The longest length at which a model keeps at least 90% of its own 8K accuracy, counting up from 8K.'],
          ['Schedule', 'Weekly, Sunday morning (Berlin). Separate from the leaderboard: nothing here changes a model’s score or rank.'],
        ]} />
        <RdProse>
          <p>Every test version is fingerprinted, like our other suites, so a change to the test is never mistaken for a change in a model. The full method is on the <Link href="/methodology">methodology page</Link>.</p>
        </RdProse>
      </RdSection>

      <RdSection id="pilot" n={num('pilot')} title="The pilot"
        lead="The pilot starts with DeepSeek, Kimi and GLM while the method settles. OpenAI, Anthropic, Google and more providers will follow.">
        <RdFacts rows={[
          ['DeepSeek V4 Pro · V4.1 Flash', '1,048,576-token context window'],
          ['Kimi K3', '1,048,576-token context window'],
          ['Kimi K2.7 Code', '262,144-token context window — tested up to 256K'],
          ['GLM-5.3', '1M-token context window'],
          ['Coming next', 'OpenAI, Anthropic, Google and more providers.'],
        ]} />
      </RdSection>

      <RdSection id="limits" n={num('limits')} title="What it cannot tell you">
        <RdProse>
          <ul>
            <li>It is one kind of document — an internal archive in English. Code, legal text or other languages may behave differently.</li>
            <li>Three trials a week at each length is enough to see a trend, not to separate two models a few points apart. Read single weeks with care; the history is more reliable than any one of them.</li>
            <li>The finding-a-fact questions need a little world knowledge (which city a landmark is in). The 8K result is each model’s own baseline, so that knowledge is not what the length curve measures.</li>
          </ul>
        </RdProse>
      </RdSection>
    </ReadingPage>
  );
}
