/**
 * "Submit for review" for a listing added after approval (M11 B4), as two small parts of a Models row: the line that
 * says what is left or why it cannot be submitted, and the button, which points to that line (aria-describedby).
 * M12 (M11 review MINOR-5, MINOR-8, MINOR-9): nothing is offered outside good standing, the line then says why; the
 * button reads "Submitting…" while it works; owners and admins only (a viewer gets neither). Pure: tests render them.
 */

export interface SubmitListing { id: number; state: string; submissionGaps: ReadonlyArray<{ code: string; message: string }> }
export interface SubmitProvider { state?: string; submitClosedReason?: string | null }

/** Shown under a draft listing of an approved account, to owners and admins. */
export function SubmitLine({ l, provider, editable }: { l: SubmitListing; provider: SubmitProvider | null | undefined; editable: boolean }) {
  if (!editable || provider?.state !== 'approved' || l.state !== 'draft') return null;
  return (
    <p className="mp-check-s" id={`lst-why-${l.id}`}>{provider.submitClosedReason
      ?? (l.submissionGaps.length ? 'Not submitted yet: once the items above are done, submit it for review.' : 'Ready: submit it for review. A person approves every listing before it is listed.')}</p>
  );
}

/** The button, beside the row's other actions: none while the account's standing closes submission (the line says why). */
export function SubmitButton({ l, provider, editable, busy, onSubmit }: {
  l: SubmitListing; provider: SubmitProvider | null | undefined; editable: boolean; busy: boolean; onSubmit: () => void;
}) {
  if (!editable || provider?.state !== 'approved' || l.state !== 'draft' || provider.submitClosedReason) return null;
  return (
    <button type="button" className="st-btn is-sm is-primary" onClick={onSubmit} disabled={busy || l.submissionGaps.length > 0}
      aria-describedby={`lst-why-${l.id}`}>{busy ? 'Submitting…' : 'Submit for review'}</button>
  );
}
