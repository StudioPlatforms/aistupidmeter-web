import type { CSSProperties } from 'react';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';
import LandingEffects from '@/components/landing/LandingEffects';
import { RdFacts, RdProse } from '@/components/landing/Reading';
import { lpBody, lpDisplay } from '@/lib/fonts';
import '@/styles/landing.css';
import '@/styles/reading.css';

const intro = (d: string): CSSProperties => ({ '--d': d } as CSSProperties);

// Reveal-on-scroll hides blocks only once scripts run; the failsafe shows everything if they never do.
const FAILSAFE = "(function(){var d=document.documentElement;d.classList.add('lp-js');setTimeout(function(){if(!window.__lpReady)d.classList.remove('lp-js')},4000)})();";

/**
 * /models/<unknown>: the 404 for a model that is not on the board (retired, renamed, or a typo),
 * served with a 404 status by notFound() in page.tsx, whose generateMetadata already marks the
 * response noindex. Where the model went is on the roster and the compare hub, so the links lead
 * there rather than back to the landing page.
 */
export default function ModelNotFound() {
  return (
    <SubpageLayout>
      <div className={`lp lp-sub rd-page ${lpBody.variable} ${lpDisplay.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: FAILSAFE }} />
        <LandingEffects />
        <header className="lp-hero lp-textured rd-hero">
          <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="lp-wrap">
            <p className="lp-kicker lp-intro" style={intro('.04s')}>404 · Models</p>
            <h1 className="lp-h1 lp-intro" style={intro('.1s')}>
              Model not found <span className="lp-b">No model is tracked at this address.</span>
            </h1>
            <div className="lp-hero-row">
              <div>
                <p className="lp-lead lp-intro" style={intro('.18s')}>
                  The model may have been retired from the board, or the link may be out of date. Every model
                  AI Stupid Level benchmarks today is on the roster, grouped by vendor, with its place on the 24-hour boards.
                </p>
                <div className="lp-cta lp-intro" style={intro('.26s')}>
                  <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/models" data-cta="model-notfound-hero-models">
                    See every model we benchmark <span className="lp-ar" aria-hidden="true">→</span>
                  </Link>
                  <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/compare" data-cta="model-notfound-hero-compare">
                    Compare models
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="rd">
          <section className="lp-sec rd-sec" aria-labelledby="mnf-where-h">
            <div className="lp-wrap">
              <div className="rd-head lp-up">
                <p className="lp-kicker">Where to go instead</p>
                <h2 className="rd-h2" id="mnf-where-h">The pages that hold the same answers</h2>
              </div>
              <div className="rd-body">
                <RdFacts rows={[
                  [<Link key="models" href="/models">Every AI model we benchmark</Link>, 'The full roster by vendor, each model with its 24-hour Combined score and place, and a link to its own page.'],
                  [<Link key="compare" href="/compare">Claude vs GPT vs Gemini, compared</Link>, 'The model families side by side on the same coding, reasoning and tool-use tests, with a page for every pair.'],
                  [<Link key="best" href="/best-ai-model">Which AI model is best</Link>, 'The leaders of each board, with the statistical ties the leaderboard shows, for coding, reasoning, agents, value and speed.'],
                  [<Link key="worse" href="/is-ai-getting-worse">Is AI getting worse?</Link>, 'What the drift detectors say for each provider, with the method behind the answer.'],
                  [<Link key="status" href="/status">AI provider status</Link>, 'Whether each provider API is answering, checked every 10 minutes with our own keys.'],
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
