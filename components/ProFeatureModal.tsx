'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface ProFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: 'historical-data' | 'performance-matrix' | 'api-monitoring' | 'drift-cusum';
}

export default function ProFeatureModal({ isOpen, onClose, feature }: ProFeatureModalProps) {
  const router = useRouter();
  const { data: session } = useSession();

  if (!isOpen) return null;

  const featureDetails = {
    'historical-data': {
      title: 'Unlock historical trends',
      description: 'Compare every model over 24 hours, 7 days and 30 days — so you catch quiet regressions before they reach your users.',
      benefits: [
        '24-hour, 7-day and 30-day performance history',
        'Per-model trend lines and drift detection',
        'Confidence intervals on every score',
        'Spot degradations days before anyone else',
      ],
    },
    'performance-matrix': {
      title: 'Unlock the full performance matrix',
      description: 'Go beyond the combined score and see how each model performs on every benchmark dimension.',
      benefits: [
        'Full 7-axis performance breakdown',
        'Deep-reasoning benchmark suite',
        'Tool-calling reliability metrics',
        'Coding, speed and cost-efficiency views',
      ],
    },
    'drift-cusum': {
      title: 'Unlock drift detection',
      description: 'See the full Page-Hinkley CUSUM curve behind every drift alert — the running evidence that a model has quietly changed.',
      benefits: [
        'Historical CUSUM curve for every tracked model',
        'Change-points marked on the exact day they were detected',
        'The alert threshold plotted alongside the statistic',
        'Read a degradation building before it trips an alert',
      ],
    },
    'api-monitoring': {
      title: 'Unlock API monitoring',
      description: 'One dashboard for every request across all your provider keys — usage, cost, prompts and budgets.',
      benefits: [
        'Per-key request logs with model, cost & latency',
        'Cost dashboard with daily spend trends',
        'Prompt auditing with automatic secret scrubbing',
        'Budget limits with threshold alerts',
      ],
    },
  };

  const details = featureDetails[feature];

  const handleUpgrade = () => {
    router.push(session ? '/router/subscription' : '/auth/signup');
  };

  return (
    <div className="pro-modal" onClick={onClose}>
      <div className="pro-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="pro-modal-close" onClick={onClose} aria-label="Close">×</button>

        <span className="pro-modal-badge">◆ PRO feature</span>
        <div className="pro-modal-title">{details.title}</div>
        <div className="pro-modal-sub">{details.description}</div>

        <ul className="pro-modal-features">
          {details.benefits.map((benefit, i) => (
            <li key={i}>
              <span className="pro-modal-check">✓</span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <div className="pro-modal-pricebox">
          <div className="pro-modal-price"><b>$4.99</b><span>/month</span></div>
          <div className="pro-modal-priceline">7-day free trial · cancel anytime · no card surprises</div>
        </div>

        <div className="pro-modal-actions">
          <button className="pro-modal-btn primary" onClick={handleUpgrade}>
            {session ? 'Start your free trial' : 'Start 7-day free trial'}
          </button>
          {!session && (
            <button className="pro-modal-btn ghost" onClick={() => router.push('/auth/signin')}>
              I already have an account
            </button>
          )}
          <button className="pro-modal-btn ghost" onClick={onClose}>Maybe later</button>
        </div>
      </div>
    </div>
  );
}
