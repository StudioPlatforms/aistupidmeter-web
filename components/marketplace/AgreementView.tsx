import Link from 'next/link';
import { ReadingPage, RdSection, RdProse } from '@/components/landing/Reading';
import AgreementText from '@/components/marketplace/AgreementText';
import { longDay, type AgreementDTO } from '@/lib/marketplace-public';
import '@/styles/marketplace-public.css';

/** The agreement page's body (current version and one version alike). */
export default function AgreementView({ a, preview }: { a: AgreementDTO; preview: boolean }) {
  const draft = a.legalReview !== 'reviewed';
  return (
    <>
      {preview && <div className="mp-staff-banner" role="note">Staff preview — not public</div>}
      <ReadingPage
        className="mp-agreement-page"
        kicker="For inference providers"
        title="Provider Terms and Listing Agreement"
        accent={`v${a.version}`}
        lead={draft ? 'A generic draft for staff previews: it is not offered for signature. Version 1.0, after legal review, is the first version anyone outside signs.' : `In force from ${longDay(a.effectiveAt)}.`}
        note={`SHA-256 of this text: ${a.bodySha256}`}
        toc={[{ id: 'text', label: 'The agreement' }, { id: 'versions', label: 'Versions' }]}
      >
        <RdSection id="text" n="01" title="The agreement">
          <AgreementText body={a.body} />
        </RdSection>
        <RdSection id="versions" n="02" title="Versions">
          <RdProse>
            <ul>
              {a.versions.map(v => (
                <li key={v.version}><Link href={`/inference-providers/agreement/${v.version}`}>Version {v.version}</Link> — {v.state}{v.effectiveAt ? `, in force from ${longDay(v.effectiveAt)}` : ''}</li>
              ))}
            </ul>
            <p>A change is notified at least 15 days before it applies (30 days for a material change), by email and in the provider console.</p>
          </RdProse>
        </RdSection>
      </ReadingPage>
    </>
  );
}
