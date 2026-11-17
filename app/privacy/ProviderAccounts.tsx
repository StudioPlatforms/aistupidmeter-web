import { RdSection, RdProse, RdFacts } from '@/components/landing/Reading';

/**
 * /privacy "Provider accounts" (provider marketplace release M12, the opening; M13): the legal text approved for publication,
 * with the agreement under its actual title, "Provider Terms and Listing Agreement". It describes only what is true on the
 * deploy day: the parts about features that come later (profile changes made public before review, the retention of
 * calibration records) are published with them. M13 publishes 1.1's listed-host scope, 1.7 (listed hosts connected through
 * the Smart Router), 1.9's listed-host lines with the lawyer's transfer paragraphs (second reply; the owner's rule: a host
 * connects only when every declared processing region is in the EEA or has an EU adequacy decision, the US only for a host
 * staff mark as certified under the EU-US Data Privacy Framework: api marketplace/transfers.ts), 1.2's registration-number
 * sentence (second reply; required before acceptance, console.ts companyBlockGaps) and 1.10's 90-day export sentence
 * (api marketplace/export.ts, store/providers.ts exportAccess).
 * What the schedules rest on (api): retention.ts (console activity's IP address and browser after 2 years, a consent still
 * in force excepted; statements of reasons, notices, appeals and complaints 3 years after the relationship ends; agreement
 * records redacted 3 years after the agreement ends, closure by either side; the dispute hold, reporter data included);
 * reports.ts (reporter data 6 months after the decision, held while the decision is under appeal); closing (store/listings
 * endProviderService in the close's own transaction, with the mirror step's 10-minute pass as the safety net: the
 * endpoints' keys deleted, the listings delisted with their date); the sink's logo retention (originals 30 days after the
 * decision, replaced renditions 90 days). The deletion three years after closure of the account's own details (identity,
 * members and former invitees, domains, profile, declaration, logos) is built in M13, long before any account can reach
 * it. Change the code and this text together: a change of wording is reviewed first.
 * Layout only: the numbered headings (1.1 to 1.11) are sub-headings without their numbers (the page numbers its
 * sections), the legal bases' lead-ins are bold, and the retention schedule is a table, one row per heading.
 */
