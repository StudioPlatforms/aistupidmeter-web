import type { Metadata } from 'next';
import { auth } from '@/auth';
import { getLandingSnapshot } from '@/components/landing/data';
import RouterLanding, { ROUTER_DESCRIPTION, ROUTER_KEYWORDS, ROUTER_PATH, ROUTER_TITLE } from '@/components/seo/router/RouterLanding';
import { pageMeta } from '@/lib/seo';
import RouterDashboard from './RouterDashboard';

/**
 * /router is two pages behind one URL, decided here on the server.
 *
 * With a session it is the account's router dashboard: RouterDashboard.tsx is the client page
 * that used to be this file, moved as it was. It brings its own chrome (it renders
 * components/RouterLayout itself: the sidebar rail, the top bar on phones, the studio styles), so
 * the signed-in tree is exactly what it was — app/router/layout.tsx only supplies metadata and
 * passes children straight through.
 *
 * Without a session it is the Smart Router's public landing page, server-rendered in the reading
 * pages' look (components/seo/router/RouterLanding.tsx) and reachable by crawlers now that
 * middleware.ts lets anonymous requests through for this exact path. It is deliberately not
 * wrapped in RouterLayout: that shell is the signed-in app, and its sidebar assumes an account.
 *
 * auth() reads the session cookie, which makes the route dynamic; the data the landing shows is
 * still cached by the fetches themselves (next.revalidate in lib/seo-data and
 * components/landing/data), so an anonymous hit costs a render, not a round of API calls.
 */
export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return pageMeta({
    title: ROUTER_TITLE,
    description: ROUTER_DESCRIPTION,
    path: ROUTER_PATH,
    keywords: ROUTER_KEYWORDS,
  });
}

export default async function RouterPage() {
  const session = await auth().catch(() => null);
  if (session?.user) return <RouterDashboard />;
  return <RouterLanding snapshot={await getLandingSnapshot()} />;
}
