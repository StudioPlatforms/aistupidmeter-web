import Link from 'next/link';
import { utcStamp } from '@/lib/seo';
import type { CanaryIncident, SeoModel } from '@/lib/seo-data';
import { Pill } from './TrackerTable';
import { durationText, incidentText } from './tracker-data';

/**
 * The canary's alarms over the last 30 days, newest first: when each opened, which model, how far
 * its probe score fell and how significant the fall was, and whether it has closed. A model that
 * has since left the board keeps its row under its API name. When the feed does not answer the
 * log says so instead of showing an empty list, which would read as "no alarms".
 */
export function TrackerLog({ incidents, roster }: { incidents: CanaryIncident[] | null; roster: SeoModel[] }) {
  if (incidents === null) {
    return <p className="wr-note">The canary&apos;s incident feed is not answering at the moment, so this log is left out rather than shown as empty.</p>;
  }
  if (!incidents.length) {
    return <p className="wr-note">No canary alarm in the last 30 days: no model&apos;s probe score fell 12 points or more with p &lt; 0.01.</p>;
  }
  const byId = new Map(roster.map((m) => [m.id, m] as const));
  return (
    <ol className="tk-log lp-up" aria-label="Canary alarms in the last 30 days">
      {incidents.map((i) => {
        const m = byId.get(String(i.modelId));
        return (
          <li key={i.id} className={i.resolvedAt ? 'is-closed' : 'is-open'}>
            <p className="tk-log-when"><time dateTime={i.detectedAt}>{utcStamp(i.detectedAt)}</time></p>
            <p className="tk-log-m">{m ? <Link href={`/models/${m.slug}`}>{m.displayName}</Link> : i.modelName}</p>
            <p className="tk-log-t">{incidentText(i)}</p>
            <p className="tk-log-s">
              <Pill tone={i.resolvedAt ? 'ok' : 'bad'}>{i.resolvedAt ? `Closed after ${durationText(i.detectedAt, i.resolvedAt)}` : 'Open now'}</Pill>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