export default function ProviderAccounts({ n }: { n: string }) {
  return (
    <RdSection id="providers" n={n} title="Provider accounts">
      <RdProse>
        <h3>Scope and responsibility</h3>
        <p>This section supplements our Privacy Policy. It applies if you create or manage an inference-provider account, accept an agreement on a provider’s behalf, report a listing, or connect a listed host through the Smart Router.</p>
        <p>AI Stupid Level is operated by S.C. STUDIO PLATFORMS S.R.L., Romania. We act as controller for the provider-account administration, security, agreement and compliance records described in this section. You can contact us about personal data at <a href="mailto:hello@aistupidlevel.info">hello@aistupidlevel.info</a>.</p>
        <p>We begin collecting provider-account information during setup, before an application is submitted or approved.</p>

        <h3>Provider accounts and company information</h3>
        <p>We collect the company display name, legal name, country, optional company registration number, optional VAT number, website, support contact, profile links, verified domains and DNS verification records, notice email address and its confirmation status, logos, and data-handling declaration.</p>
        <p>We also collect the account email addresses and roles of owners, administrators and members, together with invitations and membership changes. If someone invites you, we receive your email address and proposed role from that person.</p>
        <p>Information designated for the public provider profile becomes public following approval. Your company registration number is required before agreement acceptance and is visible to authorised users of your provider account and authorised ASL staff. Staff account details and agreement acceptance records are not published as part of the provider profile.</p>
        <p>Changes to a provider’s name, domain or logo require approval before publication.</p>

        <h3>Endpoints, credentials and measurements</h3>
        <p>We collect endpoint addresses, model listings, declared prices, offers, measurement settings, spending caps and benchmark results.</p>
        <p>Benchmark API keys are encrypted using AES-256-GCM and used only for authorised benchmark runs and related checks. Calibration runs require the additional confirmation described below.</p>
        <p>We publish benchmark results as daily mean scores. Where a benchmark suite runs once during a day, that daily mean is the score from that run. We do not publish private benchmark tasks, per-task results or individual execution times.</p>

        <h3>Agreement acceptance records</h3>
        <p>When an authorised representative accepts the Provider Terms and Listing Agreement, we record:</p>
        <p>(a) the company for which they are acting;</p>
        <p>(b) their name, title and email address;</p>
        <p>(c) the accepted agreement version and exact text;</p>
        <p>(d) the date and time of acceptance; and</p>
        <p>(e) the IP address and browser information associated with the acceptance request.</p>
        <p>Acceptance records are linked using cryptographic hashes to help detect alteration. Personal information contributes to those hashes through salted digests rather than appearing directly in the hash chain.</p>
        <p>A PDF copy is emailed to the representative and the company’s confirmed notice address and remains available in the provider console.</p>
        <p>Hashing does not, by itself, make information anonymous.</p>

        <h3>Decisions, notices, console activity and reports</h3>
        <p>We record decisions concerning applications, accounts and listings, their supporting reasons, notices, delivery status obtained from our mail server, acknowledgements, appeals and complaints.</p>
        <p>We also record actions taken in the provider console, including the account responsible, the action, its time, and associated IP address and browser information.</p>
        <p>If you report a listing, we collect your name, email address, report and supporting information. We retain a keyed digest of your IP address to help prevent abuse of the reporting system.</p>
        <p>Reporters’ identities are not routinely disclosed to the provider concerned. We may disclose information where required by law or strictly necessary to handle a report fairly and lawfully.</p>

        <h3>Calibration records</h3>
        <p>If an authorised representative approves a calibration campaign, we record the confirmation text and its hash, the relevant model and listing, estimated expenditure, maximum authorised expenditure, selected cap, applicable agreement version, representative, confirmation time, IP address and browser information.</p>
        <p>We also process the campaign’s run records, outputs and evaluation results to compare standard tasks with fresh task versions.</p>
        <p>Calibration results do not contribute to published provider scores. We may publish combined model-level findings without naming participating hosts. Where only one host participates, the findings are based solely on that host’s runs; participation may nevertheless be inferable from the circumstances.</p>
        <p>Any continuing checks must be described in the campaign confirmation and may be withdrawn independently.</p>

        <h3>Listed hosts connected through the Smart Router</h3>
        <p>If you connect a listed host, we process the API key you supply and the host addresses you confirm. The key is encrypted using AES-256-GCM and used to authenticate requests to that host.</p>
        <p>The host receives requests routed to it, including the request content and information needed to process them, under your own API credential. Responses pass back through ASL. Our general Privacy Policy explains any request records, optional prompt logging and temporary storage associated with the Smart Router.</p>
        <p>Each routed request includes an ASL-Router-Signature header containing a signing-key identifier, timestamp, random request identifier and request-body hash. The signature contains no ASL user, account or customer-key identifier. Your API credential may identify you to the host.</p>
        <p>The host processes requests under its applicable terms, privacy information and any data-processing agreement with you. Its listing displays its declared data-handling practices, which ASL has not audited.</p>

        <h3>Purposes and legal bases</h3>
        <p>We use the following legal bases, according to the particular processing activity.</p>
        <p><b>Performance of a contract — Article 6(1)(b) GDPR:</b></p>
        <p>Where you are personally a party to the relevant contract, we process information objectively necessary to provide your account, requested tests, Smart Router functionality and related support.</p>
        <p><b>Legitimate interests — Article 6(1)(f) GDPR:</b></p>
        <p>We process business representatives’ information to administer the relationship with their company, verify authority, manage access and maintain evidence of agreements and instructions.</p>
        <p>We also process information where necessary to secure the service, prevent abuse, protect measurement integrity, investigate reports, handle complaints and establish, exercise or defend legal claims.</p>
        <p>These interests are assessed against the rights and interests of the people concerned. A company’s agreement with us does not automatically make contract performance the legal basis for processing its employees’ personal data.</p>
        <p><b>Legal obligations — Article 6(1)(c) GDPR:</b></p>
        <p>Where applicable law requires us to provide or maintain particular notices, statements of reasons, reporting procedures or complaint records, we process the information necessary to meet that obligation.</p>
        <p>This includes relevant obligations under applicable EU platform legislation. Retention beyond what a particular legal obligation requires must have a separate lawful justification.</p>
        <p><b>Consent — Article 6(1)(a) GDPR:</b></p>
        <p>Where we offer an optional choice to publish your name alongside a user-run test, we do so only with your consent. You can withdraw that consent at any time.</p>
        <p>Accepting provider terms or approving expenditure is not blanket consent to personal-data processing.</p>

        <h3>Recipients and international processing</h3>
        <p>Authorised ASL personnel and the service providers identified in our general Privacy Policy may access information where necessary for their roles. Authorised provider-account users may access information according to their permissions. Agreement copies and company notices are sent to the designated recipients.</p>
        <p>Public profile information and published results are available to anyone viewing the relevant pages.</p>
        <p>A listed host receives the requests you route to it. Its declared processing regions appear in its listing. We email connected users when a declared processing region changes to include a country outside the European Economic Area.</p>
        <p>Selecting a host or receiving a region-change notice does not replace any international-transfer safeguards required by law.</p>
        <p>International transfers involving listed hosts are subject to the applicable arrangements described here:</p>
        <p>Listed hosts may process requests outside the European Economic Area. When you connect a listed host through the Smart Router, ASL forwards your requests using your API credential and receives the host’s responses. Requests may include personal data contained in prompts, files, conversation history or other request content.</p>
        <p>Before connection, we identify the host, its declared processing countries and the applicable international-transfer arrangement. Where GDPR Chapter V applies, we enable transfers only where covered by an applicable adequacy decision or appropriate safeguards, such as applicable Standard Contractual Clauses supported by any necessary transfer assessment and supplementary measures.</p>
        <p>You may request information about these safeguards, including a copy where applicable, at <a href="mailto:hello@aistupidlevel.info">hello@aistupidlevel.info</a>. We notify connected users of declared changes introducing processing outside the EEA and assess the transfer requirements before routing under the changed arrangement. Where required protection cannot be established, the affected connection remains unavailable or is suspended.</p>

        <h3>Retention</h3>
      </RdProse>
      <RdFacts rows={[
        ['Provider-account information', 'We retain operational account information while the provider account remains active. Following closure, information needed for the provider’s export remains available for 90 days. Following closure, we retain the company-account details and related records necessary to evidence the provider relationship, meet applicable legal obligations, or establish, exercise or defend legal claims for three years, unless a specific schedule below requires earlier deletion or a documented legal reason requires longer retention. API credentials are deleted on closure. Other operational information follows the retention period applicable to its purpose.'],
        ['Agreement acceptance records', 'We retain these for the duration of the agreement and three years after it ends, whether closure is initiated by ASL or the Provider. We then remove the representative’s personal information from ASL-controlled acceptance records and document copies, unless a specific legal obligation or existing dispute requires limited further retention. Copies already delivered to recipients remain under those recipients’ control.'],
        ['Statements of reasons, provider notices, appeals and complaints', 'We retain these during the provider relationship and for three years after it ends.'],
        ['Listing reports', 'We remove the reporter’s name, email address and IP digest six months after our decision, unless an ongoing appeal, legal obligation or specific dispute requires longer retention. Personal information contained in the report itself is subject to the same necessity assessment.'],
        ['Provider-console activity', 'We remove IP addresses and browser information after two years. Other activity information follows the retention period applicable to its purpose.'],
        ['Logo files', 'Uploaded originals are deleted 30 days after the review decision. Replaced display renditions are retained for 90 days.'],
        ['API credentials', 'Benchmark credentials are retained while configured for the provider account and deleted when removed or when the provider account closes. Connected-host credentials follow the credential-deletion rules in our general Privacy Policy.'],
        ['Historical public listings', 'Results ordinarily remain public for 90 days after a listing ends, marked with its withdrawal date. Listings removed on grounds requiring immediate removal are taken down earlier.'],
      ]} />
      <RdProse>
        <p>Deletion from backups follows the backup schedule in our general Privacy Policy. Any exceptional legal preservation is limited to the information and period necessary for its documented purpose.</p>

        <h3>Your choices and rights</h3>
        <p>You may request access, correction, erasure, restriction or portability where applicable. You may object to processing based on legitimate interests on grounds relating to your particular situation.</p>
        <p>You may withdraw consent to displaying your name with a user-run test without affecting the lawfulness of its earlier display.</p>
        <p>Some information is necessary to verify authority, secure an account or administer a listing. If it is not supplied, the relevant function may be unavailable.</p>
        <p>Privacy requests can be sent to <a href="mailto:hello@aistupidlevel.info">hello@aistupidlevel.info</a>. You may also complain to the Romanian National Supervisory Authority for Personal Data Processing or another competent supervisory authority.</p>
        <p>The specific retention periods in this section qualify any general statement elsewhere in our Privacy Policy that account deletion immediately removes all information.</p>
      </RdProse>
    </RdSection>
  );
}
