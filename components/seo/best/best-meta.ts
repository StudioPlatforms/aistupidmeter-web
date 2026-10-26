import type { Metadata } from 'next';
import { monthLabel, pageMeta } from '@/lib/seo';
import { getBoards24h, getPrice } from '@/lib/seo-data';
import { BEST, HUB, fillDays, withMonth, type BestKey } from './best-config';

/**
 * generateMetadata for the best-for pages: the title's month comes from the timestamp of the
 * data the page renders (the 24-hour boards, or the price snapshot for the value and speed
 * pages), so "(October 2026)" is never typed. The fetch is the same one the page makes, so Next
 * serves both from one request.
 */
export async function bestMetadata(key: BestKey): Promise<Metadata> {
  const c = BEST[key];
  const price = c.kind === 'price' ? await getPrice() : null;
  const stamp = c.kind === 'board' ? (await getBoards24h())?.generatedAt : price?.generatedAt;
  return pageMeta({
    title: withMonth(c.titleBase, monthLabel(stamp)),
    description: fillDays(c.description, price?.windowDays ?? 30),
    path: c.path,
    keywords: [...c.keywords],
  });
}

export async function hubMetadata(): Promise<Metadata> {
  const boards = await getBoards24h();
  return pageMeta({
    title: withMonth(HUB.titleBase, monthLabel(boards?.generatedAt)),
    description: HUB.description,
    path: HUB.path,
    keywords: [...HUB.keywords],
  });
}
