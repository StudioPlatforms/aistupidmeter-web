'use client';

import Link from 'next/link';
import '@/styles/studio-provider-entry.css';

/**
 * The account home's one ruled row into provider accounts (§2.0). AccountOverview shows it only
 * once provider accounts are open to everyone (M10), and loads it (and these four style rules)
 * only then: before that, /account carries none of it.
 */
export default function ProviderEntry() {
  return (
    <Link href="/account/provider/new" className="mp-entry st-up">
      <span>
        <span className="mp-entry-t">List your models as a provider <span className="st-ar" aria-hidden="true">→</span></span>
        <span className="mp-entry-s" style={{ display: 'block' }}>For inference providers: a free provider account, separate from your plan.</span>
      </span>
    </Link>
  );
}
