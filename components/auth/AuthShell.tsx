import Link from 'next/link';
import type { ReactNode } from 'react';
import '@/styles/auth.css';
import { lpBody, lpDisplay } from '@/lib/fonts';
import { darkDefaultScript } from '@/lib/theme-config';
import DarkDefault from '@/components/DarkDefault';

type Mode = 'signin' | 'signup' | 'account';

const PANEL: Record<Mode, { kicker: string; title: string }> = {
  signin: { kicker: 'Welcome back', title: 'Pick up where the models left off.' },
  signup: { kicker: 'Free account', title: 'Know which model is best today.' },
  account: { kicker: 'Your account', title: 'Your models, your alerts, your router.' },
};

/**
 * The frame for every sign-in, sign-up, password and SSO page: the landing page's brand panel on
 * the left (hidden on phones) and the form on the right.
 */
export default function AuthShell({ mode, children }: { mode: Mode; children: ReactNode }) {
  const panel = PANEL[mode];
  const marks = (
    <>
      <img className="au-mk-l" src="/asl-mark.png" alt="AI Stupid Level" width={754} height={160} />
      <img className="au-mk-d" src="/asl-mark-dark.png" alt="" width={754} height={160} />
    </>
  );
  return (
    <div className={`au ${lpBody.variable} ${lpDisplay.variable}`}>
      {/* Same default as the landing page: Dark unless the visitor chose a theme. */}
      <script dangerouslySetInnerHTML={{ __html: darkDefaultScript() }} />
      <DarkDefault />
      <aside className="au-side">
        <div className="au-streaks" aria-hidden="true"><i /><i /><i /></div>
        <Link className="au-brand" href="/" aria-label="AI Stupid Level home">{marks}</Link>
        <div>
          <p className="au-kicker">{panel.kicker}</p>
          <h2 className="au-h">{panel.title}</h2>
          <ul className="au-points">
            <li><b>The live leaderboard</b> — every model we measure, re-ranked after every benchmark run.</li>
            <li><b>Drift alerts</b> by email on the models you watch — three free.</li>
            <li><b>The Smart Router</b> — one OpenAI-compatible endpoint, your own provider keys, no markup.</li>
          </ul>
        </div>
        <p className="au-side-foot">Independent measurement. We take no money from any model provider.</p>
      </aside>
      <main className="au-main">
        <Link className="au-brand au-brand-m" href="/" aria-label="AI Stupid Level home">{marks}</Link>
        <div className="au-card">{children}</div>
        <p className="au-legal">Free to create. We never sell your data.</p>
      </main>
    </div>
  );
}
