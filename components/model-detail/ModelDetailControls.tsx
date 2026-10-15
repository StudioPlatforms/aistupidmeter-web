'use client';

import { useEffect, useRef, useState } from 'react';
import { PLANS } from '@/lib/entitlements';

type HistoricalPeriod = 'latest' | '24h' | '7d' | '1m';
type ScoringMode = 'combined' | 'reasoning' | 'speed' | 'tooling';

interface ModelDetailControlsProps {
  selectedPeriod: HistoricalPeriod;
  selectedScoringMode: ScoringMode;
  hasProAccess: boolean;
  isRefreshing: boolean;
  onPeriodChange: (period: HistoricalPeriod) => void;
  onScoringModeChange: (mode: ScoringMode) => void;
  onShowProModal: (feature: 'historical-data' | 'performance-matrix' | 'latest-scores') => void;
  /** The newest run is a paid view (lib/capabilities 'latest-scores'); false shows Latest locked. */
  latestAllowed?: boolean;
}

/**
 * History depth is an entitlement, not a hard-coded flag — same rule as the
 * leaderboard's ControlsBar. Free covers everything inside PLANS.free.historyDays;
 * beyond that is paid. Diagnosis (the Page-Hinkley curve, the axis matrix) stays
 * paid regardless of window, which is the line the pricing is drawn on: basic
 * evidence is public, interpreting it is the product.
 */
const PERIOD_DAYS: Record<HistoricalPeriod, number | null> = {
  latest: null, '24h': 1, '7d': 7, '1m': 30,
};

function periodsFor(hasProAccess: boolean, latestAllowed: boolean): Array<{ key: HistoricalPeriod; label: string; locked: boolean }> {
  const freeDays = PLANS.free.historyDays;
  const locked = (d: number | null) =>
    !hasProAccess && d !== null && freeDays !== null && d > freeDays;
  // Latest has its own rule: it is the paid view of the newest run, whatever the history length.
  return ([['latest', 'Latest'], ['24h', '24 hours'], ['7d', '7 days'], ['1m', '1 month']] as const)
    .map(([key, label]) => ({ key, label, locked: key === 'latest' ? !latestAllowed : locked(PERIOD_DAYS[key]) }));
}

const scoringModes: Array<{ key: ScoringMode; label: string }> = [
  { key: 'combined', label: 'Combined' },
  { key: 'reasoning', label: 'Reasoning' },
  { key: 'speed', label: 'Coding' },
  { key: 'tooling', label: 'Tool use' },
];

/** Height of the site's top bar plus this bar's offset under it (styles/studio-model.css). */
const STICK_AT = 56 + 10;

export default function ModelDetailControls({
  selectedPeriod,
  selectedScoringMode,
  hasProAccess,
  isRefreshing,
  onPeriodChange,
  onScoringModeChange,
  onShowProModal,
  latestAllowed = true,
}: ModelDetailControlsProps) {
  const periods = periodsFor(hasProAccess, latestAllowed);
  const bar = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  // On wider screens the bar sticks under the site's top bar; once it is floating over the
  // panels it gets a shadow, so it reads as a layer rather than as one more card.
  useEffect(() => {
    const el = bar.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => {
      setStuck(e.intersectionRatio < 1 && e.boundingClientRect.top <= STICK_AT + 1);
    }, { threshold: [1], rootMargin: `-${STICK_AT + 1}px 0px 0px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const handlePeriodClick = (period: typeof periods[number]) => {
    if (period.locked) {
      onShowProModal(period.key === 'latest' ? 'latest-scores' : 'historical-data');
      return;
    }
    onPeriodChange(period.key);
  };

  return (
    <div className={`sm-controls${stuck ? ' is-stuck' : ''}`} ref={bar}>
      <div className="sm-ctl" role="group" aria-label="Period">
        <span className="sm-ctl-l" aria-hidden="true">Period</span>
        <div className="st-seg is-scroll">
          {periods.map(p => {
            const locked = p.locked;
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={selectedPeriod === p.key}
                onClick={() => handlePeriodClick(p)}
                disabled={isRefreshing}
                title={locked ? (p.key === 'latest' ? 'The newest run is part of Pro' : `${p.label} of history is part of Pro`) : undefined}
              >
                {p.label}
                {locked && <span className="sm-pro">Pro</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sm-ctl" role="group" aria-label="Scoring mode">
        <span className="sm-ctl-l" aria-hidden="true">Mode</span>
        <div className="st-seg is-scroll">
          {scoringModes.map(m => (
            <button
              key={m.key}
              type="button"
              aria-pressed={selectedScoringMode === m.key}
              onClick={() => onScoringModeChange(m.key)}
              disabled={isRefreshing}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sm-ctl-end" aria-live="polite">
        {isRefreshing && (
          <span className="sm-refreshing">
            <span className="st-bars" aria-hidden="true"><i /><i /><i /></span>
            Refreshing
          </span>
        )}
      </div>
    </div>
  );
}
