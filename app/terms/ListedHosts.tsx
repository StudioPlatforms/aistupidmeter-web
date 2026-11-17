import { RdSection, RdProse } from '@/components/landing/Reading';

/**
 * /terms "Listed hosts and provider accounts" (provider marketplace release M12, the opening): the legal text approved for
 * publication, with the agreement under its actual title, "Provider Terms and Listing Agreement"; the page's own
 * "Last updated" is the deploy day. Why it is true on that day (api): providers pay nothing (no fee anywhere in the
 * console, the agreement or the plans); benchmark requests use the provider's own key within its spending cap; no account
 * is submitted for review without an accepted agreement (submit checks it itself); connecting a listed host is said
 * conditionally ("When you connect a listed host"), and none is connectable at the opening. Change the code and this
 * text together: a change of wording is reviewed first.
 * Layout only: the numbered headings (2.1 to 2.5) are sub-headings without their numbers.
 */
export default function ListedHosts({ n }: { n: string }) {
  return (
    <RdSection id="providers" n={n} title="Listed hosts and provider accounts">
      <RdProse>
        <p>These provisions apply only when you create a provider account, connect a listed host, or use the user-run testing feature. They do not change the terms governing your existing use of other ASL services.</p>

        <h3>Independent inference providers</h3>
        <p>Inference providers listed on ASL are independent companies that operate their own services.</p>
        <p>When you connect a listed host through the Smart Router, requests selected for that host are sent to it using your own API credential. You obtain access from the host directly, and the host processes and bills those requests under its agreement with you.</p>
        <p>ASL is not a party to your inference-service agreement with the host. Each party remains responsible for its own services, conduct and legal obligations.</p>

        <h3>Information before connecting</h3>
        <p>Before connecting a host, review its identity, prices, service terms, privacy information and declared processing regions.</p>
        <p>A listing, domain verification or benchmark result does not constitute an audit, certification or guarantee of the host’s security, legal compliance, availability or suitability for your intended use.</p>
        <p>Benchmark results describe observed performance under the stated methodology. They do not guarantee the result of a particular request.</p>

        <h3>Provider accounts and the Provider Terms and Listing Agreement</h3>
        <p>A company applying to list models must separately accept the Provider Terms and Listing Agreement through an authorised representative.</p>
        <p>That agreement governs the company’s provider application, listings, benchmarking, publication of results, calibration approvals and optional participation in the Smart Router.</p>
        <p>Where it conflicts with these Terms concerning those matters, the Provider Terms and Listing Agreement prevails.</p>
        <p>These Terms continue to govern the ordinary ASL accounts used by the company’s staff, including sign-in, account security and any separately purchased ASL plans. General account provisions do not override the company’s notice, appeal or data-access rights under the Provider Terms and Listing Agreement.</p>

        <h3>Charges and benchmark costs</h3>
        <p>ASL charges providers no fee for listing, benchmark administration, ranking placement or traffic routed to their listed services.</p>
        <p>Providers bear the cost of authorised benchmark requests made using their own credentials, subject to their agreed spending controls.</p>
        <p>Customers pay the host directly for inference usage. Any separate ASL subscription remains governed by the applicable ASL plan terms.</p>

        <h3>Mandatory rights</h3>
        <p>Nothing in this section excludes mandatory consumer rights or limits ASL’s responsibility for its own services where that responsibility cannot lawfully be excluded.</p>
      </RdProse>
    </RdSection>
  );
}
