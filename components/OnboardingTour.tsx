'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export const ONBOARDING_STORAGE_KEY = 'stupidmeter-onboarding-seen';

/**
 * First-visit explainer for the dashboard.
 *
 * The single most common misreading of this site is treating it as a "which AI is
 * smartest" leaderboard. It isn't - it's a consistency tracker. These six cards say that
 * in plain language and then describe, without jargon, how each suite actually works, so a
 * non-technical visitor can read the leaderboard correctly.
 *
 * Shown once per browser. Skipping counts as seen: nobody should meet this twice.
 */

interface Step {
  eyebrow: string;
  title: string;
  body: string[];
  icon: JSX.Element;
}

const ICON = {
  board: (
    <>
      <path d="M4 20V10M10 20V5M16 20v-8M22 20H2" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="5" r="1.7" fill="currentColor" />
    </>
  ),
  pulse: (
    <path d="M2 12h4l2.5-7 4 14L15 12h5" fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" />
  ),
  code: (
    <>
      <path d="M8 8l-4 4 4 4M16 8l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 5l-3 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  steps: (
    <>
      <path d="M4 18h4v-4h4v-4h4V6h4" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="1.6" fill="currentColor" />
      <circle cx="18" cy="6" r="1.6" fill="currentColor" />
    </>
  ),
  tool: (
    <path d="M14.5 6.5a3.5 3.5 0 0 0 4.6 4.6L21 13l-8 8-2-2 1.9-1.9a3.5 3.5 0 0 0-4.6-4.6L6.5 14.5 4 12l8-8z"
          fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  ),
  gauge: (
    <>
      <path d="M4 17a8 8 0 1 1 16 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 17l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.6" fill="currentColor" />
    </>
  ),
};

const STEPS: Step[] = [
  {
    eyebrow: 'What this is',
    title: "Not a “which AI is best” chart",
    body: [
      'AI Stupid Level tracks something different: which models stay consistent.',
      'The model you relied on last month can quietly get worse - sloppier code, slower answers, more instructions ignored - and providers rarely announce it. We run identical tests around the clock and show you who holds steady.',
    ],
    icon: ICON.pulse,
  },
  {
    eyebrow: 'Coding',
    title: 'We test code by running it',
    body: [
      'Every few hours, each model gets the same set of programming problems.',
      'We don’t judge the answer by reading it. We execute it, feed it the awkward inputs people forget about, and check it still works. We also look at whether the code is tidy and how long the model took.',
    ],
    icon: ICON.code,
  },
  {
    eyebrow: 'Reasoning',
    title: 'We test thinking across several turns',
    body: [
      'Real work is never one question.',
      'We drop each model into a debugging session: find the bug, fix it, read the real test output, then handle the next problem - while remembering what it already changed. Models that ace quick questions often come apart here.',
    ],
    icon: ICON.steps,
  },
  {
    eyebrow: 'Tool use',
    title: 'We give it a real machine to work on',
    body: [
      'Modern assistants are expected to actually do things - open files, run commands, look around a folder.',
      'Each model gets a locked-down sandbox and a job to finish. Either the job is done at the end or it isn’t. There’s no credit for sounding confident.',
    ],
    icon: ICON.tool,
  },
  {
    eyebrow: 'The score',
    title: 'One number, plus a watch for drift',
    body: [
      'Those results roll into a single 0–100 score for each model.',
      'Separately, we compare every model against its own past. A sustained, statistically real drop raises a drift alert - the thing you can never see from a launch-day benchmark. A brand-new model needs about 10 days of history before that baseline means anything.',
    ],
    icon: ICON.gauge,
  },
  {
    eyebrow: 'The leaderboard',
    title: 'What the top of the list means',
    body: [
      'The model in first place is not "the smartest AI". It is the one that came out best across those three suites in the most recent runs, and stayed steady while doing it.',
      'Positions move. Everything is re-tested every few hours, so today\u2019s #1 can sit at #4 tomorrow without anything dramatic happening - the gap between neighbours is often a point or two. Read the direction of a model\u2019s line before you read its rank, and click any row for the full history.',
    ],
    icon: ICON.board,
  },
];

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingTour({ isOpen, onClose }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  // Which way the next card should slide in from. Purely presentational.
  const [direction, setDirection] = useState<'fwd' | 'back'>('fwd');

  const goTo = useCallback((next: number) => {
    setDirection((prev) => (next >= 0 ? (next > stepRef.current ? 'fwd' : 'back') : prev));
    setStep(next);
  }, []);
  const stepRef = useRef(0);
  useEffect(() => { stepRef.current = step; }, [step]);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch {
      /* private mode — worst case they see it again */
    }
    onClose();
  }, [onClose]);

  // Reset to the first card whenever it is reopened.
  useEffect(() => {
    if (isOpen) { setStep(0); setDirection('fwd'); }
  }, [isOpen]);

  // Escape skips; arrows move between cards.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') goTo(Math.min(stepRef.current + 1, STEPS.length - 1));
      else if (e.key === 'ArrowLeft') goTo(Math.max(stepRef.current - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, finish, goTo]);

  // Don't let the page behind scroll while the card is up (matters most on phones).
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="pro-modal onb" onClick={finish}>
      <div
        className="pro-modal-card onb-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onb-title"
      >
        <div className="onb-head" key={`head-${step}`}>
          <span className="onb-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20">{current.icon}</svg>
          </span>
          <span className="pro-modal-badge">{current.eyebrow}</span>
        </div>

        <div className={`onb-slide onb-slide--${direction}`} key={step}>
          <div className="pro-modal-title onb-title" id="onb-title">{current.title}</div>
          {current.body.map((paragraph, i) => (
            <p className="pro-modal-sub onb-body" key={i}>{paragraph}</p>
          ))}
        </div>

        <div className="onb-progress" role="tablist" aria-label="Tour progress">
          {STEPS.map((s, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === step}
              aria-label={`Step ${i + 1}: ${s.eyebrow}`}
              className={`onb-dot${i === step ? ' is-active' : ''}${i < step ? ' is-done' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

        <div className="onb-actions">
          <button type="button" className="pro-modal-btn ghost onb-skip" onClick={finish}>
            {isLast ? 'Close' : 'Skip'}
          </button>
          <div className="onb-actions-right">
            {step > 0 && (
              <button type="button" className="pro-modal-btn ghost onb-back" onClick={() => goTo(step - 1)}>
                Back
              </button>
            )}
            <button
              type="button"
              className="pro-modal-btn primary onb-next"
              onClick={() => (isLast ? finish() : goTo(step + 1))}
            >
              {isLast ? 'Start exploring' : 'Next'}
            </button>
          </div>
        </div>

        <div className="onb-count">{step + 1} of {STEPS.length}</div>
      </div>
    </div>
  );
}
