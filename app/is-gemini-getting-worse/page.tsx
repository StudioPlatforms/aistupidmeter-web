import type { Metadata } from 'next';
import WorsePage from '@/components/seo/worse/WorsePage';
import { worseMetadata } from '@/components/seo/worse/worse-meta';

/** /is-gemini-getting-worse: the google family's "getting worse" page (components/seo/worse/WorsePage.tsx). */

export const revalidate = 900;

export async function generateMetadata(): Promise<Metadata> {
  return worseMetadata('google');
}

export default async function Page(): Promise<JSX.Element> {
  return WorsePage({ vendor: 'google' });
}
