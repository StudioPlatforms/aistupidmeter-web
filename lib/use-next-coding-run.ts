'use client';

import { useEffect, useState } from 'react';

export interface NextCodingRun {
  /** Time left, e.g. "1h 12m". */
  left: string;
  /** The run's start in the viewer's own time, e.g. "16:00". */
  local: string;
}

/**
 * Time until the next coding sweep, refreshed every minute. The sweep is cron '0 *\/4 * * *' in
 * Europe/Berlin; Berlin's wall clock is read with DST included and the result is shown in the
 * viewer's own time. null on the server and on the first client render, so markup that depends
 * on it never mismatches during hydration.
 */
export function useNextCodingRun(): NextCodingRun | null {
  const [next, setNext] = useState<NextCodingRun | null>(null);
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const berlin = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }).formatToParts(now).reduce((acc: Record<string, string>, p) => { acc[p.type] = p.value; return acc; }, {});
      const bh = Number(berlin.hour) % 24, bm = Number(berlin.minute), bs = Number(berlin.second);
      let secsLeft = 4 * 3600 - ((bh % 4) * 3600 + bm * 60 + bs);
      if (secsLeft <= 0) secsLeft += 4 * 3600;
      const at = new Date(now.getTime() + secsLeft * 1000);
      setNext({
        left: `${Math.floor(secsLeft / 3600)}h ${Math.floor((secsLeft % 3600) / 60)}m`,
        local: at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      });
    };
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, []);
  return next;
}
