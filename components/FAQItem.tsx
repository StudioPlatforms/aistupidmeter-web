'use client';

import { useState } from 'react';

interface FAQItemProps {
  question: string;
  answer: string;
  category: string;
  isPopular?: boolean;
  isTechnical?: boolean;
  delay?: number;
}

export default function FAQItem({ 
  question, 
  answer, 
  category, 
  isPopular = false, 
  isTechnical = false,
  delay = 0 
}: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'methodology': return '#1a73e8';
      case 'technical': return '#ffb000';
      case 'privacy': return '#d93025';
      case 'general': return '#1a73e8';
      default: return '#ffffff';
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'methodology': return '🔬';
      case 'technical': return '⚙️';
      case 'privacy': return '🛡️';
      case 'general': return '❓';
      default: return '📋';
    }
  };

  return (
    <div 
      className="faq-item"
      style={{
        animationDelay: `${delay}ms`,
        border: '1px solid rgba(26, 115, 232, 0.3)',
        backgroundColor: isOpen ? 'rgba(26, 115, 232, 0.08)' : 'rgba(26, 115, 232, 0.03)',
        borderRadius: '6px',
        marginBottom: '12px',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        animation: 'fadeInUp 0.6s ease forwards',
        opacity: 0,
        transform: 'translateY(20px)',
        cursor: 'pointer'
      }}
      onClick={() => setIsOpen(!isOpen)}
      onMouseEnter={(e) => {
        if (!isOpen) {
          e.currentTarget.style.backgroundColor = 'rgba(26, 115, 232, 0.06)';
          e.currentTarget.style.borderColor = 'var(--phosphor-green)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isOpen) {
          e.currentTarget.style.backgroundColor = 'rgba(26, 115, 232, 0.03)';
          e.currentTarget.style.borderColor = 'rgba(26, 115, 232, 0.3)';
        }
      }}
    >
      {/* Question Header */}
      <div 
        style={{ 
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          {/* Category Badge */}
          <div
            style={{
              backgroundColor: getCategoryColor(category),
              color: 'var(--terminal-black)',
              fontSize: '0.7em',
              fontWeight: 'bold',
              padding: '4px 8px',
              borderRadius: '3px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              minWidth: 'fit-content'
            }}
          >
            <span>{getCategoryIcon(category)}</span>
            {category.toUpperCase()}
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {isPopular && (
              <span
                style={{
                  backgroundColor: 'var(--amber-warning)',
                  color: 'var(--terminal-black)',
                  fontSize: '0.6em',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: '2px'
                }}
              >
                POPULAR
              </span>
            )}
            {isTechnical && (
              <span
                style={{
                  backgroundColor: 'var(--red-alert)',
                  color: 'var(--terminal-black)',
                  fontSize: '0.6em',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: '2px'
                }}
              >
                TECHNICAL
              </span>
            )}
          </div>
        </div>

        {/* Expand/Collapse Arrow */}
        <div
          style={{
            fontSize: '1.2em',
            color: 'var(--phosphor-green)',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease',
            minWidth: '20px',
            textAlign: 'center'
          }}
        >
          ▶
        </div>
      </div>

      {/* Question */}
      <div 
        style={{ 
          padding: '0 20px 16px 20px',
          fontSize: '1.1em',
          fontWeight: 'bold'
        }}
        className="terminal-text--green"
      >
        Q: {question}
      </div>

      {/* Answer (Collapsible) */}
      <div
        style={{
          maxHeight: isOpen ? '1000px' : '0',
          overflow: 'hidden',
          transition: 'max-height 0.4s ease',
          borderTop: isOpen ? '1px solid rgba(26, 115, 232, 0.2)' : 'none'
        }}
      >
        <div 
          style={{ 
            padding: '16px 20px',
            fontSize: '0.95em',
            lineHeight: '1.6',
            backgroundColor: 'rgba(0,0,0,0.04)'
          }}
          className="terminal-text--dim"
          dangerouslySetInnerHTML={{ 
            __html: answer.replace(/\*\*(.*?)\*\*/g, '<strong class="terminal-text--green">$1</strong>')
                          .replace(/`(.*?)`/g, '<code style="background: rgba(26, 115, 232,0.1); padding: 2px 4px; border-radius: 2px; font-family: var(--font-mono);">$1</code>')
          }}
        />
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .faq-item:hover {
          box-shadow: 0 4px 15px rgba(26, 115, 232, 0.2);
        }
      `}</style>
    </div>
  );
}
