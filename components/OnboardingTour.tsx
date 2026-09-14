'use client';

import TourModal, { type TourStep } from './TourModal';

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

const STEPS: TourStep[] = [
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
      'Every four hours, each model gets the same seven programming jobs. Most of them work like a real bug report: here is a small working project, and here is a customer complaining that something is wrong. Nobody tells the model which file to look in.',
      'We never judge the answer by reading it — we run it. And we check it against tests the model was never shown, because the easy way to "fix" a bug is to make the complaint go away while leaving the fault in place. That distinction is the whole point, and when a model does it we say so on its page.',
    ],
    icon: ICON.code,
  },
  {
    eyebrow: 'Reasoning',
    title: 'We test thinking across several turns',
    body: [
      'Real work is never one question.',
      'Every day each model works through four long sessions: debugging a shopping cart, building something to a written spec, answering chained questions about a document, and splitting a tangled app into parts. Each turn builds on the last, and when its work fails it is told so the way a colleague would — without being handed the error. Models that ace quick questions often come apart here.',
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
      'Those results roll into a single 0–100 score for each model — half from coding, a quarter each from reasoning and tool use.',
      'Separately, two watchers compare every model against its own past. A slow one confirms a real decline over days and is deliberately hard to set off. A fast one runs every hour and is there to catch a model falling over this afternoon. Both need about 10 days of settled history before they will say anything — and that clock restarts whenever we change how we test, which we would rather admit than paper over.',
    ],
    icon: ICON.gauge,
  },
  {
    eyebrow: 'The leaderboard',
    title: 'What the top of the list means',
    body: [
      'The model in first place is not "the smartest AI". It is the one that came out best across those three suites in the most recent runs, and stayed steady while doing it.',
      'You will see several models sharing the same rank, marked with an “=”. That is deliberate and it is the honest answer: when the gap between them is smaller than our own measuring error, we will not pretend one is ahead. A rank without an “=” is a model standing on its own.',
      'Positions still move — everything is re-tested every few hours — so read the direction of a model’s line before you read its place, and click any row for the full history.',
    ],
    icon: ICON.board,
  },
];

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingTour({ isOpen, onClose }: OnboardingTourProps) {
  return (
    <TourModal
      isOpen={isOpen}
      onClose={onClose}
      steps={STEPS}
      storageKey={ONBOARDING_STORAGE_KEY}
      finishLabel="Start exploring"
    />
  );
}
