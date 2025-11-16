'use client';

import { useEffect, useState } from 'react';

interface HealthStatus {
  [key: string]: {
    status: 'operational' | 'degraded' | 'down' | 'unknown';
    responseTime: number | null;
    lastChecked: string | null;
    error: string | null;
  };
}

interface StupidMeterProps {
  globalIndex: any;
  degradations: any[];
  modelScores: any[];
  loading?: boolean;
}

export default function StupidMeter({ globalIndex, degradations, modelScores, loading }: StupidMeterProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({});
  const [healthLoading, setHealthLoading] = useState(true);

  // Calculate the intelligence score based on latest combined model scores
  const calculateIntelligenceScore = (): number => {
    // NEW: Use modelScores for more accurate real-time calculation
    if (modelScores && modelScores.length > 0) {
      // Filter out unavailable models and get valid scores
      const validScores = modelScores
        .filter(model => model.currentScore !== 'unavailable' && typeof model.currentScore === 'number')
        .map(model => model.currentScore as number);
      
      if (validScores.length > 0) {
        // Calculate weighted average - give more weight to top performers
        const sortedScores = [...validScores].sort((a, b) => b - a);
        
        // Weight calculation: top 25% get 2x weight, next 25% get 1.5x weight, rest get 1x weight
        let weightedSum = 0;
        let totalWeight = 0;
        
        sortedScores.forEach((score, index) => {
          const percentile = index / sortedScores.length;
          let weight = 1;
          
          if (percentile <= 0.25) weight = 2.0;      // Top 25% - double weight
          else if (percentile <= 0.5) weight = 1.5;  // Next 25% - 1.5x weight
          else weight = 1.0;                         // Bottom 50% - normal weight
          
          weightedSum += score * weight;
          totalWeight += weight;
        });
        
        const weightedAverage = weightedSum / totalWeight;
        
        // Apply slight adjustment to make the meter more responsive to poor performance
        // If more than 30% of models are below 60, reduce the overall score
        const poorPerformers = validScores.filter(score => score < 60).length;
        const poorPerformerRatio = poorPerformers / validScores.length;
        
        let adjustedScore = weightedAverage;
        if (poorPerformerRatio > 0.3) {
          // Reduce score by up to 15 points if many models are performing poorly
          const penalty = Math.min(15, poorPerformerRatio * 25);
          adjustedScore = Math.max(0, weightedAverage - penalty);
        }
        
        return Math.max(0, Math.min(100, Math.round(adjustedScore)));
      }
    }
    
    // FALLBACK: Use globalIndex if modelScores not available
    if (globalIndex?.current?.globalScore) {
      return Math.max(0, Math.min(100, globalIndex.current.globalScore));
    }
    
    // DEFAULT: Return neutral score
    return 50;
  };

  const currentScore = calculateIntelligenceScore();

  // Fetch health status
  useEffect(() => {
    const fetchHealthStatus = async () => {
      try {
        console.log('🔍 Fetching health status from:', `${process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000'}/providers`);
        const response = await fetch(`${process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000'}/providers`);
        console.log('📡 Health status response:', response.status, response.ok);
        if (response.ok) {
          const data = await response.json();
          console.log('📊 Health status data:', data);
          if (data.success) {
            console.log('✅ Setting health status:', data.data);
            setHealthStatus(data.data);
          } else {
            console.error('❌ Health status API returned success=false:', data);
          }
        } else {
          console.error('❌ Health status API response not ok:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('❌ Failed to fetch health status:', error);
      } finally {
        setHealthLoading(false);
      }
    };

    fetchHealthStatus();
    
    // Refresh health status every 30 seconds
    const interval = setInterval(fetchHealthStatus, 30000);
    return () => clearInterval(interval);
  }, []);

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

  // Health status component
  const renderHealthStatus = () => {
    if (healthLoading) {
      return (
        <div className="health-status-container">
          <div className="health-status-loading">
            <span className="health-dot loading"></span>
            <span className="health-dot loading"></span>
            <span className="health-dot loading"></span>
            <span className="health-dot loading"></span>
          </div>
        </div>
      );
    }

    const providers = [
      { key: 'openai', name: 'GPT' },
      { key: 'anthropic', name: 'CLAUDE' },
      { key: 'google', name: 'GEMINI' },
      { key: 'xai', name: 'GROK' },
      { key: 'deepseek', name: 'DEEPSEEK' },
      { key: 'glm', name: 'GLM' },
      { key: 'kimi', name: 'KIMI' }
    ];

    return (
      <div className="health-status-container">
        <div className="health-status-grid">
          {providers.map(({ key, name }) => {
            const status = healthStatus[key]?.status || 'unknown';
            const providerActive = modelScores?.some(
              (m) => m.provider === key && typeof m.currentScore === 'number' && m.currentScore >= 0
            );
            // If we lack health data or it's marked down but we have recent scores, show “on” (operational) for UX clarity
            const fallbackStatus =
              status === 'operational'
                ? 'operational'
                : providerActive
                  ? 'operational'
                  : status;
            const responseTime = healthStatus[key]?.responseTime;
            
            let statusClass = 'unknown';
            let statusSymbol = '?';
            
            if (fallbackStatus === 'operational') {
              statusClass = 'operational';
              statusSymbol = '●';
            } else if (fallbackStatus === 'degraded') {
              statusClass = 'degraded';
              statusSymbol = '●';
            } else if (fallbackStatus === 'down') {
              statusClass = 'down';
              statusSymbol = '●';
            }

            return (
              <div 
                key={key} 
                className={`health-provider ${statusClass}`}
                title={`${name}: ${fallbackStatus.toUpperCase()}${responseTime ? ` (${responseTime}ms)` : ''}`}
              >
                <span className="provider-name">{name}</span>
                <span className={`status-indicator ${statusClass}`}>{statusSymbol}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="stupid-meter-container">
        <div className="stupid-meter-progress-bar">
          <div className="stupid-meter-labels">
            <span className="stupid-label">STUPID</span>
            <span className="smart-label">SMART</span>
          </div>
          <div className="retro-progress-track">
            <div className="retro-progress-fill loading" style={{ width: '50%' }}></div>
          </div>
        </div>
        {renderHealthStatus()}
      </div>
    );
  }

  return (
    <div className="stupid-meter-container">
      <div className="stupid-meter-progress-bar">
        <div className="stupid-meter-labels">
          <span className="stupid-label">STUPID</span>
          <span className="smart-label">SMART</span>
        </div>
        <div className="retro-progress-track">
          <div 
            className="retro-progress-fill ultra-pixelated"
            style={{ 
              width: `${animatedScore}%`,
              backgroundColor: scoreColor
            }}
          >
            {/* Ultra-pixelated blocks overlay for maximum retro effect */}
            <div className="ultra-pixel-blocks"></div>
          </div>
          {/* More pronounced progress bar notches */}
          <div className="progress-notches">
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} className="progress-notch" style={{ left: `${(i + 1) * 5}%` }}></div>
            ))}
          </div>
        </div>
      </div>
      {renderHealthStatus()}
    </div>
  );
}
