import type { ReactNode } from 'react';
import { researchPath, type ResearchEntry } from '@/lib/research-index';
import { SITE, dayLabel } from '@/lib/seo';

/** A plain-text citation for a research page, with its canonical link, and an optional note on the source. */
export function CiteThis({ entry, note }: { entry: ResearchEntry; note?: ReactNode }) {
  const url = `${SITE}${researchPath(entry)}`;
  const kind = entry.kind === 'paper' ? 'Research report' : 'Measurement report';
  return (
    <div className="rs-cite lp-up">
      <p>
        AI Stupid Level. <i>{entry.title}.</i> {kind}, {dayLabel(entry.published)}. <a href={url}>{url}</a>
      </p>
      {note && <small>{note}</small>}
    </div>
  );
}
