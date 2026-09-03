'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Interstitial for /share/<type> links.
 *
 * The share button no longer mints these URLs — it shares the canonical page
 * directly, which carries the same dynamic OG card without a redirect hop. This
 * route stays for links already in the wild, so it has to (a) keep serving the
 * Open Graph tags in layout.tsx for crawlers, and (b) get a human to the real
 * site quickly without looking broken on the way.
 *
 * The redirect is client-side on purpose: a 301 would send crawlers to the
 * homepage and lose the per-type card for `alert` and `winner` links.
 */
export default function SharePage() {
  const router = useRouter();

  useEffect(() => {
    // Short delay so crawlers that execute JS still see the tags first.
    const timer = setTimeout(() => router.replace('/'), 600);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 24,
        background: 'var(--terminal-black, #f6f8fc)',
        fontFamily:
          "'Roboto', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--terminal-dark, #ffffff)',
          border: '1px solid var(--metal-silver, #e3e6ea)',
          borderRadius: 10,
          padding: '28px 26px',
          textAlign: 'center',
        }}
      >
        <img
          src="/asl-mark.png"
          width={116}
          height={25}
          alt="ASL — AI Stupid Level"
          style={{ display: 'inline-block', marginBottom: 16 }}
        />
        <div
          style={{
            fontSize: 17,
            fontWeight: 500,
            color: 'var(--phosphor-green, #202124)',
            letterSpacing: '-0.1px',
          }}
        >
          Taking you to the live leaderboard
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--phosphor-dim, #5f6368)',
          }}
        >
          Independent AI model benchmarks, re-scored every hour.
        </div>
        <a
          href="/"
          style={{
            display: 'inline-block',
            marginTop: 18,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--accent, #1a73e8)',
            textDecoration: 'none',
          }}
        >
          Continue now
        </a>
      </div>
      <noscript>
        <meta httpEquiv="refresh" content="0; url=/" />
      </noscript>
    </main>
  );
}
