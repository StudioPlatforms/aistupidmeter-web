import { dayLabel } from '@/lib/seo';

/**
 * The line under a research page's lead: "AI Stupid Level research · published 23 Oct 2026 ·
 * data 8 Aug 2025 – 23 Sep 2026 · as of 23 Sep 2026". The "as of" is the window's end: the figures
 * are as of that day, not of the day of reading. Dates go through lib/seo's fixed month arrays, so the server
 * and the browser print the same text. A span, so it can sit inside ReadingPage's `note` <p>.
 */
export interface DateWindow {
  /** "data" or "figures computed". */
  label: string;
  /** ISO days. */
  from: string;
  to: string;
}

export function Byline({ published, window }: { published: string; window?: DateWindow }) {
  return (
    <span className="rs-byline">
      <b>AI Stupid Level research</b>
      <i aria-hidden="true">·</i>
      <span>published {dayLabel(published)}</span>
      {window && (
        <>
          <i aria-hidden="true">·</i>
          <span>{window.label} {dayLabel(window.from)} – {dayLabel(window.to)}</span>
          <i aria-hidden="true">·</i>
          <span>as of {dayLabel(window.to)}</span>
        </>
      )}
    </span>
  );
}
