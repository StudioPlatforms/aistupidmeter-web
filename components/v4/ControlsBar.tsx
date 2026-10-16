'use client';

import type { ReactNode } from 'react';
import { PLANS } from '@/lib/entitlements';
import '../../styles/studio-board.css';

interface ControlsBarProps {
  leaderboardPeriod: 'latest' | '24h' | '7d' | '1m';
  leaderboardSortBy: 'combined' | 'reasoning' | 'speed' | 'tooling' | 'price';
  dashboardMode: 'leaderboard' | 'drift';
  hasProAccess: boolean;
  isLoading: boolean;
  onPeriodChange: (period: 'latest' | '24h' | '7d' | '1m') => void;
  onSortByChange: (sortBy: 'combined' | 'reasoning' | 'speed' | 'tooling' | 'price') => void;
  onModeChange: (mode: 'leaderboard' | 'drift') => void;
  onShowProModal: (feature: 'historical-data' | 'performance-matrix' | 'latest-scores') => void;
  /** The newest run is a paid view (lib/capabilities 'latest-scores'); false shows Latest locked. */
  latestAllowed?: boolean;
  /** Draw attention to the drift tab until the visitor has opened it once. */
  nudgeDrift?: boolean;
  /** The Drift monitor is Pro (lib/capabilities 'board-insights'): mark the tab as it marks Latest. */
  driftLocked?: boolean;
  /**
   * The sort only means something where one board is shown: the drift monitor and the table
   * layout. The other layouts show all four boards at once, so it is hidden there.
   */
  showSort?: boolean;
  /** Shown at the end of the bar on wider screens (the page's Share button). */
  extra?: ReactNode;
}

