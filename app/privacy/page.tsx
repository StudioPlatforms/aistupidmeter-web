import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdFacts, RdRows, RdFinal, tocNumber } from '@/components/landing/Reading';

/**
 * Privacy policy. Every statement here was checked against the code and the server on 2026-10-19:
 * what the two databases store, the opt-in prompt log (api router/billing + jobs/prompt-retention),
 * the 90-day visit-row purge (api jobs/visitor-retention.ts), nginx log rotation (14 days), mail
 * logs (4 weekly rotations), nightly database backups (7 kept, scripts in /root/backups) and the
 * Google Analytics consent default (denied until accepted, app/layout.tsx). Change the code and
 * this page together. The model-pick memory rows (api router/proxy/pick-memory.ts, release A0b): one row
 * per account or project, routing mode and tie-break, rewritten at least hourly while in use, deleted by
 * an hourly sweep 7 days after its last write and with the account or the project. Router release A1: the
 * request records' routing labels (api router/billing/request-accounting.ts recordRouteMeta: strategy and its
 * source, benchmark, matched rule, turn kind, conversation event, reply signals, routing and first-byte
 * timings, score freshness; labels only, never prompt text), and the routing comparisons (api
 * router/jobs/estimator-shadow.ts, table router_estimator_shadow: per account routed in the last 7 days, the
 * pick of each routing mode it used under the current rules and the rules under test; deleted after 30 days
 * by the job itself and with the account or the project). Router release A2: per routed request, what Match each
 * request and each Model switching setting would do (api db/router-adaptive-schema.ts, table router_shadow_routes:
 * the mode asked for, the switching setting and the turn kind, the live pick and event, the matched rule, each
 * setting's model, event and short reason, and the estimated move cost; labels only, never prompt text; kept 30
 * days and deleted with the account or the project), in the same "Routing comparisons" row.
 */

export const metadata: Metadata = pageMeta({
  title: 'Privacy policy',
  description: 'What AI Stupid Level collects, why, who it is shared with, how long it is kept, which cookies are set only after consent, and your rights under the GDPR.',
  path: '/privacy',
});

/**
 * The day router release A1d goes live (the Request records row: which model a new conversation's pick replaced, and
 * why): a placeholder until the deploy day is set. A production build refuses the placeholder, so this page cannot ship
 * with it (as for A1 and A2). A1d's install block sets it on the deploy day (phase W), in its own commit.
 */
const UPDATED: string = '14 November 2026';
if (UPDATED === 'AW4_DEPLOY_DAY' && process.env.NODE_ENV === 'production') {
  throw new Error('app/privacy/page.tsx: set UPDATED to the day router A1d is deployed before building this branch');
}
const EMAIL = 'hello@aistupidlevel.info';

const TOC = [
  { id: 'who', label: 'Who we are' },
  { id: 'collect', label: 'What we collect' },
  { id: 'router', label: 'Smart Router traffic' },
  { id: 'why', label: 'Why, and on what legal basis' },
  { id: 'share', label: 'Who we share it with' },
  { id: 'transfers', label: 'Transfers outside the EU' },
  { id: 'retention', label: 'How long we keep it' },
  { id: 'cookies', label: 'Cookies and local storage' },
  { id: 'security', label: 'Security' },
  { id: 'rights', label: 'Your rights' },
  { id: 'children', label: 'Children' },
  { id: 'changes', label: 'Changes to this policy' },
];
const n = (id: string) => tocNumber(TOC, id);
const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;
const Mail = () => <a href={`mailto:${EMAIL}`}>{EMAIL}</a>;

