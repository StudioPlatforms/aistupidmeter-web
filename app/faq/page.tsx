import type { Metadata } from 'next';
import Link from 'next/link';
import { DocPage, Section, QA } from '@/components/docs/Doc';

export const metadata: Metadata = {
  title: 'FAQ | AI Benchmarking Questions Answered',
  description: 'Frequently asked questions about AI model benchmarking, reading the leaderboards, performance testing, drift detection and our methodology. Learn how we measure AI stupid levels objectively.',
  keywords: [
    'AI benchmarking FAQ', 'How to measure AI performance', 'Are AI models getting worse',
    'AI drift detection explained', 'LLM benchmarking questions', 'AI performance testing FAQ',
    'How AI benchmarks work'
  ],
  alternates: { canonical: '/faq' },
  openGraph: {
    title: 'Frequently Asked Questions | AI Benchmarking',
    description: 'Common questions about AI model benchmarking, reading the leaderboards, performance testing and drift detection answered.',
    url: 'https://aistupidlevel.info/faq',
    type: 'website',
  }
};

/**
 * Answers are plain text with [label](/path) links, so one array feeds both the page and the
 * FAQPage structured data (which gets the text with the link syntax stripped). Paragraphs are
 * separated by a blank line.
 */
interface FAQItem { id: string; q: string; a: string }
interface FAQGroup { id: string; title: string; items: FAQItem[] }

