'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import '../styles/site-footer.css';
import { useVisitorStats } from '../lib/use-visitor-stats';

/**
 * The one footer, on every public page, rendered once by the root layout after the page.
 *
 * It used to be a component each page had to remember to render, and only the home page and
 * the model pages did — so About, FAQ, Methodology, Pricing and the rest had none, and on a
 * model page it sat ABOVE the server-rendered explanation text, which is appended after the
 * client component. Rendering it from the layout makes it last on every page by construction.
 *
 * Hidden on the app screens that have their own chrome: the router dashboard, admin and the
 * share-image renderer. The router's docs, help and forum are public pages and keep it.
 */

const HIDDEN = [/^\/router(\/|$)(?!forum|docs|help)/, /^\/admin(\/|$)/, /^\/share(\/|$)/, /^\/drift-test(\/|$)/];

function useNextCodingRun(): string {
  const [text, setText] = useState('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      // The coding sweep is cron '0 */4 * * *' in Europe/Berlin; read Berlin's wall clock,
      // DST included, and show the result in the viewer's own time.
      const berlin = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }).formatToParts(now).reduce((acc: Record<string, string>, p) => { acc[p.type] = p.value; return acc; }, {});
      const bh = Number(berlin.hour) % 24, bm = Number(berlin.minute), bs = Number(berlin.second);
      let secsLeft = 4 * 3600 - ((bh % 4) * 3600 + bm * 60 + bs);
      if (secsLeft <= 0) secsLeft += 4 * 3600;
      const next = new Date(now.getTime() + secsLeft * 1000);
      const local = next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      setText(`${Math.floor(secsLeft / 3600)}h ${Math.floor((secsLeft % 3600) / 60)}m (${local})`);
    };
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, []);
  return text;
}

export default function SiteFooter() {
  const pathname = usePathname() || '/';
  const nextRun = useNextCodingRun();
  const visits = useVisitorStats().total;

  if (HIDDEN.some((re) => re.test(pathname))) return null;

  // The original slim bar (styles/v4-layout.css .v4-footer, 32px, 10px type) — kept as it was;
  // only where it is rendered changed.
  return (
    <footer className="v4-footer site-footer">
      <div>
        A product of <a href="https://studioplatforms.eu" target="_blank" rel="noopener noreferrer">Studio Platforms</a> — © {new Date().getFullYear()}
      </div>
      <div className="v4-footer-center">
        <a href="https://www.reddit.com/r/aistupidlevel/" target="_blank" rel="noopener noreferrer">r/AIStupidLevel</a>
        <a href="https://x.com/AIStupidlevel" target="_blank" rel="noopener noreferrer">Follow on X</a>
        <a href="https://github.com/StudioPlatforms/aistupidmeter-web" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="https://www.producthunt.com/products/aistupidlevel?launch=aistupidlevel" target="_blank" rel="noopener noreferrer">Product Hunt</a>
        <Link href="/status">Provider status</Link>
        <Link href="/contact">Contact</Link>
        {nextRun && <span>Next bench: <b style={{ color: 'var(--phosphor-green)' }}>{nextRun}</b></span>}
      </div>
      <div>
        {/* totals.visits counts visits, not people (unique is a tenth of it) — label it as such. */}
        {visits
          ? `${visits >= 1e6 ? `${(visits / 1e6).toFixed(1)}M` : `${Math.round(visits / 1000)}K`} visits`
          : 'Monitoring AI since 2025'}
      </div>
    </footer>
  );
}
