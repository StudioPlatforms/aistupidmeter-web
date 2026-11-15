import '@/styles/studio-router.css';

/**
 * "Why this model" for one routed request (Recent activity on /router, Recent requests on
 * /router/analytics): the reason the router stored when it chose the model, shown exactly as sent,
 * so an old request keeps the words of its day. It is the same block, label and look (sr-why) as
 * the live router's on the dashboard and the Routing preferences preview, folded until opened: a
 * native disclosure, so the keyboard (Tab, then Enter or Space) and screen readers work it as is.
 * Callers pass a non-empty reason (lib/recent-requests whyThisModel).
 */
export default function WhyThisModel({ reason }: { reason: string }) {
  return (
    <details className="sr-why is-fold">
      <summary className="st-label">Why this model</summary>
      <p>{reason}</p>
    </details>
  );
}
