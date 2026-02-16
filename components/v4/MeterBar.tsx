'use client';

import { useState, useEffect } from 'react';

interface MeterBarProps {
  globalIndex: any;
  modelScores: any[];
  loading?: boolean;
}

export default function MeterBar({ globalIndex, modelScores, loading }: MeterBarProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  const calculateScore = (): number => {
    if (modelScores && modelScores.length > 0) {
      const valid = modelScores
        .filter(m => m.currentScore !== 'unavailable' && typeof m.currentScore === 'number')
        .map(m => m.currentScore as number);
      if (valid.length > 0) {
        const sorted = [...valid].sort((a, b) => b - a);
        let wSum = 0, wTotal = 0;
        sorted.forEach((score, i) => {
          const pct = i / sorted.length;
          const w = pct <= 0.25 ? 2.0 : pct <= 0.5 ? 1.5 : 1.0;
          wSum += score * w;
          wTotal += w;
        });
        return Math.max(0, Math.min(100, Math.round(wSum / wTotal)));
      }
    }
    if (globalIndex?.current?.globalScore) {
      return Math.max(0, Math.min(100, globalIndex.current.globalScore));
    }
    return 50;
  };

  const currentScore = calculateScore();
  const available = modelScores.filter(m => typeof m.currentScore === 'number').length;
  const total = modelScores.length;
  const trend = globalIndex?.trend || 'stable';
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
        <span style={{ fontSize: '9px' }}>{available}/{total} OK</span>
      </div>
    </div>
  );
}