export default function ControlsBar({
  leaderboardPeriod,
  leaderboardSortBy,
  dashboardMode,
  hasProAccess,
  isLoading,
  onPeriodChange,
  onSortByChange,
  onModeChange,
  onShowProModal,
  nudgeDrift = false,
  driftLocked = false,
  showSort = true,
  latestAllowed = true,
  extra,
}: ControlsBarProps) {
  // What a signed-out visitor gets. Everything below is derived from the plan
  // table rather than hard-coded, so the entitlement matrix on /faq and the
  // locks on this bar cannot drift apart — which is precisely what happened
  // before: the FAQ promised "every ranking, chart and drift alert costs
  // nothing" while this component locked three sorts and three periods.
  const free = PLANS.free;

  /** Days of history each period needs. `null` means "current values only". */
  const PERIOD_DAYS: Record<'latest' | '24h' | '7d' | '1m', number | null> = {
    latest: null, '24h': 1, '7d': 7, '1m': 30,
  };

  const needsUpgrade = (days: number | null): boolean => {
    if (hasProAccess || days === null) return false;
    return free.historyDays !== null && days > free.historyDays;
  };

  const periods: Array<{ key: 'latest' | '24h' | '7d' | '1m'; label: string; proOnly: boolean }> = (
    [['latest', 'Latest'], ['24h', '24 hours'], ['7d', '7 days'], ['1m', '1 month']] as const
  ).map(([key, label]) => ({ key, label, proOnly: key === 'latest' ? !latestAllowed : needsUpgrade(PERIOD_DAYS[key]) }));
  // Latest has its own lock (the plan, not a history length), and its own upgrade pitch.
  const isLocked = (p: { key: string; proOnly: boolean }) => (p.key === 'latest' ? p.proOnly : p.proOnly && !hasProAccess);
  const lockedFeature = (p: { key: string }) => (p.key === 'latest' ? 'latest-scores' as const : 'historical-data' as const);

  const sortModes: Array<{ key: 'combined' | 'reasoning' | 'speed' | 'tooling' | 'price'; label: string; proOnly: boolean }> = (
    [['combined', 'Combined'], ['reasoning', 'Reasoning'], ['speed', 'Coding'], ['tooling', 'Tool use'], ['price', 'Price']] as const
  ).map(([key, label]) => ({
    key, label,
    // Category sorts are public utility on every plan; only the combined and
    // price views were ever meant to be universal, and the rest read as
    // withholding evidence a visitor needs to judge whether ASL is any good.
    proOnly: false,
  }));

  const handlePeriodClick = (period: typeof periods[number]) => {
    if (isLocked(period)) {
      onShowProModal(lockedFeature(period));
      return;
    }
    onPeriodChange(period.key);
  };

  const handleSortClick = (sort: typeof sortModes[number]) => {
    if (sort.proOnly && !hasProAccess) {
      onShowProModal('performance-matrix');
      return;
    }
    onSortByChange(sort.key);
  };

  /** What a locked option's tooltip says, as before for Latest; history lengths name the plan too. */
  const lockTitle = (p: { key: string; label: string }) =>
    p.key === 'latest' ? 'The newest run is part of Pro' : `${p.label} of history is part of Pro`;

  // Desktop: the model page's pill controls (styles/studio-board.css .sb-controls). Phones keep
  // the native selects underneath (.sb-controls-m), restyled.
  return (
    <div className="sb-controls">
      <div className="sb-ctl" role="group" aria-label="Period">
        <span className="sb-ctl-l" aria-hidden="true">Period</span>
        <div className="st-seg is-scroll">
          {periods.map(p => (
            <button
              key={p.key}
              type="button"
              aria-pressed={leaderboardPeriod === p.key}
              onClick={() => handlePeriodClick(p)}
              disabled={isLoading}
              title={isLocked(p) ? lockTitle(p) : undefined}
            >
              {p.label}
              {isLocked(p) && <span className="sb-pro">Pro</span>}
            </button>
          ))}
        </div>
      </div>

      {showSort && (
        <div className="sb-ctl" role="group" aria-label="Sort">
          <span className="sb-ctl-l" aria-hidden="true">Sort</span>
          <div className="st-seg is-scroll">
            {sortModes.map(s => (
              <button
                key={s.key}
                type="button"
                aria-pressed={leaderboardSortBy === s.key}
                onClick={() => handleSortClick(s)}
                disabled={isLoading}
              >
                {s.label}
                {s.proOnly && !hasProAccess && <span className="sb-pro">Pro</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* LuckyLarry ad image - desktop only.
          Temporarily disabled; uncomment to bring the banner back.
          The .v4-ctrl-ad styles and /LuckyLarry_Add.png are kept in place. */}
      {/*
      <a href="https://luckylarry.fun/login" target="_blank" rel="noopener noreferrer" className="v4-ctrl-ad">
        <img
          src="/LuckyLarry_Add.png"
          alt="Lucky Larry"
        />
      </a>
      */}

      <div className="sb-ctl sb-ctl-view" role="group" aria-label="View">
        <div className="st-seg">
          <button
            type="button"
            aria-pressed={dashboardMode === 'leaderboard'}
            onClick={() => onModeChange('leaderboard')}
          >
            Leaderboard
          </button>
          <button
            type="button"
            aria-pressed={dashboardMode === 'drift'}
            className={nudgeDrift ? 'is-nudge' : undefined}
            onClick={() => onModeChange('drift')}
          >
            Drift monitor
            {driftLocked && <span className="sb-pro">Pro</span>}
            {nudgeDrift && dashboardMode !== 'drift' && <span className="sb-nudge" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {extra && <div className="sb-ctl-extra">{extra}</div>}

      {/* Phones: compact selects (Period / Sort / View) */}
      <div className={`sb-controls-m${showSort ? ' has-sort' : ''}`}>
        <label className="sb-mc">
          <span className="sb-mc-l">Period</span>
          <select
            className="st-select"
            value={leaderboardPeriod}
            disabled={isLoading}
            onChange={(e) => {
              const p = periods.find(x => x.key === e.target.value)!;
              if (isLocked(p)) { onShowProModal(lockedFeature(p)); return; }
              onPeriodChange(p.key);
            }}
          >
            {periods.map(p => (
              <option key={p.key} value={p.key}>{p.label}{isLocked(p) ? ' · Pro' : ''}</option>
            ))}
          </select>
        </label>

        {showSort && <label className="sb-mc">
          <span className="sb-mc-l">Sort</span>
          <select
            className="st-select"
            value={leaderboardSortBy}
            disabled={isLoading}
            onChange={(e) => {
              const s = sortModes.find(x => x.key === e.target.value)!;
              if (s.proOnly && !hasProAccess) { onShowProModal('performance-matrix'); return; }
              onSortByChange(s.key);
            }}
          >
            {sortModes.map(s => (
              <option key={s.key} value={s.key}>{s.label}{s.proOnly && !hasProAccess ? ' · Pro' : ''}</option>
            ))}
          </select>
        </label>}

        <label className="sb-mc">
          <span className="sb-mc-l">View</span>
          <select
            className="st-select"
            value={dashboardMode}
            onChange={(e) => onModeChange(e.target.value as 'leaderboard' | 'drift')}
          >
            <option value="leaderboard">Leaderboard</option>
            <option value="drift">Drift monitor{driftLocked ? ' · Pro' : ''}</option>
          </select>
        </label>
      </div>
    </div>
  );
}
