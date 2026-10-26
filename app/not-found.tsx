import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';
import LandingEffects from '@/components/landing/LandingEffects';
import { RdFacts, RdProse } from '@/components/landing/Reading';
import { lpBody, lpDisplay } from '@/lib/fonts';
import '@/styles/landing.css';
import '@/styles/reading.css';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'The page you asked for is not here. Start again from the leaderboard, the model comparisons, the best-model pages, the status page or the methodology.',
  robots: { index: false, follow: true },
};

const intro = (d: string): CSSProperties => ({ '--d': d } as CSSProperties);

// Reveal-on-scroll hides blocks only once scripts run; the failsafe shows everything if they never do.
const FAILSAFE = "(function(){var d=document.documentElement;d.classList.add('lp-js');setTimeout(function(){if(!window.__lpReady)d.classList.remove('lp-js')},4000)})();";

/**
 * The 404 page, in the reading pages' look inside the site's own top bar. Next serves it with a
 * 404 status for unmatched URLs and for notFound() calls. A model whose page has gone (retired
 * from the board) lands here too, so the links lead to the pages that hold the same answers.
 */
export default function NotFound() {
  return (
    <SubpageLayout>
      <div className={`lp lp-sub rd-page ${lpBody.variable} ${lpDisplay.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: FAILSAFE }} />
        <LandingEffects />
        <header className="lp-hero lp-textured rd-hero">
          <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="lp-wrap">
            <p className="lp-kicker lp-intro" style={intro('.04s')}>404</p>
            <h1 className="lp-h1 lp-intro" style={intro('.1s')}>
              Page not found <span className="lp-b">The address may be out of date.</span>
            </h1>
            <div className="lp-hero-row">
              <div>
                <p className="lp-lead lp-intro" style={intro('.18s')}>
                  There is nothing at this address. Model pages move when a model leaves the board, and
                  older links can point at pages that have since been merged. Everything below is live.
                </p>
                <div className="lp-cta lp-intro" style={intro('.26s')}>
                  <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/" data-cta="not-found-hero-leaderboard">
                    Open the leaderboard <span className="lp-ar" aria-hidden="true">→</span>
                  </Link>
                  <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/compare" data-cta="not-found-hero-compare">
                    Compare models
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="rd">
          <section className="lp-sec rd-sec" aria-labelledby="nf-where-h">
            <div className="lp-wrap">
              <div className="rd-head lp-up">
                <p className="lp-kicker">Where to go instead</p>
                <h2 className="rd-h2" id="nf-where-h">The pages that answer most questions</h2>
              </div>
              <div className="rd-body">
                <RdFacts rows={[
                  [<Link key="home" href="/">The live LLM leaderboard</Link>, 'Every model on the combined, coding, reasoning and tool-use boards over the last 24 hours, 7 days and 30 days.'],
                  [<Link key="compare" href="/compare">Claude vs GPT vs Gemini, compared</Link>, 'The model families side by side on the same coding, reasoning and tool-use tests, with every tracked model listed by vendor.'],
                  [<Link key="best" href="/best-ai-model">Which AI model is best</Link>, 'The leaders of each board, with the statistical ties the leaderboard shows, and the pages for coding, reasoning, agents, value and speed.'],
                  [<Link key="worse" href="/is-ai-getting-worse">Is AI getting worse?</Link>, 'What the drift detectors say for each provider: OpenAI, Anthropic, Google and DeepSeek, with the method behind the answer.'],
                  [<Link key="status" href="/status">AI provider status</Link>, 'Whether each provider API is answering, checked every 10 minutes with our own keys, with seven days of history.'],
                  [<Link key="method" href="/methodology">How the benchmarks work</Link>, 'The methodology in full: every weight, statistical test and drift constant. The test tasks are private, so no lab can train on them.'],
                ]} />
                <RdProse>
                  <p>
                    If you followed a link from another site and it should have worked, <Link href="/contact">tell us</Link> which
                    address you used and we will fix it or redirect it.
                  </p>
                </RdProse>
              </div>
            </div>
          </section>
        </div>
      </div>
    </SubpageLayout>
  );
}
