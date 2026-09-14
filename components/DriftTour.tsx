'use client';

import TourModal, { type TourStep } from './TourModal';

export const DRIFT_TOUR_STORAGE_KEY = 'stupidmeter-drift-tour-seen';

/**
 * Walkthrough for the drift monitor.
 *
 * The drift view is the least self-explanatory part of the site: it shows change
 * against each model's own past rather than a ranking, which is a different question
 * from the one the leaderboard answers. Without this, the panel reads as "a table of
 * numbers that are mostly zero".
 */

const ICON = {
  compare: (
    <>
      <path d="M4 7h7M4 12h7M4 17h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15 5v14M19 5v14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" fill="currentColor" opacity=".35" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" fill="currentColor" opacity=".35" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  flag: (
    <>
      <path d="M6 21V4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 4.5h11l-2.2 3.6L17 12H6z" fill="currentColor" opacity=".4" />
    </>
  ),
};

const STEPS: TourStep[] = [
  {
    eyebrow: 'What this page is',
    title: 'Every model is compared against itself',
    body: [
      'The leaderboard ranks models against each other. This page does something different: it compares each model against its own past.',
      'That is the only way to catch a model getting quietly worse. A model can still be near the top of the leaderboard while being noticeably worse than it was a month ago - and that is what people actually feel when a tool "stops working as well".',
    ],
    icon: ICON.compare,
  },
  {
    eyebrow: 'Reading the grid',
    title: 'The big number is now, the colour is the change',
    body: [
      'Each cell shows two things. The number is where that model stands on that skill today, out of 100. The colour, and the smaller “+7” or “−12” beside it, are how far that has moved from the model’s own normal.',
      'Blue is improvement, red is decline, and anything close to steady is left uncoloured on purpose — so the handful of readings that really moved are the only coloured cells on the screen.',
      'The columns follow the sort you picked above the board: choose Reasoning and you get the reasoning skills, choose Tool use and you get tool-use skills. They are never mixed, because a score from one kind of test means nothing on another’s scale.',
    ],
    icon: ICON.grid,
  },
  {
    eyebrow: 'When the colour is missing',
    title: 'A number with no colour means “too early to say”',
    body: [
      'To say something has moved we need to compare a model’s newest runs against its older ones on exactly the same tests — six runs in all. Until then a cell shows today’s number and nothing else. That is not “no change”; it is “we cannot tell yet”, and we would rather say so.',
      'This happens to every model at once whenever we change how we test, which we have done this week. Coding fills back in within a day; the once-a-day suites take about six.',
      'A dot means that skill was never measured at all. Rows marked “modelled” are estimates shown while live testing is paused for that provider — they are not evidence of real drift, which is why you can hide them.',
    ],
    icon: ICON.clock,
  },
  {
    eyebrow: 'What to act on',
    title: 'The outline is the alarm',
    body: [
      'Colour shows the size of a movement. The amber outline is different: it means the detector flagged that reading as a genuine change rather than normal wobble.',
      'Being flagged here is not the same as an incident. An incident needs a sustained fall that passes a statistical test, and each model’s page shows exactly how close its detector is to firing — or says it is still warming up, which is where they all are this week.',
      'Rows are sorted so the biggest mover is at the top. Click any row to open that model and see its full history, including the chart behind the alert.',
    ],
    icon: ICON.flag,
  },
];

interface DriftTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DriftTour({ isOpen, onClose }: DriftTourProps) {
  return (
    <TourModal
      isOpen={isOpen}
      onClose={onClose}
      steps={STEPS}
      storageKey={DRIFT_TOUR_STORAGE_KEY}
      finishLabel="Got it"
    />
  );
}