const FAQ: FAQGroup[] = [
  {
    id: 'reading',
    title: 'Reading the leaderboards',
    items: [
      {
        id: 'home-page',
        q: 'How do I read the home page?',
        a: 'There are four leaderboards of the same models: Combined, Coding, Reasoning and Tool use. Combined weights coding 50% and reasoning and tool use 25% each. Coding is re-measured every four hours, reasoning and tool use once a day, and each board has the best model at the top.\n\nYou choose how the four are laid out; the numbers are the same in every layout. "How to read this", above the boards, explains the layout you are using. Under the boards are the Quick answers, a heatmap comparing every model\'s measures, a price-performance table and each provider\'s live status. The Drift monitor, next to Leaderboard at the top, compares each model with its own past instead of with the other models.',
      },
      {
        id: 'layouts',
        q: 'Which layout should I choose, and can I change it?',
        a: 'Connected (the default) joins the same model across the four boards with a line, so you can see where it is strong and where it slips. Side by side shows four full lists. Table puts one model per row with all four scores, ranks and price, and sorts by any column. Top 5 shows the first five of each board.\n\nChange it at any time with the Layout button above the boards. Without an account the choice is kept in a cookie in this browser. With an account it is saved to the account and can also be changed under [Settings](/account/settings).',
      },
      {
        id: 'tie',
        q: 'What does "=" before a rank mean?',
        a: '"=4" means a statistical tie: the models sharing that rank are closer together than the measurement can separate. Walking down a board, a model joins the group above it unless that group\'s leader is ahead by more than 1.96 times their combined standard error, which is a two-sample test at 95%. Ranks such as 1, 1, 1, 4 are therefore normal. A rank without "=" is on its own. The full rule is on the [methodology page](/methodology#ranks).',
      },
      {
        id: 'coverage',
        q: 'What does an amber note such as "5/7 tasks" mean?',
        a: 'The provider declined some tasks, and the model was graded on the ones it attempted. A refusal is a decision about content, not a measure of ability, so it is not scored as zero. But the declined tasks tend to be the hard ones, so the note stays with the score, the model\'s page names the declined tasks, and such a model is never called tied with one that was measured on every task.',
      },
      {
        id: 'not-ranked',
        q: 'Why are some models "not ranked", or in a separate group at the bottom?',
        a: 'A board ranks only models with a current measurement on it. A score is current until it is older than two of its suite\'s runs: 8 hours for coding, 48 for reasoning and tool use. A model can also miss a board because it has no score on that suite yet, or, on Combined, because too few of its suites are current.\n\nCommunity-funded models have a group of their own. On Reasoning and Tool use it shows the date of each one\'s last funded run.',
      },
      {
        id: 'community',
        q: 'What is a community-funded model?',
        a: 'From 24 September 2026 we stopped paying for the reasoning and tool-use suites for five models: Claude Sonnet 4.6, Claude Opus 4.6, 4.7 and 4.8, and GPT-5.5. Their coding suite, the hourly canary and drift monitoring continue on our account.\n\nAnyone signed in can fund the next reasoning or tool-use run for one of them from the model\'s page, paying with their own API key. The run is exactly our scheduled test, on our servers, published like any other. The key is used for that run only and never stored. On Combined these models show a coding-only score and are listed but not ranked against models measured on all three suites.',
      },
      {
        id: 'star',
        q: 'What do the stars do?',
        a: 'Starring a model adds it to your watchlist. It needs a free account, which can watch three models; paid plans watch more. Watched models appear in a card above the leaderboards with their place on each board, and you can select one to follow it through the layout. Starring also switches on email for that model: a weekly summary of what changed, and an alert when its measured coding score is five or more points below its score a week earlier, or when a task-level regression is open. Paid plans can change the five-point threshold. Manage both on the [watchlist](/watchlist) page.',
      },
      {
        id: 'period',
        q: 'What do Latest, 24H, 7D and 1M mean?',
        a: 'Latest is each model\'s newest score. The others are the average of the real measurements in that window; modelled or placeholder values are never included. The last seven days are free. The one-month view is on paid plans.',
      },
      {
        id: 'quick-answers',
        q: 'How are the Quick answers such as "Best value" chosen?',
        a: 'Each card has one stated definition, and only models measured on every suite and task qualify. Best for code is the top of the Coding board.\n\nThree cards look only at models within five points of the top. Most reliable has the smallest spread over its recent coding runs. Fastest response has the lowest median response time over the last 48 hours. Best value scores the most points per dollar of one identical coding run.\n\nPoor value means another ranked model scores at least as high for a third of the cost or less. Cost is measured, not taken from price lists: every attempt in a coding run is billed, so a model that writes more costs more.',
      },
    ],
  },
  {
    id: 'general',
    title: 'General',
    items: [
      {
        id: 'what',
        q: 'What is AI Stupid Level?',
        a: 'AI Stupid Level is an independent benchmarking platform that tracks AI model performance over time. We give roughly two dozen models the same coding, reasoning and tool-use tasks on a fixed schedule and grade them by running what they produce. Each model is then compared with its own past to detect performance changes, called drift, that would otherwise go unnoticed.',
      },
      {
        id: 'worse',
        q: 'Are AI models really getting worse over time?',
        a: 'Sometimes, and we are careful about what we claim to have seen. Providers do change served models without announcement, through fine-tuning, safety updates, routing and quantisation, and scores on this site do move.\n\nIn September 2026 we audited our own alarm history and withdrew 492 incidents raised by earlier rules that had no significance test. The per-suite detectors that replaced them need ten daily results on the current version of the tests before they can fire. As of late September 2026 they are still collecting that history and switch on in early October. So no detection under the current design has yet been confirmed.\n\nThe platform now measures carefully enough to catch a sustained decline of a few points. When it catches one, the drift monitor and the model\'s page will show it, with the statistic behind it.',
      },
      {
        id: 'different',
        q: 'How is this different from other AI benchmarks?',
        a: 'Most benchmarks, such as HumanEval and MMLU, report one measurement with no uncertainty. Here every coding task is run seven times, every number carries a standard error, and models inside each other\'s noise share a rank instead of being separated by a place the measurement cannot support. The measurement is continuous, and each suite\'s daily results are watched for change. Every weight, threshold and statistical method is published, and you can reproduce the scoring with your own API keys.',
      },
      {
        id: 'free',
        q: 'Is AI Stupid Level free to use?',
        a: 'Everything needed to judge the models is free and needs no account: current scores, all four leaderboards, seven days of history, the methodology and how fresh each measurement is. A free account adds a watchlist of three models, with email alerts and a weekly summary.\n\nPaid plans add depth and tools, not access to the results: longer history, the drift curve and measure breakdown behind an alert, more watched models, exports, custom alert thresholds and team features. The [Data API](/api-docs) has a free tier too, with a key. Subscriptions and paid API tiers help pay for the benchmark runs. No AI vendor pays us anything.',
      },
    ],
  },
  {
    id: 'methodology',
    title: 'Methodology',
    items: [
      {
        id: 'scoring',
        q: 'How do you score AI models?',
        a: 'Each suite has published weights, and the combined score is coding 50%, reasoning 25% and tool use 25%. If a suite is missing or out of date, it drops out and the others are reweighted. It is never filled in with a placeholder.\n\nCoding has nine measures: correctness 55%, stability 10%, edge cases 10%, debugging 10%, code quality 5%, efficiency 5%, format 3%, safety 2% and complexity 0%. Complexity is measured and shown, but it is too similar across models to separate them.\n\nReasoning has five measures, weighted differently for each task: correctness, recovery after a failed step, memory retention, plan coherence and context use. Tool use has seven: task completion 30%, tool selection 20%, parameter accuracy 15%, efficiency 15%, error handling 10%, context awareness 5% and safety compliance 5%.\n\nThere is no curve, gate or penalty on top. All of them were removed in September 2026, after two identical sweeps showed the curve, not the models, was producing large swings.',
      },
      {
        id: 'seven',
        q: 'Why run each coding task seven times?',
        a: 'Models are probabilistic: the same prompt can produce different answers. One attempt could be lucky or unlucky. Seven attempts per task, reduced to one result per task by the median, stop a single odd attempt from moving the score. The ± interval on the board comes separately, from how much the score varies between runs.',
      },
      {
        id: 'tasks',
        q: 'What tasks do you use?',
        a: 'The coding suite gives a model a small working project and a bug report written as a user\'s complaint. No file is named, so the model has to find the defect itself. The fix is graded by running the project\'s own test suite, including hidden tests the model never sees. Seven tasks run every sweep: six repository debugging tasks and one hard single-function task.\n\nTasks that stop measuring are retired, because a task everybody passes ranks nobody. A new task counts only if every hidden test traces back to the bug report and at least a fifth of the fleet fails it in three independent runs.\n\nThe tool-use suite runs nine tasks in real sandboxed machines. The reasoning suite runs four long, multi-turn working sessions every day.',
      },
      {
        id: 'drift',
        q: 'What is drift detection and how does it work?',
        a: 'Two detectors, with what each can see stated plainly. For sustained change, each suite has its own Page-Hinkley detector on its daily results; a model\'s status is the most severe of its suites. The detector adds up how far each day falls below the running mean, minus a small tolerance, so daily noise cancels out and a real sustained decline builds up until it crosses a threshold. It needs ten days of history on the current tests before it can fire. Tool use, the noisiest suite, has a higher threshold that must hold for three days in a row.\n\nFor sudden change, an hourly canary runs two fixed probes and tests the last 6 and 24 hours against the previous week with Welch\'s t-test. An incident needs a fall of at least 12 points at p < 0.01. Every constant, with the measured false-alarm and detection rates, is on the [methodology page](/methodology#drift).',
      },
      {
        id: 'accuracy',
        q: 'How accurate are the scores?',
        a: 'Every number on the board carries a standard error, measured from how consistent the model has been. For each suite that is the spread of its last five runs on the current tests, combined using the composite\'s weights. On coding, two identical sweeps of the whole fleet differ by about 2 points on average. A combined score\'s standard error is typically 2–3 points, and the interval shown is ±1.96 standard errors. So "86 ± 4.5" means the same model measured again would land in that range 95% of the time.\n\nThis is why neighbouring places on the leaderboard are often ties.',
      },
      {
        id: 'median',
        q: 'Why use the median instead of the mean?',
        a: 'The median is not thrown off by outliers. If one attempt produces an unusual result, such as a timeout or an unusually good or bad answer, it does not skew the task\'s result. With seven attempts it describes typical performance better than the mean.',
      },
      {
        id: 'refusals',
        q: 'What happens when a model refuses a task?',
        a: 'Some providers decline entirely harmless prompts. The declined task drops out and the model is scored on the rest; it is never scored as zero or filled in. The row shows its coverage, for example "5/7 tasks", and the model\'s page lists the declined tasks. Only what a model shows as its answer is graded, never its hidden reasoning. An attempt that uses its whole output budget without answering counts as a failed attempt, not a refusal.',
      },
    ],
  },
  {
    id: 'technical',
    title: 'Technical',
    items: [
      {
        id: 'verify',
        q: 'Can I verify your results myself?',
        a: 'Yes. [Test your keys](/router/test-keys) runs the same tasks with your own API keys and scores them with the same code as our published runs. It compares your result with ours only when both came from the same version of the tests. One difference is stated with every result: our coding figure makes seven attempts per task, and yours makes one.\n\nThe web application is open source. The task bank is not, because when it was public, providers optimised against it.',
      },
      {
        id: 'api',
        q: 'Do you have an API?',
        a: 'Yes. The Data API at /api/v1 returns current rankings with confidence intervals, history and the models currently degrading. It needs a free key from [Data API keys](/account/data-keys), sent as an Authorization header. Free keys get 10 requests a day, Pro 10,000, Developer 25,000 and Teams 100,000. Keys became necessary after the open version was used to republish our rankings elsewhere. The full reference is at [/api-docs](/api-docs).',
      },
      {
        id: 'intervals',
        q: 'What are confidence intervals and why do they matter?',
        a: 'An interval is the range the true score is 95% likely to lie in. "86 ± 4.5" means between 81.5 and 90.5. It matters because models are probabilistic, a single measurement is unreliable, and a difference smaller than the noise is not a real difference. The ranks use the same idea: models the measurement cannot separate share a rank, shown as "=N".',
      },
      {
        id: 'schedule',
        q: 'How often are models tested?',
        a: 'Every model is tested on the same schedule, with no priority list. The coding suite runs every 4 hours and the canary every hour. The reasoning suite runs daily at 03:00 Berlin time and the tool-use suite daily at 04:00 (01:00 and 02:00 UTC in summer). Every result is kept, going back to our first benchmark on 8 August 2025. The footer on every page counts down to the next coding run.',
      },
    ],
  },
  {
    id: 'comparisons',
    title: 'Comparisons',
    items: [
      {
        id: 'best-coding',
        q: 'Which AI model is best for coding?',
        a: 'It changes, which is the point of the site, so check the live Coding board rather than a name written into an FAQ. We track 22 models from six providers: OpenAI, Anthropic, Google, DeepSeek, Kimi and GLM. The top few are often statistical ties, shown as "=1". The Best for code card under the boards names the leader among models measured on every task. What counts as best also depends on the work: compare the Coding, Reasoning and Tool use boards, and use the Table layout to see all of them with prices.',
      },
      {
        id: 'gpt-claude',
        q: 'How does GPT compare to Claude?',
        a: 'Both families are near the top and trade places, so a figure written here would soon be out of date. To compare two models, use the Table layout, which puts every model\'s four scores and ranks side by side, or the heatmap under the boards, which compares their individual measures. Each model\'s page shows its score history with intervals. If two models share a rank ("="), the gap between them is within the measurement\'s noise.',
      },
      {
        id: 'cheaper',
        q: 'Are smaller or cheaper models worth using?',
        a: 'Often, yes. Cheaper models regularly score within a few points of the flagships on coding, at a fraction of the cost. The Best value card uses the measured cost of an identical coding run, with every attempt billed, so a model that writes three times as much text costs what it really costs. The price-performance table under the boards is the quicker view: score per dollar of list price, blended 40% input and 60% output. Each model\'s page shows which measures and which tasks it loses points on.',
      },
    ],
  },
  {
    id: 'trust',
    title: 'Trust and independence',
    items: [
      {
        id: 'paid',
        q: 'Do AI companies pay you to rank them higher?',
        a: 'No. We have no financial relationship with OpenAI, Anthropic, Google, DeepSeek, Moonshot, Zhipu or any other model provider. We take no vendor sponsorship and no affiliate commission. The scheduled benchmarks run on our own servers with API keys we pay for.\n\nThe one exception is visible on the site. Some reasoning and tool-use runs for five community-funded models are paid for by visitors with their own keys. They run exactly the same test on the same servers.',
      },
      {
        id: 'funding',
        q: 'How do you fund this platform?',
        a: 'Venture funding, plus revenue from subscriptions, paid tiers of the Data API and data licensing to organisations that are not model vendors. No AI model provider funds us, and none of our investors is one. That is the one line we will not cross: the site only works if nobody who scores well has paid us.',
      },
      {
        id: 'trust-method',
        q: 'How can I trust your methodology?',
        a: 'Check it rather than trust it. The methodology is public, including every weight and every drift constant. [Test your keys](/router/test-keys) reproduces our scoring with your own API keys. The statistics are standard published methods: Page-Hinkley change detection, Welch\'s t-test and standard errors. The web application is open source.\n\nThe benchmark task bank is the one thing we do not publish. When it was public, providers optimised against the specific tasks, which ruins the measurement. Our methodology paper is currently under peer review, and a SOC 2 Type II audit is in progress.',
      },
    ],
  },
  {
    id: 'using',
    title: 'Using the platform',
    items: [
      {
        id: 'choose',
        q: 'How do I choose the right AI model for my project?',
        a: 'Start with the board that matches the work: Coding for code changes, Tool use for agents that call tools, Reasoning for long multi-step sessions. Then look at the Quick answers: Most reliable if consistency matters, Fastest response for latency and Best value for cost. Open a model\'s page to see its history, which tasks it loses points on, and whether its drift status is normal. Star the few you depend on, and you will be emailed if one of them drops.',
      },
      {
        id: 'status',
        q: 'What do the drift statuses mean?',
        a: 'NORMAL: every suite\'s drift statistic is below its warning line.\n\nWARNING: a suite\'s Page-Hinkley statistic is more than halfway to its threshold, or recent scores are unusually spread out.\n\nALERT: a suite\'s statistic has crossed its threshold, or the model is clearly below its own 28-day baseline on the current tests.\n\nSeparately, the hourly canary records an incident when a model\'s probe results fall at least 12 points against the previous week at p < 0.01, and closes it when the gap closes. Incidents raised before 13 September 2026 by an earlier detector with no significance test were retracted, and they are excluded from every count on the site.',
      },
    ],
  },
  {
    id: 'limits',
    title: 'Limitations and plans',
    items: [
      {
        id: 'limitations',
        q: 'What are the current limitations?',
        a: 'Stated plainly:\n\n1. The coding suite is seven Python tasks per run. It measures debugging and coding, not general ability, and not other programming languages.\n2. Seven attempts capture ordinary variation, but not rare failures. A model that solves a task about half the time will move a few points between runs.\n3. Everything is in English.\n4. We measure the model as its public API serves it. A change to the provider\'s routing or quantisation looks the same to us as a change to the model, so we can say that performance moved, not always why.\n5. A model that declines tasks is measured on fewer, and on average easier, tasks. Its row says so.\n6. The drift detectors on the current tests are still collecting the ten days of history they need, and switch on in early October 2026.\n7. The adversarial-safety, bias and prompt-robustness suites are running, but their data is too new to draw conclusions from.',
      },
      {
        id: 'next',
        q: 'What features are coming next?',
        a: 'In rough order:\n\n1. Tasks beyond Python.\n2. Adaptive sampling: more attempts when a result is uncertain.\n3. Two tool-use runs a day, which halves that suite\'s noise.\n4. Error bars drawn on the charts.\n5. Publishing the adversarial-safety, bias and robustness results once each dataset is large enough to mean something.\n\nNo dates are promised: this is a small team, and the benchmark bill is real.',
      },
    ],
  },
];

const LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

function stripLinks(text: string): string {
  return text.replace(LINK, '$1');
}

/** Render one answer: paragraphs on blank lines, numbered lists on "1." lines, [label](href) links. */
function Answer({ text }: { text: string }) {
  const inline = (s: string, key: string) => {
    const out: React.ReactNode[] = [];
    let last = 0;
    for (const m of Array.from(s.matchAll(LINK))) {
      if (m.index! > last) out.push(s.slice(last, m.index));
      const [, label, href] = m;
      out.push(href.startsWith('/')
        ? <Link key={`${key}-${m.index}`} href={href}>{label}</Link>
        : <a key={`${key}-${m.index}`} href={href} target="_blank" rel="noopener noreferrer">{label}</a>);
      last = m.index! + m[0].length;
    }
    out.push(s.slice(last));
    return out;
  };
  return (
    <>
      {text.split('\n\n').map((block, i) => {
        const lines = block.split('\n');
        if (lines.every((l) => /^\d+\.\s/.test(l))) {
          return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+\.\s/, ''), `${i}-${j}`)}</li>)}</ol>;
        }
        return <p key={i}>{inline(block, String(i))}</p>;
      })}
    </>
  );
}

export default function FAQPage() {
  return (
    <DocPage
      kicker="FAQ"
      title="Frequently asked questions"
      lead="How to read the leaderboards, how models are tested, and what the numbers can and cannot tell you."
      toc={FAQ.map((g) => ({ id: g.id, label: g.title }))}
      actions={(
        <>
          <Link className="doc-btn is-primary" href="/methodology">Full methodology</Link>
          <Link className="doc-btn" href="/">View the leaderboards</Link>
          <Link className="doc-btn" href="/contact">Ask a question</Link>
        </>
      )}
    >
      {FAQ.map((g) => (
        <Section key={g.id} id={g.id} title={g.title}>
          <div className="doc-qa-grid">
            {g.items.map((item) => (
              <QA key={item.id} id={item.id} q={item.q}>
                <Answer text={item.a} />
              </QA>
            ))}
          </div>
        </Section>
      ))}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.flatMap((g) => g.items).map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: stripLinks(item.a).replace(/\n+/g, ' ') },
            })),
          }),
        }}
      />
    </DocPage>
  );
}
