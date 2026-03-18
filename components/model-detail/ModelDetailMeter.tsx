'use client';

import { useState, useEffect } from 'react';

interface ModelDetailMeterProps {
  currentScore: number;
  trend: string;
  status: string;
}

export default function ModelDetailMeter({ currentScore, trend, status }: ModelDetailMeterProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const start = animatedScore;
    const end = currentScore || 0;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScore]);

  const scoreColor =
    animatedScore >= 80 ? 'var(--phosphor-green)'
    : animatedScore >= 60 ? 'var(--amber-warning)'
    : 'var(--red-alert)';

  const trendSymbol = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→';
  const trendColor = trend === 'up' ? 'var(--phosphor-green)' : trend === 'down' ? 'var(--red-alert)' : 'var(--phosphor-dim)';

  return (
    <div className="md-meter-bar">
      <div className="md-meter-labels">
        <span className="stupid">STUPID</span>
        <span className="smart">SMART</span>
      </div>
      <div className="md-meter-track">
        <div className="md-meter-fill" style={{ width: `${animatedScore}%` }}></div>
        <div className="md-meter-notches">
          {Array.from({ length: 20 }, (_, i) => <span key={i}></span>)}
        </div>
      </div>
      <div className="md-meter-value" style={{ color: scoreColor }}>
        {Math.round(animatedScore)}
      </div>
      <div className="md-meter-info">
        <span style={{ color: trendColor }}>{trendSymbol} {trend.toUpperCase()}</span>
        <br />
        <span style={{ fontSize: '9px', color: 'var(--phosphor-dim)' }}>
          {status.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
