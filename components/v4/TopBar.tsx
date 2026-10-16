'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ThemeButton from '../ThemeButton';
import AccountMenu, { navClick } from '../AccountMenu';
import { useVisitorStats } from '../../lib/use-visitor-stats';
import { lpBody, lpDisplay } from '../../lib/fonts';
// The bar renders on every public page, most of them outside the studio wrapper: it brings the
// landing palette (.st-tokens) and its own styles with it.
import '../../styles/landing.css';
import '../../styles/studio-board.css';

interface TopBarProps {
  selectedView: string;
  onViewChange: (view: 'dashboard' | 'about' | 'faq') => void;
  visitorCount: number | null;
  todayVisits: number | null;
}

const clock = () =>
  new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }) + ' CET';

/**
 * The site's top bar, in the landing nav's look: the ASL mark, sentence-case links, a quiet live
 * line, the theme switch and the account menu. Frosted once the page scrolls under it.
 */
export default function TopBar({ selectedView, onViewChange, todayVisits }: TopBarProps) {
  const router = useRouter();
  // Pages that do not pass today's count (every page but home) fetch it here. The all-time total
  // is never shown in this slot: it is labelled "today".
  const stats = useVisitorStats();
  const today = todayVisits ?? stats.today;
  const [currentTime, setCurrentTime] = useState<string>('');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Minutes, not seconds: a ticking header is the kind of ambient motion the site dropped.
    const update = () => setCurrentTime(clock());
    update();
    const timer = setInterval(update, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The Smart Router is what the paid plans sell, and until 2026-10-16 it was only in the account
  // menu: about 1 in 20 new accounts ever opened it. Signed out, /router bounces to sign-in, so
  // the link shows the landing's router section instead.
  const { status } = useSession();
  const routerHref = status === 'authenticated' ? '/router' : '/#router';

  const links: Array<{ view: string; href: string; label: string; go: () => void; minor?: boolean }> = [
    { view: 'dashboard', href: '/', label: 'Leaderboard', go: () => { onViewChange('dashboard'); router.push('/'); } },
    { view: 'router', href: routerHref, label: 'Smart Router', go: () => router.push(routerHref) },
    { view: 'about', href: '/about', label: 'About', go: () => router.push('/about'), minor: true },
    { view: 'faq', href: '/faq', label: 'FAQ', go: () => router.push('/faq'), minor: true },
    { view: 'pricing', href: '/pricing', label: 'Pricing', go: () => router.push('/pricing') },
    { view: 'forum', href: '/router/forum', label: 'Forum', go: () => router.push('/router/forum') },
    // Last, which is where people look for it. The site publishes no email address anywhere:
    // anyone wanting to reach us is sent to the form, which routes by topic and cannot be
    // harvested by a scraper.
    { view: 'contact', href: '/contact', label: 'Contact', go: () => router.push('/contact'), minor: true },
  ];

  return (
    <div className={`sb-top st-tokens ${lpBody.variable} ${lpDisplay.variable}${scrolled ? ' is-scrolled' : ''}`}>
      <div className="sb-top-in">
        {/* Two files rather than one recoloured by CSS: the mark's "L" is navy and vanishes on
            the dark theme's surface. Only one is ever displayed, so screen readers announce the
            name once. */}
        <a className="sb-brand" href="/" aria-label="AI Stupid Level home" onClick={navClick(() => onViewChange('dashboard'))}>
          <img className="sb-mk-l" src="/asl-mark.png" width={754} height={160} alt="ASL — AI Stupid Level" />
          <img className="sb-mk-d" src="/asl-mark-dark.png" width={754} height={160} alt="" />
        </a>

        <nav className="sb-links" aria-label="Main">
          {links.map(l => (
            <a
              key={l.view}
              className={`sb-link${l.minor ? ' is-minor' : ''}`}
              href={l.href}
              aria-current={selectedView === l.view ? 'page' : undefined}
              onClick={navClick(l.go)}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="sb-top-end">
          <span className="sb-live">
            <span className="sb-live-on">Online</span>
            <span className="sb-live-sep" aria-hidden="true" />
            <span><b>{today !== null ? today.toLocaleString() : '…'}</b> visits today</span>
            <span className="sb-live-sep sb-live-clock" aria-hidden="true" />
            <span className="sb-live-clock">{currentTime}</span>
          </span>
          <ThemeButton />
          <AccountMenu />
        </div>
      </div>
    </div>
  );
}
