'use client';

import { ENTRY_PAID_PLAN, ROUTER_PLAN, planName, monthly } from '@/lib/pricing-display';

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
        'Full 9-axis performance breakdown',
        'Deep-reasoning benchmark suite',
        'Tool-calling reliability metrics',
        'Coding, speed and cost-efficiency views',
      ],
    },
    'drift-cusum': {
      title: 'Unlock drift detection',
      description: 'See the full Page-Hinkley curve behind every drift alert — the running evidence that a model has quietly changed — one curve per suite.',
      benefits: [
        'Three curves per model: coding, tool use and reasoning, never blended',
        'Detections marked on the exact day they fired, with warm-up and re-arm windows shown',
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

  /**
   * Quote the cheapest plan that actually unlocks THIS feature.
   *
   * Three of the four are analytics and come with Pro. API monitoring is a
   * routing surface and does not — telling someone $9 buys it would be a
   * promise the checkout could not keep.
   */
  const unlockedBy = feature === 'api-monitoring' ? ROUTER_PLAN : ENTRY_PAID_PLAN;

  const handleUpgrade = () => {
    router.push(session ? '/pricing' : '/auth/signup');
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
          <div className="pro-modal-price"><b>{monthly(unlockedBy)}</b><span> · {planName(unlockedBy)}</span></div>
          <div className="pro-modal-priceline">Free trial · cancel anytime · a card is collected at checkout</div>
        </div>

        <div className="pro-modal-actions">
          <button className="pro-modal-btn primary" onClick={handleUpgrade}>
            {session ? 'Start your free trial' : 'Start your free trial'}
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
