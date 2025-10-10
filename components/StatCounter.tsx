'use client';

import { useState, useEffect } from 'react';

interface StatCounterProps {
  value: number;
  label: string;
  suffix?: string;
  prefix?: string;
  duration?: number;
  delay?: number;
  color?: 'green' | 'amber' | 'red' | 'blue';
  icon?: string;
}

export default function StatCounter({ 
  value, 
  label, 
  suffix = '', 
  prefix = '',
  duration = 2000,
  delay = 0,
  color = 'green',
  icon = ''
}: StatCounterProps) {
  const [currentValue, setCurrentValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
      
      const startTime = Date.now();
      const startValue = 0;
      const endValue = value;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const animatedValue = Math.floor(startValue + (endValue - startValue) * easeOutQuart);
        
        setCurrentValue(animatedValue);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      animate();
    }, delay);

    return () => clearTimeout(timer);
  }, [value, duration, delay]);

  const getColorClass = () => {
    switch (color) {
      case 'green': return 'terminal-text--green';
      case 'amber': return 'terminal-text--amber';
      case 'red': return 'terminal-text--red';
      case 'blue': return 'terminal-text';
      default: return 'terminal-text--green';
    }
  };

  const getGlowColor = () => {
    switch (color) {
      case 'green': return 'var(--phosphor-green)';
      case 'amber': return 'var(--amber-warning)';
      case 'red': return 'var(--red-alert)';
      case 'blue': return '#00bfff';
      default: return 'var(--phosphor-green)';
    }
  };

  return (
    <div 
      className="stat-counter"
      style={{
        textAlign: 'center',
        padding: '20px',
        border: `2px solid ${getGlowColor()}`,
        borderRadius: '8px',
        backgroundColor: `${getGlowColor()}10`,
        position: 'relative',
        overflow: 'hidden',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.6s ease',
        boxShadow: isVisible ? `0 0 20px ${getGlowColor()}40` : 'none'
      }}
    >
      {/* Animated background pulse */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at center, ${getGlowColor()}20 0%, transparent 70%)`,
          animation: isVisible ? 'pulse 3s ease-in-out infinite' : 'none',
          opacity: 0.5
        }}
      />
      
      {/* Icon */}
      {icon && (
        <div 
          style={{ 
            fontSize: '2em', 
            marginBottom: '8px',
            filter: `drop-shadow(0 0 8px ${getGlowColor()})`
          }}
        >
          {icon}
        </div>
      )}
      
      {/* Counter Value */}
      <div 
        className={getColorClass()}
        style={{ 
          fontSize: '2.5em', 
          fontWeight: 'bold', 
          marginBottom: '8px',
          fontFamily: 'var(--font-mono)',
          textShadow: `0 0 15px ${getGlowColor()}`,
          position: 'relative',
          zIndex: 1
        }}
      >
        {prefix}{currentValue.toLocaleString()}{suffix}
      </div>
      
      {/* Label */}
      <div 
        className="terminal-text--dim" 
        style={{ 
          fontSize: '0.9em', 
          fontWeight: 'bold',
          letterSpacing: '1px',
          position: 'relative',
          zIndex: 1
        }}
      >
        {label}
      </div>

      {/* Blinking LED indicator */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: getGlowColor(),
          animation: isVisible ? 'blink 2s infinite' : 'none',
          boxShadow: `0 0 10px ${getGlowColor()}`
        }}
      />

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
