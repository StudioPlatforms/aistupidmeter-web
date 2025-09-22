'use client';

import { useEffect, useState } from 'react';

interface StupidMeterProps {
  globalIndex: any;
  degradations: any[];
  modelScores: any[];
  loading?: boolean;
}

export default function StupidMeter({ globalIndex, degradations, modelScores, loading }: StupidMeterProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  // Calculate the intelligence score
  const calculateIntelligenceScore = (): number => {
    if (!globalIndex?.current?.globalScore) return 50;
    return Math.max(0, Math.min(100, globalIndex.current.globalScore));
  };

  const currentScore = calculateIntelligenceScore();

  // Animate score changes
  useEffect(() => {
    if (loading) return;
    
    const startScore = animatedScore;
    const endScore = currentScore;
    const duration = 1500;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const newScore = startScore + (endScore - startScore) * easeOutQuart;
      
      setAnimatedScore(newScore);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [currentScore, loading]);

  // Get color based on score (inverted for stupidity - low score = red/stupid, high score = green/smart)
  const getScoreColor = (score: number): string => {
    if (score >= 70) return 'var(--phosphor-green)';
    if (score >= 50) return 'var(--amber-warning)';
    return 'var(--red-alert)';
  };

  const scoreColor = getScoreColor(animatedScore);

  if (loading) {
    return (
      <div className="stupid-meter-progress-bar">
        <div className="stupid-meter-labels">
          <span className="stupid-label">STUPID</span>
          <span className="smart-label">SMART</span>
        </div>
        <div className="retro-progress-track">
          <div className="retro-progress-fill loading" style={{ width: '50%' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="stupid-meter-progress-bar">
      <div className="stupid-meter-labels">
        <span className="stupid-label">STUPID</span>
        <span className="smart-label">SMART</span>
      </div>
      <div className="retro-progress-track">
        <div 
          className="retro-progress-fill"
          style={{ 
            width: `${animatedScore}%`,
            backgroundColor: scoreColor,
            boxShadow: `0 0 8px ${scoreColor}40`
          }}
        ></div>
      </div>
    </div>
  );
}
