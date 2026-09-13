'use client';

import { useState, useEffect } from 'react';

interface MeterBarProps {
  globalIndex: any;
  modelScores: any[];
  loading?: boolean;
}

export default function MeterBar({ globalIndex, modelScores, loading }: MeterBarProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  // The same number as GLOBAL INDEX directly above: a plain mean of the models listed below,
  // for whatever period and benchmark is selected.
  //
  // It used to be a top-weighted mean — the best quarter of the fleet counted double, the next
  // quarter one and a half — which put 80 on this meter while the index a few pixels above read
  // 78 and the board beneath averaged 78. Three fleet numbers on one screen, none of them
  // wrong on its own terms and no way for a reader to tell why they differed. A weighting that
  // flatters the leaders is also the wrong summary for a page whose subject is models getting
  // worse.
  const calculateScore = (): number => {
    const valid = modelScores
      .filter(m => m.currentScore !== 'unavailable' && typeof m.currentScore === 'number')
      .map(m => m.currentScore as number);
    if (valid.length > 0) {
      return Math.max(0, Math.min(100, Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)));
    }
    if (globalIndex?.current?.globalScore) {
      return Math.max(0, Math.min(100, globalIndex.current.globalScore));
    }
    return 50;
  };

  const currentScore = calculateScore();
  const available = modelScores.filter(m => typeof m.currentScore === 'number').length;
  const total = modelScores.length;

  // "24/24 OK" counted models that returned a number, so a fleet with two declining models
  // still read OK. Report what the summary bar reports: how many are not currently declining.
  const declining = modelScores.filter(m => m.trend === 'down').length;
  const healthLabel = declining > 0
    ? `${available - declining}/${total} steady · ${declining} declining`
    : `${available}/${total} steady`;
  // Trend of what is on screen, not of a fixed 24-hour combined window.
  //
  // This came from /global-index, which takes no period or sort parameter, so the arrow said
  // "declining" while the user was looking at a tooling board where sixteen models had moved
  // up. Derived from the rows instead: more falling than rising is declining, and vice versa.
  const risers = modelScores.filter(m => m.trend === 'up').length;
  const fallers = modelScores.filter(m => m.trend === 'down').length;
  const derivedTrend = fallers > risers ? 'declining' : risers > fallers ? 'improving' : 'stable';
  const trend = derivedTrend;
  const trendSymbol = trend === 'improving' ? '↗' : trend === 'declining' ? '↘' : '→';

  useEffect(() => {
    if (loading) return;
    const start = animatedScore;
    const end = currentScore;
    const duration = 1500;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);
      setAnimatedScore(start + (end - start) * ease);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [currentScore, loading]);

  const scoreColor = animatedScore >= 70 ? 'var(--phosphor-green)' : animatedScore >= 50 ? 'var(--amber-warning)' : 'var(--red-alert)';

  return (
    <div className="v4-meter-bar">
      <div className="v4-meter-labels">
        <span className="stupid">STUPID</span>
        <span className="smart">SMART</span>
      </div>
      <div className="v4-meter-track">
        <div className="v4-meter-fill" style={{ width: `${animatedScore}%` }}></div>
        <div className="v4-meter-notches">
          {Array.from({ length: 20 }, (_, i) => <span key={i}></span>)}
        </div>
      </div>
      <div className="v4-meter-value" style={{ color: scoreColor }}>
        {Math.round(animatedScore)}
      </div>
      <div className="v4-meter-trend">
        {trendSymbol} {trend.toUpperCase()}<br />
        <span style={{ fontSize: '9px' }}>{healthLabel}</span>
      </div>
    </div>
  );
}