export default function PrivacyPage() {
  return (
    <ReadingPage
      className="rd-legal"
      kicker="Legal"
      title="Privacy Policy"
      lead={<>How AI Stupid Level handles personal data: what we collect, why, who sees it, how long we keep it, and how to exercise your rights. Last updated {UPDATED}.</>}
      actions={(
        <>
          <a className="lp-btn lp-btn-primary lp-btn-lg" href={`mailto:${EMAIL}`}>Email a privacy request <span className="lp-ar" aria-hidden="true">→</span></a>
          <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/terms">Terms of Service</Link>
        </>
      )}
      toc={TOC}
      final={(
        <RdFinal
          id="contact-privacy"
          title="Questions about your data?"
          lead={<>Write to <Mail /> or use the contact form. We answer privacy requests within one month.</>}
          actions={<Link className="lp-btn lp-btn-primary lp-btn-lg" href="/contact">Contact us <span className="lp-ar" aria-hidden="true">→</span></Link>}
        />
      )}
    >
      <RdSection id="who" n={n('who')} title="Who we are">
        <RdProse>
          <p>
            AI Stupid Level (aistupidlevel.info, &ldquo;ASL&rdquo;, &ldquo;we&rdquo;) is operated by <b>S.C. STUDIO PLATFORMS S.R.L.</b>, Craiova,
            Dolj County, Romania. We are the controller of the personal data described here. Contact: <Mail />.
          </p>
          <p>
            This policy covers the website, your account, paid plans, the Smart Router (<code>/v1</code>), the Data API, workspaces,
            the forum and our emails. It applies under the EU General Data Protection Regulation (GDPR) and Romanian law.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="collect" n={n('collect')} title="What we collect">
        <RdFacts rows={[
          ['Account', 'Your email address, name, a password hash (bcrypt; we never store the password itself), whether your email is confirmed, your plan, and the settings you choose (watchlists, alerts, layout, routing preferences).'],
          ['Sign in with Google or GitHub', 'If you use it: the email address, name and profile picture that Google or GitHub share with us, and their account ID for you.'],
          ['Payments', <>Handled by <a key="s" href="https://stripe.com/privacy" {...ext}>Stripe</a>. We never see or store your card number. We keep your Stripe customer and subscription IDs, your plan and its dates, and records of purchases.</>],
          ['Smart Router and Data API', 'The router keys and Data API keys you create, the provider keys you add (encrypted), and a record of each request. See the next section.'],
          ['Workspaces', 'Members and roles, projects, budgets, invitations, single sign-on and SCIM settings, and an audit log of workspace actions (who did what, with the IP address and browser it came from).'],
          ['Forum', 'Your posts and your forum username. Posts are public.'],
          ['Contact form', 'Your name, email, company, topic and message, with the IP address and browser the message came from (to stop abuse of the form).'],
          ['Emails we send', 'Who we sent which email to and whether it was delivered: account emails (confirmation, password reset), alerts you subscribe to, receipts for assessments, and occasional service emails.'],
          ['Site visits', 'For each page view: IP address, browser (user agent), the page, the referring page, the time, and the country and city derived from the IP address using a database on our own server. No third party sees this.'],
          ['Benchmark runs with your keys', 'If you use Test your keys or fund a community run with your own provider key: the results and the models tested. The key is used for that run.'],
        ]} />
        <RdProse>
          <p>We do not buy personal data, we do not sell it, and we do not use it for advertising.</p>
        </RdProse>
      </RdSection>

      <RdSection id="router" n={n('router')} title="Smart Router traffic" lead="The router passes your requests to the AI provider you hold a key for. It does not keep your prompts unless you turn that on.">
        <RdRows rows={[
          ['Your requests and the answers', 'Pass through our server on their way to and from the provider. They are not stored, except as described in the rows below.'],
          ['Prompt logging (off by default)', 'If you turn it on in API monitoring, for your account or for one key, we store the last user message of each request (up to its first 256 KB), encrypted with AES-256-GCM, after automatically removing API keys and tokens, email addresses, phone numbers and other strings that look like secrets. It is deleted after your retention setting (90 days unless you change it). You can view it, delete one prompt or delete all of them at any time.'],
          ['Request records', 'For every request: time, router key, requested and selected model, provider, routing reason, token counts, latency, cost estimate, success or error, and any fallback, with labels of how it was routed: the strategy and benchmark it was ranked on and where that strategy came from, the rule that matched it, the kind of turn, the model-switching setting, whether a conversation stayed on its model (or which model it moved from), which model a new conversation’s pick replaced, and why, signals about the answer (that it was empty, that a tool call’s arguments were malformed, that a failed tool call was repeated, or that it was cut off at our default length; labels only, never the text), how fresh the scores were, and timings (routing, first byte, first text). These power your dashboard, budgets and analytics. Your plan sets how far back you can see them (3 days on Free and Pro, 30 on Developer, 90 on Teams, 365 on Enterprise).'],
          ['Model-pick memory', 'For each routing mode and tie-break, the model the router last chose for your account (or project) and when, so that a pick between statistically tied models does not change when our server restarts, and to record on a new conversation’s request which model its pick replaced. Kept 7 days after its last use.'],
          ['Routing comparisons', 'If you used routing in the last 7 days: after each benchmark run, for each routing mode you used, the model it picks for you under the current rules and under rules we are testing, so a change is checked against your own settings before it goes live. Stored: the mode and tie-break, the providers you hold keys for, the models picked and which models were tied for first, and a short note when no model could be picked. For routed requests, also what Match each request and each Model switching setting would have done with the request: the model it would have gone to, whether the conversation would have stayed or moved and why, the rule that matched it and the estimated cost of a move, with the mode it asked for, the kind of turn and your Model switching setting. Never a prompt. Kept 30 days.'],
          ['Retry protection', <>If you send an <code key="i">Idempotency-Key</code>, the response is kept for 24 hours so that a retry gets the same answer instead of a second charge.</>],
          ['Tool calls', 'To continue a multi-step tool conversation on the same model, the model’s own turn data is kept, encrypted, for 24 hours.'],
          ['Provider keys', 'Stored encrypted with AES-256-GCM and decrypted only to make your requests. You can remove them at any time.'],
          ['The AI provider', 'Receives your request under your own key and processes it under its own terms and privacy policy, as if you had called it directly. You choose which providers we may route to.'],
        ]} />
      </RdSection>

      <RdSection id="why" n={n('why')} title="Why, and on what legal basis">
        <RdFacts rows={[
          ['To provide the service (contract, Art. 6(1)(b) GDPR)', 'Your account, sign-in, plans and payments, the Smart Router, Data API, workspaces, alerts you ask for, and support.'],
          ['To meet legal duties (Art. 6(1)(c))', 'Keeping accounting and tax records, and answering lawful requests from authorities.'],
          ['Our legitimate interests (Art. 6(1)(f))', 'Keeping the service secure and stopping abuse (rate limits, blocking scrapers and bots), counting visits and where they come from, fixing faults, and telling customers about important changes to the service.'],
          ['Your consent (Art. 6(1)(a))', 'Google Analytics cookies, and prompt logging when you turn it on. You can withdraw consent at any time; that does not affect what happened before.'],
        ]} />
      </RdSection>

      <RdSection id="share" n={n('share')} title="Who we share it with">
        <RdFacts rows={[
          ['Contabo GmbH', 'Hosts our server, in Germany. All our databases and logs are stored there.'],
          ['Stripe', 'Payments, subscriptions and invoices.'],
          ['Google', 'Sign in with Google (if you use it) and Google Analytics (only if you accept analytics cookies; IP anonymisation on, advertising features off).'],
          ['GitHub', 'Sign in with GitHub, if you use it.'],
          ['AI providers you hold keys for', 'OpenAI, Anthropic, Google, DeepSeek, Moonshot (Kimi) and Zhipu (GLM) receive the requests you route to them, under your key.'],
          ['Your workspace', 'If you join a workspace, its owners and admins see your membership, your usage within its projects and the workspace audit log.'],
          ['Authorities', 'Only when the law requires it.'],
        ]} />
        <RdProse>
          <p>Our emails are sent from our own mail server, not through a third-party email service. Site visits are located with a database on our own server, not by a third party.</p>
        </RdProse>
      </RdSection>

      <RdSection id="transfers" n={n('transfers')} title="Transfers outside the EU">
        <RdProse>
          <p>
            Our server is in the EU. Stripe, Google and GitHub may process data in the United States; they rely on the EU-US Data Privacy
            Framework or the European Commission&rsquo;s Standard Contractual Clauses. When you route a request to an AI provider, it goes
            where that provider processes requests (for example the US, or China for DeepSeek, Moonshot and Zhipu), under your
            agreement with that provider.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="retention" n={n('retention')} title="How long we keep it">
        <RdFacts rows={[
          ['Account and settings', 'Until you delete your account (Settings, Delete account). Deleting it removes your data from both our databases; your forum posts stay, credited to “Deleted user”.'],
          ['Request records', 'While your account exists. Deleted with your account.'],
          ['Logged prompts', 'Your retention setting, 90 days by default. Only if you turned logging on.'],
          ['Retry protection and tool-call turns', '24 hours.'],
          ['Model-pick memory', '7 days after its last use (an hourly clean-up deletes it), or sooner with your account or project.'],
          ['Routing comparisons', '30 days (an hourly clean-up deletes older ones), or sooner with your account or project.'],
          ['Site visits (IP address, browser, page, location)', '90 days. After that only daily totals remain (visits, unique visitors, top pages and top countries), with no IP addresses.'],
          ['Web server logs', '14 days.'],
          ['Mail server logs', 'About four weeks.'],
          ['Payment and accounting records', 'As long as Romanian accounting and tax law requires (up to 10 years).'],
          ['Contact messages', 'As long as we need them to answer and follow up. Ask and we delete yours.'],
          ['Backups', 'Nightly database backups, kept for 7 days on the same server.'],
        ]} />
      </RdSection>

      <RdSection id="cookies" n={n('cookies')} title="Cookies and local storage">
        <RdFacts rows={[
          ['Sign-in (necessary)', 'Two short-lived security cookies set by the sign-in system on every visit (a CSRF token and the page to return to after signing in), and, once you sign in, a session cookie that keeps you signed in for up to 30 days.'],
          ['Preferences (necessary)', 'Your leaderboard layout (a cookie, one year) and display choices kept in your browser’s local storage, such as the theme and which introductions you have seen.'],
          ['Your analytics choice (necessary)', 'Whether you accepted or declined analytics, kept in local storage so we do not ask again.'],
          ['Google Analytics (only with your consent)', 'Cookies named _ga and _ga_*, used to count page views and see which parts of the site are used. Off until you accept. IP anonymisation is on, advertising features and Google signals are off.'],
        ]} />
        <RdProse>
          <p>
            Change your choice at any time with <b>Cookie settings</b> in the footer. Declining removes the Google Analytics cookies.
            Checkout pages are run by Stripe on its own site, under <a href="https://stripe.com/cookie-settings" {...ext}>Stripe&rsquo;s cookie policy</a>.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="security" n={n('security')} title="Security">
        <RdProse>
          <p>
            Traffic is encrypted with HTTPS. Passwords are hashed with bcrypt. Provider keys and logged prompts are encrypted with
            AES-256-GCM. Access to the server is restricted, the firewall only opens the ports the service needs, and repeated failed
            logins are blocked. If a breach puts your data at risk, we will notify the Romanian supervisory authority within 72 hours
            and tell you without undue delay where the law requires it.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="rights" n={n('rights')} title="Your rights">
        <RdRows rows={[
          ['Access and a copy', 'Ask what we hold about you and get a copy.'],
          ['Correction', 'Fix data that is wrong. Most of it you can change yourself in Settings.'],
          ['Deletion', 'Delete your account in Settings, or ask us.'],
          ['Restriction and objection', 'Ask us to pause or stop processing based on our legitimate interests.'],
          ['Portability', 'Get the data you gave us in a machine-readable format.'],
          ['Withdraw consent', 'Cookie settings in the footer for analytics; API monitoring for prompt logging.'],
          ['Complain', <>To the Romanian National Supervisory Authority for Personal Data Processing (<a key="a" href="https://www.dataprotection.ro" {...ext}>ANSPDCP</a>), or the authority where you live or work.</>],
        ]} />
        <RdProse>
          <p>Email <Mail /> from the address on your account. We answer within one month, and we may ask you to confirm who you are first.</p>
        </RdProse>
      </RdSection>

      <RdSection id="children" n={n('children')} title="Children">
        <RdProse>
          <p>ASL is a tool for developers and businesses and is not meant for children. You must be at least 16 to create an account. If you believe a child has given us personal data, tell us and we will delete it.</p>
        </RdProse>
      </RdSection>

      <RdSection id="changes" n={n('changes')} title="Changes to this policy">
        <RdProse>
          <p>When we change this policy we update the date at the top. If a change materially affects how we use your data, we will tell account holders by email before it takes effect.</p>
        </RdProse>
      </RdSection>
    </ReadingPage>
  );
}
