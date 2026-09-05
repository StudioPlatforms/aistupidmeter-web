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
    title: 'Each number is a change, not a score',
    body: [
      'In the grid, every cell is how far that dimension has moved from that model’s baseline. +7 means seven points better than its own normal; -12 means twelve points worse.',
      'Blue is improvement, red is decline, and anything close to zero is left uncoloured on purpose - so the handful of readings that actually moved are the only coloured cells on the screen.',
    ],
    icon: ICON.grid,
  },
  {
    eyebrow: 'Dashes and gaps',
    title: 'Some cells have no number yet',
    body: [
      'A dash means we have fewer than three runs for that model, so there is nothing to compare against and no honest change to report. New models sit like this for a few days.',
      'A dot means that dimension was never measured. And rows marked "modelled" are estimates shown while live benchmarking is paused for that provider - they are not evidence of real drift, which is why you can hide them.',
    ],
    icon: ICON.clock,
  },
  {
    eyebrow: 'What to act on',
    title: 'The outline is the alarm',
    body: [
      'Colour shows size of movement. The amber outline is different: it means the detector itself flagged that reading as a genuine change rather than normal wobble.',
      'Rows are sorted so the biggest mover is at the top. Click any row to open that model and see its full history, including the change-point chart behind the alert.',
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
