import Link from 'next/link';
import type { ReactNode } from 'react';
import { RdRows } from '@/components/landing/Reading';
import { FINDINGS_METHOD, FINDINGS_SOURCE, WITHDRAWAL_METHOD, isBehaviourFinding, type Finding } from '@/lib/findings';
import { dayLabel } from '@/lib/seo';
import { vendorByKey } from '@/lib/seo-data';

/**
 * Dated findings as ruled rows: the date, model and vendor as the claim, the metric with its
 * before → after values and the note as the explanation, then the method line and the link to
 * the research article that derives every row. Rows are given newest first by the page.
 */
export function FindingsRows({ findings, showVendor = true }: { findings: Finding[]; showVendor?: boolean }) {
  if (!findings.length) return null;
  const rows: [ReactNode, ReactNode][] = findings.map((f) => {
    const vendor = vendorByKey(f.vendor);
    return [
      <span key="k"><time dateTime={f.date}>{dayLabel(f.date)}</time> · {f.model}{showVendor && vendor ? <small className="wr-vendor"> {vendor.label}</small> : null}</span>,
      <span key="v"><b>{f.metric}:</b> {f.before} → {f.after}. {f.note}</span>,
    ];
  });
  const behaviour = findings.some(isBehaviourFinding);
  const withdrawals = findings.some((f) => !isBehaviourFinding(f));
  return (
    <>
      <RdRows rows={rows} />
      <p className="wr-note lp-up">
        {behaviour && <>Method: {FINDINGS_METHOD}. </>}
        {withdrawals && <>Withdrawals are read from {WITHDRAWAL_METHOD}. </>}
        Every row, with its dates and how it was derived, is in{' '}
        <Link href={FINDINGS_SOURCE}>What 13 months of monitoring LLM APIs caught</Link>.
      </p>
    </>
  );
}
