'use client';

import { useState, useEffect } from 'react';

interface ModelTooltipProps {
  model: any;
  sortBy: string;
  children: React.ReactNode;
}

const ModelTooltip: React.FC<ModelTooltipProps> = ({ model, sortBy, children }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [hoverTimer, setHoverTimer] = useState<NodeJS.Timeout | null>(null);

  // Helper function to get tier based on value
  const getTier = (value: number): string => {
    if (value >= 85) return 'ELITE';
    if (value >= 75) return 'STRONG';
    if (value >= 60) return 'GOOD';
    if (value >= 45) return 'FAIR';
    return 'POOR';
  };

  // Helper function to get tier color
  const getTierColor = (value: number): string => {
    if (value >= 85) return 'terminal-text--green';
    if (value >= 75) return 'terminal-text--green';
    if (value >= 60) return 'terminal-text--amber';
    if (value >= 45) return 'terminal-text--amber';
    return 'terminal-text--red';
  };

  // Generate tooltip content based on sorting mode (reusing logic from models page)
  const getTooltipContent = () => {
    if (!model.latestScore?.axes && !model.axes) return null;

    const axes = model.latestScore?.axes || model.axes || {};
    
    switch (sortBy) {
      case 'speed':
        return {
          title: '🎯 7-AXIS PERFORMANCE MATRIX',
          subtitle: 'Comprehensive analysis across all evaluation criteria',
          metrics: [
            { key: 'correctness', label: 'CORRECTNESS', icon: '✅', weight: '35%', description: 'Code functionality and accuracy' },
            { key: 'spec', label: 'SPEC COMPLIANCE', icon: '📋', weight: '15%', description: 'Following instructions and format' },
            { key: 'codeQuality', label: 'CODE QUALITY', icon: '🎨', weight: '15%', description: 'Readability and best practices' },
            { key: 'efficiency', label: 'EFFICIENCY', icon: '⚡', weight: '10%', description: 'Response speed and optimization' },
            { key: 'stability', label: 'STABILITY', icon: '🔄', weight: '10%', description: 'Consistent performance' },
            { key: 'refusal', label: 'REFUSAL RATE', icon: '🚫', weight: '10%', description: 'Appropriate task acceptance' },
            { key: 'recovery', label: 'RECOVERY', icon: '🔧', weight: '5%', description: 'Error correction ability' }
          ]
        };

      case 'combined':
        return {
          title: '🎯 COMBINED PERFORMANCE MATRIX',
          subtitle: 'Unified analysis: 70% Speed Benchmarks + 30% Deep Reasoning',
          metrics: [
            { key: 'correctness', label: 'CODING ACCURACY', icon: '✅', weight: '25%', description: 'Fast coding task correctness' },
            { key: 'efficiency', label: 'CODING SPEED', icon: '⚡', weight: '20%', description: 'Rapid problem solving' },
            { key: 'codeQuality', label: 'CODE QUALITY', icon: '🎨', weight: '15%', description: 'Clean, readable code output' },
            { key: 'spec', label: 'SPEC COMPLIANCE', icon: '📋', weight: '10%', description: 'Following instructions precisely' },
            { key: 'recovery', label: 'DEEP REASONING', icon: '🧠', weight: '15%', description: 'Complex multi-step logic' },
            { key: 'correctness', label: 'PROBLEM SOLVING', icon: '🧩', weight: '10%', description: 'Breaking down complex issues' },
            { key: 'stability', label: 'CONTEXT UNDERSTANDING', icon: '🔗', weight: '5%', description: 'Grasping nuanced requirements' },
            { key: 'stability', label: 'OVERALL STABILITY', icon: '🔄', weight: 'Bonus', description: 'Consistent performance across all tasks' },
            { key: 'refusal', label: 'TASK ACCEPTANCE', icon: '🚫', weight: 'Bonus', description: 'Appropriate task engagement' }
          ]
        };

      case 'reasoning':
        return {
          title: '🎯 REASONING PERFORMANCE MATRIX',
          subtitle: 'Deep reasoning and complex problem-solving analysis',
          metrics: [
            { key: 'correctness', label: 'LOGICAL REASONING', icon: '🔬', weight: '25%', description: 'Multi-step logical deduction' },
            { key: 'spec', label: 'PROBLEM DECOMPOSITION', icon: '🧩', weight: '20%', description: 'Breaking down complex problems' },
            { key: 'codeQuality', label: 'CONTEXT SYNTHESIS', icon: '🔗', weight: '20%', description: 'Integrating information across contexts' },
            { key: 'recovery', label: 'ABSTRACT THINKING', icon: '💭', weight: '15%', description: 'High-level conceptual reasoning' },
            { key: 'stability', label: 'REASONING CONSISTENCY', icon: '⚖️', weight: '15%', description: 'Maintaining logical coherence' },
            { key: 'correctness', label: 'INFERENCE DEPTH', icon: '🕳️', weight: '5%', description: 'Drawing complex conclusions' }
          ]
        };

      case 'tooling':
        return {
          title: '🎯 TOOLING PERFORMANCE MATRIX',
          subtitle: 'Advanced tool usage and API interaction capabilities',
          metrics: [
            { key: 'correctness', label: 'TOOL SELECTION', icon: '🎯', weight: '20%', description: 'Choosing the right tool for each task' },
            { key: 'spec', label: 'PARAMETER ACCURACY', icon: '⚙️', weight: '20%', description: 'Providing correct tool parameters' },
            { key: 'correctness', label: 'TASK COMPLETION', icon: '✅', weight: '30%', description: 'Successfully completing tool-based objectives' },
            { key: 'recovery', label: 'ERROR HANDLING', icon: '🔧', weight: '15%', description: 'Recovering from tool execution failures' },
            { key: 'efficiency', label: 'TOOL EFFICIENCY', icon: '⚡', weight: '10%', description: 'Minimizing unnecessary tool calls' },
            { key: 'stability', label: 'CONTEXT AWARENESS', icon: '🧠', weight: '3%', description: 'Understanding when tools are needed' },
            { key: 'refusal', label: 'SAFETY COMPLIANCE', icon: '🛡️', weight: '2%', description: 'Following security and safety protocols' }
          ]
        };

      default:
        return {
          title: '🎯 PERFORMANCE OVERVIEW',
          subtitle: 'Current model performance metrics',
          metrics: [
            { key: 'correctness', label: 'CORRECTNESS', icon: '✅', weight: '35%', description: 'Code functionality and accuracy' },
            { key: 'spec', label: 'SPEC COMPLIANCE', icon: '📋', weight: '15%', description: 'Following instructions and format' },
            { key: 'codeQuality', label: 'CODE QUALITY', icon: '🎨', weight: '15%', description: 'Readability and best practices' },
            { key: 'efficiency', label: 'EFFICIENCY', icon: '⚡', weight: '10%', description: 'Response speed and optimization' }
          ]
        };
    }
  };

  const handleMouseEnter = () => {
    const timer = setTimeout(() => {
      setShowTooltip(true);
    }, 1500); // 1.5 second delay
    setHoverTimer(timer);
  };

  const handleMouseLeave = () => {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      setHoverTimer(null);
    }
    setShowTooltip(false);
  };

  useEffect(() => {
    return () => {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
      }
    };
  }, [hoverTimer]);

  const tooltipContent = getTooltipContent();

  return (
    <div 
      style={{ position: 'relative', display: 'block' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      {showTooltip && tooltipContent && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            backgroundColor: 'var(--terminal-black)',
            border: '2px solid var(--phosphor-green)',
            borderRadius: '4px',
            padding: '12px',
            minWidth: '320px',
            maxWidth: '400px',
            boxShadow: '0 4px 12px rgba(0, 255, 65, 0.3)',
            fontSize: '0.75em',
            lineHeight: '1.3',
            marginTop: '8px',
            animation: 'fadeIn 0.2s ease-in'
          }}
          className="terminal-text"
        >
          {/* Header */}
          <div style={{ marginBottom: '8px', textAlign: 'center' }}>
            <div className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold' }}>
              {tooltipContent.title}
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
              {tooltipContent.subtitle}
            </div>
          </div>

          {/* Metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {tooltipContent.metrics.slice(0, 7).map((metric, index) => {
              const axes = model.latestScore?.axes || model.axes || {};
              const value = axes[metric.key] || 0;
              const percentage = typeof value === 'number' ? Math.round(value * 100) : Math.round(parseFloat(value) * 100) || 0;
              const tier = getTier(percentage);
              const tierColor = getTierColor(percentage);

              return (
                <div key={index} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '2px 0',
                  borderBottom: index < tooltipContent.metrics.length - 1 ? '1px solid rgba(0, 255, 65, 0.1)' : 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <span style={{ fontSize: '0.9em' }}>{metric.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.8em', fontWeight: 'bold' }}>
                        {metric.label}
                      </div>
                      <div className="terminal-text--dim" style={{ fontSize: '0.7em' }}>
                        ({metric.weight}) {metric.description}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: '60px' }}>
                    <div className={tierColor} style={{ fontSize: '0.9em', fontWeight: 'bold' }}>
                      {percentage}%
                    </div>
                    <div className={tierColor} style={{ fontSize: '0.7em' }}>
                      {tier}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Arrow pointing up */}
          <div
            style={{
              position: 'absolute',
              top: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '0',
              height: '0',
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderBottom: '6px solid var(--phosphor-green)'
            }}
          />
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-5px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ModelTooltip;
