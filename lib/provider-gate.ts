import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { readProviderSummary } from '@/lib/provider-membership';
import { providerSignupOpenCached, providerSignupOpenNow } from '@/lib/provider-public';
import type { ProviderSummary } from '@/lib/provider-account';
import { pageMeta } from '@/lib/seo';

/**
 * The door of every /account/provider page, decided once per request (React cache: the page's
 * metadata and its body both ask, the API is asked once).
 *
 * - Signed in: the API decides. GET /account/provider answers 404 to every account provider
 *   accounts are not switched on for (they are built and tried by our own staff first), and any
 *   other answer than 200 (a restart, a timeout, 503 while its tables are missing) counts as no:
 *   a page that cannot ask must not show itself. No → the site's ordinary 404.
 * - Signed out: the ordinary 404 too, while provider accounts are not open to everyone (staff sign
 *   in first, like anyone else, so a signed-out visitor learns nothing). Once they are open (M10),
 *   to sign-in and back here.
 */
type Access = { kind: 'ok'; summary: ProviderSummary } | { kind: 'signin' } | { kind: 'no' };

const providerAccess = cache(async (_path: string): Promise<Access> => {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  if (!userId) return providerSignupOpenCached() ? { kind: 'signin' } : { kind: 'no' };
  const { status, data } = await readProviderSummary<ProviderSummary>(userId, 1500);
  return status === 200 && data ? { kind: 'ok', summary: data } : { kind: 'no' };
});

/** The page body's door: the summary, or the 404 (or, once open to everyone, the sign-in redirect). */
export async function providerPageGate(path: string): Promise<ProviderSummary> {
  const access = await providerAccess(path);
  if (access.kind === 'signin') redirect(`/auth/signin?callbackUrl=${encodeURIComponent(path)}`);
  if (access.kind !== 'ok') notFound();
  return access.summary;
}

/**
 * The door of a page about provider accounts that is not one of the account's own pages, such as
 * the Logo standards (/inference-providers/logo-standards): shown while provider accounts are staff
 * only (M3–M9) to every account the API lets into the provider pages, member or not, and the site's
 * 404 to everyone else, signed out included. From the opening (M10: ASL_MARKETPLACE=on, the API's
 * status route says provider sign-up is open) it is public, and `preview` is false.
 */
export async function marketplaceStaffGate(path: string): Promise<{ preview: boolean }> {
  if (await providerSignupOpenNow()) return { preview: false };
  const access = await providerAccess(path);
  if (access.kind !== 'ok') notFound();
  return { preview: true };
}

/**
 * The pages' metadata, behind the same door. It never throws: a refused visitor gets the 404 page's
 * own title and robots here, and the page body answers the 404 itself. (Throwing notFound() from
 * generateMetadata also dropped the viewport meta from that 404, so phones laid it out at desktop
 * width until scripts ran; a static `metadata` would have leaked the provider title instead.)
 */
export function providerPageMetadata(path: string, title: string, description?: string) {
  return async (): Promise<Metadata> => {
    // Public from the opening (M10): indexed, with the page's own description. A page with a
    // description is a public document and gets the complete set (canonical, Open Graph and Twitter
    // card of its own): with the title and canonical alone it inherited the home page's og:url and
    // share text from the root layout.
    if (await providerSignupOpenNow()) {
      return description ? pageMeta({ title, description, path }) : { title, alternates: { canonical: path } };
    }
    const access = await providerAccess(path);
    return access.kind === 'ok'
      ? { title, robots: { index: false, follow: false } }
      : { title: 'Page not found', robots: { index: false, follow: true } };
  };
}
