'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type ConversionContext = 'degradation' | 'price' | 'return-visit' | 'engaged' | 'default';

interface SmartConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  context?: ConversionContext;
}

export default function SmartConversionModal({ isOpen, onClose, context = 'default' }: SmartConversionModalProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    }
  }, [isOpen]);

  if (!isOpen || !isVisible) return null;

  const handleStartTrial = () => {
    router.push('/api/stripe/checkout');
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), 300);
  };

  // Context-aware content
  const getContent = () => {
    switch (context) {
      case 'degradation':
        return {
          icon: '🚨',
          title: 'STOP USING DEGRADED MODELS',
          subtitle: 'You just saw a model degrade in real-time',
          benefits: [
            'Automatic failover when models degrade',
            'Never use a degraded model again',
            'Real-time alerts before performance drops',
            'Save 50-70% by avoiding expensive failures'
          ],
          cta: 'PROTECT YOUR AI STACK NOW'
        };
      
      case 'price':
        return {
          icon: '💰',
          title: 'STOP OVERPAYING FOR AI',
          subtitle: 'You\'re comparing prices manually - let us automate it',
          benefits: [
            'Auto-route to cheapest model that meets quality',
            'Save 50-70% on AI costs automatically',
            'One API key for all providers',
            'Real-time cost optimization'
          ],
          cta: 'START SAVING MONEY NOW'
        };
      
      case 'return-visit':
        return {
          icon: '👋',
          title: 'WELCOME BACK!',
          subtitle: 'Ready to automate your AI model selection?',
          benefits: [
            'You\'ve seen how models degrade',
            'You\'ve compared the performance data',
            'Now let AI Router Pro do this for you',
            '7-day free trial • Cancel anytime'
          ],
          cta: 'TRY PRO FREE FOR 7 DAYS'
        };
      
      case 'engaged':
        return {
          icon: '⚡',
          title: 'YOU\'RE TRACKING MODELS MANUALLY',
          subtitle: 'Spent 3+ minutes checking rankings? Automate it.',
          benefits: [
            'Stop manually checking model rankings',
            'Automatic routing based on real-time data',
            'Never miss a degradation alert',
            'One API key replaces all your keys'
          ],
          cta: 'AUTOMATE YOUR WORKFLOW'
        };
      
      default:
        return {
          icon: '🚀',
          title: 'THE ONLY AI ROUTER WITH REAL INTELLIGENCE',
          subtitle: 'Other routers guess. We know.',
          benefits: [
            'Based on 171+ live benchmarks',
            'Detects degradation before it costs you',
            'Saves 50-70% on AI costs',
            'World\'s first intelligence-based router'
          ],
          cta: 'START FREE TRIAL'
        };
    }
  };

  const content = getContent();

  return (
    <div
      className="pro-modal"
      onClick={handleClose}
    >
      <div
        className="pro-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button className="pro-modal-close" onClick={handleClose} aria-label="Close">×</button>

        {/* Badge with icon */}
        <span className="pro-modal-badge">{content.icon} PRO</span>

        {/* Title & subtitle */}
        <div className="pro-modal-title">{content.title}</div>
        <div className="pro-modal-sub">{content.subtitle}</div>

        {/* Benefits */}
        <ul className="pro-modal-features">
          {content.benefits.map((benefit, index) => (
            <li key={index}>
              <span className="pro-modal-check">✓</span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        {/* Pricing */}
        <div className="pro-modal-pricebox">
          <div className="pro-modal-price">
            <s>$49.99</s>
            <b>$4.99</b>
            <span>/month</span>
          </div>
          <div className="pro-modal-priceline">7-day free trial · cancel anytime</div>
        </div>

        {/* Actions */}
        <div className="pro-modal-actions">
          <button className="pro-modal-btn primary" onClick={handleStartTrial}>
            {content.cta} →
          </button>
          <button className="pro-modal-btn ghost" onClick={handleClose}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
