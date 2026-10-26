import Link from 'next/link';
import { researchPath, type ResearchEntry } from '@/lib/research-index';
import { dayLabel } from '@/lib/seo';

const KIND: Record<ResearchEntry['kind'], string> = { paper: 'Paper', report: 'Report' };

/** The hub's list of research pages: kind and date, the title as a link, a one-line summary. Ruled rows, not cards. */
export function ArticleList({ entries }: { entries: ResearchEntry[] }) {
  if (!entries.length) return null;
  return (
    <ol className="rs-list lp-up">
      {entries.map((e) => (
        <li key={e.slug}>
          <p className="rs-kind">
            {KIND[e.kind]} · published {dayLabel(e.published)}{e.updated !== e.published && <> · updated {dayLabel(e.updated)}</>}
          </p>
          <h3><Link href={researchPath(e)}>{e.title}</Link></h3>
          <p>{e.summary}</p>
          <Link className="lp-more" href={researchPath(e)} data-cta={`research-hub-list-${e.slug}`}>Read the {KIND[e.kind].toLowerCase()}</Link>
        </li>
      ))}
    </ol>
  );
}
