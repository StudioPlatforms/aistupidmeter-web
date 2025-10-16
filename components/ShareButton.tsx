'use client';

import { useState } from 'react';
import { RetroIcons } from '../lib/retro-icons';
import PixelIcon from './PixelIcon';

interface ShareButtonProps {
  type?: 'rankings' | 'alert' | 'index' | 'winner';
  data?: any;
}

export default function ShareButton({ type = 'rankings', data }: ShareButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const getShareText = () => {
    // Get current date and time in UTC
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      timeZone: 'UTC'
    });
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true,
      timeZone: 'UTC'
    });
    const timestamp = `${dateStr} at ${timeStr} UTC`;
    
    switch (type) {
      case 'rankings':
        if (data?.modelScores && data.modelScores.length >= 3) {
          return `${RetroIcons.trophy} AI Model Rankings - Live Performance Scores:\n\n${RetroIcons.one} ${data.modelScores[0].name.toUpperCase()} - ${data.modelScores[0].currentScore} pts\n${RetroIcons.two} ${data.modelScores[1].name.toUpperCase()} - ${data.modelScores[1].currentScore} pts\n${RetroIcons.three} ${data.modelScores[2].name.toUpperCase()} - ${data.modelScores[2].currentScore} pts\n\nReal-time AI intelligence monitoring\nUpdated: ${timestamp}`;
        }
        return `${RetroIcons.trophy} Latest AI model rankings - Track GPT, Claude, Grok & Gemini performance\nUpdated: ${timestamp}`;
      
      case 'alert':
        if (data?.model) {
          return `${RetroIcons.warning} ALERT: ${data.model.name.toUpperCase()} degraded ${data.dropPercentage}%\n\nCurrent: ${data.model.currentScore}/100\n\nReal-time AI performance tracking\nUpdated: ${timestamp}`;
        }
        return `${RetroIcons.warning} AI model degradation detected - Real-time monitoring\nUpdated: ${timestamp}`;
      
      case 'index':
        if (data?.globalIndex) {
          const score = data.globalIndex.current.globalScore;
          const status = score >= 70 ? 'STRONG' : score >= 50 ? 'MODERATE' : 'WEAK';
          const icon = score >= 70 ? RetroIcons.success : score >= 50 ? RetroIcons.warning : RetroIcons.error;
          return `${RetroIcons.chart} 24-Hour AI Stupidity Index\n\nGlobal Score: ${score}/100\nStatus: ${icon} ${status}\n\nTrack AI intelligence trends\nUpdated: ${timestamp}`;
        }
        return `${RetroIcons.chart} Global AI intelligence index - Real-time monitoring\nUpdated: ${timestamp}`;
      
      case 'winner':
        if (data?.topModel) {
          return `${RetroIcons.crown} TOP PERFORMER: ${data.topModel.name.toUpperCase()}\n\nScore: ${data.topModel.currentScore}/100\n\nCompare all AI models\nUpdated: ${timestamp}`;
        }
        return `${RetroIcons.crown} See which AI model is leading - Live rankings\nUpdated: ${timestamp}`;
      
      default:
        return `${RetroIcons.chart} Real-time AI model performance monitoring - Track GPT, Claude, Grok & Gemini\nUpdated: ${timestamp}`;
    }
  };

  const getShareUrl = () => {
    const baseUrl = 'https://aistupidlevel.info';
    switch (type) {
      case 'alert':
        return data?.model ? `${baseUrl}/models/${data.model.id}` : baseUrl;
      case 'index':
        return `${baseUrl}#stupidity-index`;
      case 'winner':
        return data?.topModel ? `${baseUrl}/models/${data.topModel.id}` : baseUrl;
      default:
        return baseUrl;
    }
  };

  const shareText = getShareText();
  const shareUrl = getShareUrl();

  const handleTwitterShare = () => {
    // Use dedicated share page with dynamic OG meta tags
    const sharePageUrl = `https://aistupidlevel.info/share/${type}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(sharePageUrl)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };

  const handleLinkedInShare = () => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(linkedInUrl, '_blank', 'width=550,height=420');
  };

  const handleRedditShare = () => {
    const redditUrl = `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`;
    window.open(redditUrl, '_blank', 'width=550,height=420');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <>
      {/* Floating Share Button - Positioned above mobile nav */}
      <button
        onClick={() => setShowModal(true)}
        className="vintage-btn share-button-floating"
        aria-label="Share"
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <PixelIcon name="share" size={16} />
        <span className="share-text-desktop">SHARE</span>
      </button>

      {/* Share Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="crt-monitor"
            style={{
              maxWidth: '500px',
              width: '100%',
              padding: '24px',
              backgroundColor: 'var(--terminal-black)',
              border: '2px solid var(--phosphor-green)',
              borderRadius: '6px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="terminal-text">
              <div style={{ fontSize: '1.3em', marginBottom: '16px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <PixelIcon name="share" size={24} />
                <span className="terminal-text--green">SHARE THIS</span>
                <span className="blinking-cursor"></span>
              </div>

              {/* Preview Text */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: 'rgba(0, 255, 65, 0.05)',
                  border: '1px solid rgba(0, 255, 65, 0.2)',
                  borderRadius: '4px',
                  marginBottom: '20px',
                  fontSize: '0.85em',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--font-mono)'
                }}
                className="terminal-text--dim"
              >
                {shareText}
              </div>

              {/* Share Buttons */}
              <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
                <button
                  onClick={handleTwitterShare}
                  className="vintage-btn"
                  style={{
                    padding: '12px',
                    fontSize: '1em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <PixelIcon name="twitter" size={20} />
                  Share on X (Twitter)
                </button>

                <button
                  onClick={handleLinkedInShare}
                  className="vintage-btn"
                  style={{
                    padding: '12px',
                    fontSize: '1em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <PixelIcon name="linkedin" size={20} />
                  Share on LinkedIn
                </button>

                <button
                  onClick={handleRedditShare}
                  className="vintage-btn"
                  style={{
                    padding: '12px',
                    fontSize: '1em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <PixelIcon name="reddit" size={20} />
                  Share on Reddit
                </button>

                <button
                  onClick={handleCopyLink}
                  className={`vintage-btn ${copied ? 'vintage-btn--active' : ''}`}
                  style={{
                    padding: '12px',
                    fontSize: '1em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <PixelIcon name={copied ? 'check' : 'copy'} size={20} />
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>

              {/* Close Button */}
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => setShowModal(false)}
                  className="vintage-btn"
                  style={{ padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', margin: '0 auto' }}
                >
                  <PixelIcon name="close" size={16} />
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </>
  );
}
