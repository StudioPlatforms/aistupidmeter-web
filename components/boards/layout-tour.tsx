'use client';

import TourModal, { type TourStep } from '../TourModal';
import type { BoardLayout } from '../../lib/board-layout';

/**
 * "How to read this" steps for each leaderboard layout.
 *
 * The first-visit tour (OnboardingTour) explains what is measured and ends with these; after
 * a visitor switches layout they get only these, for the layout they switched to. Two steps
 * each: how to read the layout, then ties, coverage notes and where the community-funded
 * models are — the three things a reader otherwise mistakes for errors.
 */

const ICON = {
  board: (
    <>
      <path d="M4 20V10M10 20V5M16 20v-8M22 20H2" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="5" r="1.7" fill="currentColor" />
    </>
  ),
  lines: (
    <path d="M3 6h4c4 0 6 12 10 12h4M3 18h4c4 0 6-12 10-12h4" fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" />
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10h18M3 15h18M9 4v16" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </>
  ),
  people: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
            fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </>
  ),
};

const TIES =
  'Models sharing a rank marked “=” are a statistical tie: the gap between them is smaller than our own measuring error, so we will not pretend one is ahead. A rank without “=” is a model standing on its own.';
const COVERAGE =
  'A small amber note such as “5/7 tasks” means that model was graded on fewer tasks than the rest, usually because its provider declined some. It keeps its place but is never called tied.';

const STEPS: Record<BoardLayout, TourStep[]> = {
  connected: [
    {
      eyebrow: 'Reading the boards',
      title: 'Four boards, joined by lines',
      body: [
        'Each column is a full leaderboard — Combined, Coding, Reasoning and Tool use — with the best at the top. A line joins the same model from one board to the next, so you can see where a model is strong and where it slips.',
        'Point at any model to preview its line; click it to keep it traced. The bar above the boards then shows its rank on all four. Open its page from there for the full history.',
      ],
      icon: ICON.lines,
    },
    {
      eyebrow: 'Ties and dashed lines',
      title: 'What “=”, amber notes and dashed lines mean',
      body: [
        TIES,
        COVERAGE,
        'Five models are community-funded: we still test their coding every four hours, but their reasoning and tool-use tests run only when someone funds a run with their own key. They sit under a label below each of those boards, and the lines that reach them are dashed.',
      ],
      icon: ICON.people,
    },
  ],
  side: [
    {
      eyebrow: 'Reading the boards',
      title: 'Four boards, side by side',
      body: [
        'Combined, Coding, Reasoning and Tool use each have their own leaderboard, best at the top. The same model can sit high on one and lower on another — that is the reason to see them together.',
        'Click any model for its full history. On a phone, swipe between the boards or use the tabs above them.',
      ],
      icon: ICON.board,
    },
    {
      eyebrow: 'Ties and the community section',
      title: 'What “=”, amber notes and the grey section mean',
      body: [
        TIES,
        COVERAGE,
        'At the bottom of the Combined, Reasoning and Tool use boards is a community-funded section. Those models’ reasoning and tool-use tests run only when someone funds a run, so they are shown with their last funded result and not ranked. On Coding they rank as normal: we still test them every four hours.',
      ],
      icon: ICON.people,
    },
  ],
  table: [
    {
      eyebrow: 'Reading the table',
      title: 'One row per model, four scores',
      body: [
        'Each row shows a model’s Combined, Coding, Reasoning and Tool use scores, with its rank on that board underneath each one. The highlighted column is the one the table is ordered by — click another heading to rank by it, or by price.',
        'Click any model for its full history.',
      ],
      icon: ICON.table,
    },
    {
      eyebrow: 'Ties and grey scores',
      title: 'What “=”, amber notes and grey scores mean',
      body: [
        TIES,
        COVERAGE,
        'The community-funded models are grouped at the bottom. We still test their coding every four hours; a grey reasoning or tool-use score is their last funded run, with its date, and is not ranked. “Not ranked” under Combined means their reasoning and tool use are community-funded, so there is no complete combined score to rank.',
      ],
      icon: ICON.people,
    },
  ],
  top: [
    {
      eyebrow: 'Reading the boards',
      title: 'The top five of every board',
      body: [
        'The four cards show the first five on Combined, Coding, Reasoning and Tool use. “See all” opens that board in full underneath, where the tabs switch between boards.',
        'Click any model for its full history.',
      ],
      icon: ICON.board,
    },
    {
      eyebrow: 'Ties and the community strip',
      title: 'What “=”, amber notes and the strip mean',
      body: [
        TIES,
        COVERAGE,
        'The strip under the cards holds the community-funded models: their coding scores, which we still measure every four hours, their last funded reasoning and tool-use results, and a button to fund the next run.',
      ],
      icon: ICON.people,
    },
  ],
};

export function layoutSteps(layout: BoardLayout): TourStep[] {
  return STEPS[layout];
}

export const LAYOUT_TOUR_STORAGE_KEY = 'stupidmeter-layout-tour-seen';

/** The short explainer: this layout's two steps only. */
export function LayoutTour({ isOpen, onClose, layout }: { isOpen: boolean; onClose: () => void; layout: BoardLayout }) {
  return (
    <TourModal
      isOpen={isOpen}
      onClose={onClose}
      steps={layoutSteps(layout)}
      storageKey={LAYOUT_TOUR_STORAGE_KEY}
      finishLabel="Got it"
    />
  );
}
