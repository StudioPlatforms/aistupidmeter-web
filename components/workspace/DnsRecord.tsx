'use client';

import { CopyButton, Tag } from '@/components/studio';

/**
 * A DNS proof as the account pages show it: the record's name and value, each with a copy
 * button. Shared by single sign-on (/account/security) and provider domains
 * (/account/provider/domains). Both proofs use the same record name, _asl-verification.<domain>,
 * with values that cannot stand in for each other, so the two pages say which proof a record is.
 * Styles: styles/studio-team.css (sw-copy, sw-dns).
 */

export interface DnsRecordValue { type: string; name: string; value: string }

/** A value to paste somewhere else, with its label and a copy button. */
export function Copyable({ label, value }: { label: string; value: string }) {
  return (
    <div className="sw-copy">
      <span className="sw-copy-l">{label}</span>
      <div className="sw-copy-v"><code>{value}</code><CopyButton text={value} /></div>
    </div>
  );
}

/** The TXT record that proves control of a domain. */
export function DnsBlock({ record }: { record: DnsRecordValue }) {
  return (
    <div className="sw-dns">
      <div className="sw-dns-head"><span className="st-label">DNS record</span><Tag tone="line">{record.type || 'TXT'}</Tag></div>
      <Copyable label="Record name (host)" value={record.name} />
      <Copyable label="Record value (TXT)" value={record.value} />
    </div>
  );
}
