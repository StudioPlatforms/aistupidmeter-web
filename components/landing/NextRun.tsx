'use client';

import { useNextCodingRun } from '@/lib/use-next-coding-run';

/**
 * "Next test run in 1h 12m", counting down to the next coding sweep. Before the script runs (and
 * for crawlers) it reads "Re-tested every 4 hours", which is the same fact without the clock.
 */
export default function NextRun() {
  const next = useNextCodingRun();
  return (
    <span className="lp-rb-next">
      {next ? <>Next test run in <b>{next.left}</b></> : 'Re-tested every 4 hours'}
    </span>
  );
}
