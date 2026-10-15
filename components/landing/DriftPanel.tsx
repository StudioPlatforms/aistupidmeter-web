'use client';

import { useCallback, useState } from 'react';
import DriftChart from './DriftChart';

/** The drift illustration, and what a flag sets in motion: routing moves on, alerts go out. */
export default function DriftPanel() {
  const [shown, setShown] = useState(0);
  const onDrawn = useCallback(() => {
    [1, 2, 3].forEach((n, i) => setTimeout(() => setShown(s => Math.max(s, n)), 150 + i * 260));
  }, []);

  return (
    <div className="lp-drift">
      <figure className="lp-chart lp-up">
        <div className="lp-chart-head">
          <span><b>Illustration</b> · an example model’s reasoning score, daily median · last 30 days</span>
          <span className="lp-legend"><span><i />score</span><span className="lp-lb"><i />own baseline</span><span className="lp-lph"><i />Page-Hinkley</span></span>
        </div>
        <DriftChart onDrawn={onDrawn} />
      </figure>
      <div className="lp-cqs">
        <div className={`lp-cq${shown >= 1 ? ' is-in' : ''}`}>
          <p className="lp-cq-k">Smart Router · next request</p>
          <p className="lp-cq-t">
            <code>auto-reasoning</code> stops picking the flagged model and routes to the next healthy one.{' '}
            <span className="lp-p">The routing reason names who was passed over, and why.</span>
          </p>
          <p className="lp-cq-s">Flagged models drop behind healthy ones for every strategy that depends on that suite.</p>
        </div>
        <div className={`lp-cq${shown >= 2 ? ' is-in' : ''}`}>
          <p className="lp-cq-k">Watchlist · email</p>
          <p className="lp-cq-t"><b>An email when a model you watch drops 5 points below where it was a week ago.</b> Set your own threshold on paid plans.</p>
          <p className="lp-cq-s">Plus a summary every Monday of what moved and what held.</p>
        </div>
        <div className={`lp-cq${shown >= 3 ? ' is-in' : ''}`}>
          <p className="lp-cq-k">Teams · webhook</p>
          <p className="lp-cq-t">A signed callback to your own endpoint when a watched model regresses or a project reaches a budget threshold.</p>
        </div>
      </div>
    </div>
  );
}
