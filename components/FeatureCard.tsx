interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  details?: string[];
  highlight?: boolean;
  delay?: number;
}

export default function FeatureCard({ 
  icon, 
  title, 
  description, 
  details = [], 
  highlight = false,
  delay = 0 
}: FeatureCardProps) {
  return (
    <div 
      className={`feature-card ${highlight ? 'feature-card--highlight' : ''}`}
      style={{
        animationDelay: `${delay}ms`,
        border: highlight ? '2px solid var(--phosphor-green)' : '1px solid rgba(0, 255, 65, 0.3)',
        backgroundColor: highlight ? 'rgba(0, 255, 65, 0.1)' : 'rgba(0, 255, 65, 0.05)',
        padding: '20px',
        borderRadius: '6px',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        animation: 'fadeInUp 0.6s ease forwards',
        opacity: 0,
        transform: 'translateY(20px)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 255, 65, 0.3)';
        e.currentTarget.style.borderColor = 'var(--phosphor-green)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = highlight ? 'var(--phosphor-green)' : 'rgba(0, 255, 65, 0.3)';
      }}
    >
      {/* Scan line effect */}
      <div 
        className="scan-line"
        style={{
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '100%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--phosphor-green), transparent)',
          animation: 'scanLine 3s infinite',
          opacity: 0
        }}
      />
      
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div 
          style={{ 
            fontSize: '2.5em', 
            marginBottom: '8px',
            filter: 'drop-shadow(0 0 8px var(--phosphor-green))',
            animation: highlight ? 'pulse 2s infinite' : 'none'
          }}
        >
          {icon}
        </div>
        <h3 
          className="terminal-text--green" 
          style={{ 
            fontSize: '1.2em', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            textShadow: '0 0 10px var(--phosphor-green)'
          }}
        >
          {title}
        </h3>
      </div>
      
      <div className="terminal-text--dim" style={{ fontSize: '0.9em', lineHeight: '1.5', marginBottom: '12px' }}>
        {description}
      </div>
      
      {details.length > 0 && (
        <div style={{ fontSize: '0.8em' }}>
          {details.map((detail, index) => (
            <div key={index} className="terminal-text--dim" style={{ marginBottom: '4px' }}>
              <span className="terminal-text--green">▸</span> {detail}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeInUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes scanLine {
          0% { left: -100%; opacity: 0; }
          50% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        .feature-card:hover .scan-line {
          animation: scanLine 1s ease-in-out;
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
