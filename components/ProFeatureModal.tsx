'use client';

import { ENTRY_PAID_PLAN, ROUTER_PLAN, planName, monthly } from '@/lib/pricing-display';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { checkoutHref } from '@/lib/checkout-url';
import { withReturn } from '@/lib/return-path';
import Modal from './studio/Modal';
import '../styles/studio-board.css';

/** The tick on each benefit line, as on the studio upgrade gate. */
function Tick() {
  return (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 9.5l3.4 3.4L14.5 5.3" />
    </svg>
  );
}

interface ProFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: 'historical-data' | 'performance-matrix' | 'api-monitoring' | 'drift-cusum' | 'calibration' | 'substitutes' | 'context-rot' | 'latest-scores' | 'board-insights';
}

export default function ProFeatureModal({ isOpen, onClose, feature }: ProFeatureModalProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const featureDetails = {
    'board-insights': {
      title: 'Unlock the full leaderboard analysis',
      description: 'Your free account shows every ranking over the last 24 hours, 7 days and 30 days. Pro adds the analysis around them: which models have quietly changed, which one to pick for each job, and what each one gives you for the money.',
      benefits: [
        'The drift monitor: every model compared with its own past runs',
        'Quick answers: the best model for code, the most reliable, the fastest and the best value',
        'The benchmark heatmap and performance radar: every model on every measure',
        'Price-performance: how much score each model gives you per dollar',
        'Plus the Latest scores, full history, calibration and cheaper-substitute analysis',
      ],
    },
    'latest-scores': {
      title: 'See the latest scores, as they land',
      description: 'Your free account shows each model’s averages over the last 24 hours, 7 days and 30 days. Pro shows the newest benchmark run the moment it finishes — the number to check before you deploy, switch models or chase a regression.',
      benefits: [
        'The newest score for every model, refreshed after each benchmark run',
        'Coding runs every 4 hours; reasoning and tool use daily',
        'The Latest view on the leaderboard and on every model page',
        'Plus full history, the full performance matrix and drift curves',
      ],
    },
    'historical-data': {
      title: 'Unlock full history',
      description: 'Every account sees 24-hour, 7-day and 30-day views. Pro keeps every measurement we hold — so a slow decline over months shows, not just this month.',
      benefits: [
        'Every measurement we hold, not just the last 30 days',
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
    calibration: {
      title: 'Unlock calibration and known-unknowns',
      description: 'Every other score on the site asks whether a model can do the task. This one asks whether it knows when it cannot — and whether the confidence it states means anything.',
      benefits: [
        'Fabrication rate: how often it answers a question that has no answer',
        'Expected Calibration Error — does a stated 90% actually come out right 90% of the time',
        'Abstention behaviour on non-existent entities, withheld details and unobservable facts',
        'Per-question detail, so you can see what produced the number',
      ],
    },
    substitutes: {
      title: 'Unlock substitution analysis',
      description: 'The board tells you what each model scores and what it costs. This tells you what actually happens if you switch to the cheaper one.',
      benefits: [
        'For every cheaper model: the measured share of working requests it would fail',
        'Read from per-trial outcomes, not run verdicts — a verdict is a median of seven and hides what one request sees',
        'A range across every possible dependence, so the estimate is bounded rather than assumed',
        'The reverse too: how much of what this model drops, the cheaper one completes',
      ],
    },
    'context-rot': {
      title: 'Unlock context rot (pilot)',
      description: 'A context window is what a model accepts, not what it can use. This measures how far its answers hold up as the document grows.',
      benefits: [
        'Accuracy at each length from 8K to 1M tokens, measured weekly',
        'What breaks first: finding a fact, linking facts, tracking updates or counting',
        'Where in the document facts get lost, by position and length',
        'Pilot: DeepSeek, Kimi and GLM models for now; more providers will follow',
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
   * Four of the five are analytics and come with Pro. API monitoring is a
   * routing surface and does not — telling someone $9 buys it would be a
   * promise the checkout could not keep.
   */
  const unlockedBy = feature === 'api-monitoring' ? ROUTER_PLAN : ENTRY_PAID_PLAN;

  // Straight to Stripe for the plan quoted below, with its free trial, rather than via /pricing:
  // the button says "Start your free trial", so it starts one. `from` records which locked feature
  // sold it (activation_events detail). Without an account, sign-up comes first and then continues
  // to the same checkout (lib/return-path).
  const sellable = unlockedBy === 'pro' || unlockedBy === 'developer' || unlockedBy === 'teams';
  const trialHref = sellable ? `${checkoutHref(unlockedBy, 'monthly')}&from=${feature}` : '/pricing';
  const handleUpgrade = () => {
    if (!session) { router.push(withReturn('/auth/signup', trialHref)); return; }
    // A full navigation: the route answers with a redirect to Stripe, not a page.
    window.location.href = trialHref;
  };

  // The studio dialog (components/studio Modal): Escape and the backdrop close it, focus moves in
  // and back, and on phones it is a bottom sheet. It portals into the page's .st wrapper, so the
  // model pages, which render this outside their StudioPage, get the same look.
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="narrow"
      title={details.title}
      footer={
        <div className="sb-pf-foot">
          <button type="button" className="st-btn is-quiet sb-pf-later" onClick={onClose}>Maybe later</button>
          {!session && (
            <button type="button" className="st-btn" onClick={() => router.push('/auth/signin')}>
              I already have an account
            </button>
          )}
          <button type="button" className="st-btn is-primary" onClick={handleUpgrade}>
            {session ? 'Start your free trial' : 'Start your free trial'} <span className="st-ar" aria-hidden="true">→</span>
          </button>
        </div>
      }
    >
      <div className="sb-pf">
        <p className="st-kicker">Pro feature</p>
        <p className="sb-pf-lead">{details.description}</p>

        <ul className="sb-pf-list">
          {details.benefits.map((benefit, i) => (
            <li key={i}>
              <Tick />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <div className="sb-pf-price">
          <b>{monthly(unlockedBy)}<span>{planName(unlockedBy)}</span></b>
          <small>Free trial · cancel anytime · a card is collected at checkout</small>
        </div>
        <Link href="/pricing" className="st-more sb-pf-compare" onClick={onClose}>Compare all plans</Link>
      </div>
    </Modal>
  );
}
