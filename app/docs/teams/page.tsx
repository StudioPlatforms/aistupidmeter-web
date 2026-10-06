import type { Metadata } from 'next';
import Link from 'next/link';
import { DocPage, Section, Prose, Facts } from '@/components/docs/Doc';

export const metadata: Metadata = {
  title: 'Workspaces, projects, single sign-on and SCIM | Setup guide',
  description:
    'How team workspaces work on AI Stupid Level: a shared team watchlist with alerts, projects with their own Smart Router keys, routing rules, provider keys, budgets and spend reports, roles, webhooks, single sign-on with DNS domain verification, SCIM and the audit trail.',
  alternates: { canonical: '/docs/teams' },
};

/**
 * The setup guide the Team, project and Security pages link to ("How workspaces work", "How
 * projects work", "How to set these up"). Every statement here describes code that exists:
 * when a feature changes, change this page with it.
 */
const TOC = [
  { id: 'workspace', label: 'What a workspace is' },
  { id: 'plans', label: 'Plans' },
  { id: 'members', label: 'Inviting people' },
  { id: 'roles', label: 'Roles' },
  { id: 'watchlist', label: 'Team watchlist' },
  { id: 'projects', label: 'Projects' },
  { id: 'keys', label: 'Project keys and routing rules' },
  { id: 'budgets', label: 'Budgets and caps' },
  { id: 'reports', label: 'Reports and activity' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'sso', label: 'Single sign-on' },
  { id: 'scim', label: 'Directory sync (SCIM)' },
  { id: 'audit', label: 'Audit trail' },
  { id: 'limits', label: 'Current limits' },
];

const ORIGIN = 'https://aistupidlevel.info';

const VERIFY_SNIPPET = `const crypto = require('crypto');

// rawBody: the request body exactly as received, before JSON parsing.
function isFromAiStupidLevel(headers, rawBody, secret) {
  const ts = String(headers['x-asl-timestamp'] || '');      // Unix seconds
  const sig = String(headers['x-asl-signature'] || '');
  const expected = 'sha256=' +
    crypto.createHmac('sha256', secret).update(ts + '.' + rawBody).digest('hex');
  const fresh = Math.abs(Date.now() / 1000 - Number(ts)) < 300;   // reject replays
  return fresh && sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}`;

const KEY_SNIPPET = `curl ${ORIGIN}/v1/chat/completions \\
  -H "Authorization: Bearer aism_…" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "auto", "messages": [{"role": "user", "content": "Hello"}]}'`;

export default function TeamsGuidePage() {
  return (
    <DocPage
      kicker="Guide"
      title="Workspaces, projects, single sign-on and SCIM"
      lead="How to put your team on one plan, watch the models you depend on together, run each client or product as a project with its own Smart Router keys, rules and budget, see what each project and person spent, and connect your identity provider and directory."
      toc={TOC}
      actions={(
        <>
          <Link className="doc-btn is-primary" href="/account/team">Open your workspace</Link>
          <Link className="doc-btn" href="/account/security">Security settings</Link>
          <Link className="doc-btn" href="/pricing">Compare plans</Link>
        </>
      )}
    >
      <Section id="workspace" title="What a workspace is">
        <Prose>
          <p>
            A workspace puts a team under one plan and gives it things to share. The owner holds the plan; the
            editors they invite get the same plan on their own accounts — its watched-model limit, history,
            Smart Router allowance and monitoring — without paying separately.
          </p>
          <p>
            What the team shares: a <a href="#watchlist">team watchlist</a> that alerts everyone, and{' '}
            <a href="#projects">projects</a> — one per client or product — each with its own people, watchlist,
            Smart Router keys, routing rules, provider keys, budget, spend report and activity log. On Teams and
            Enterprise the workspace also adds webhooks, single sign-on, directory provisioning (SCIM) and an
            audit trail.
          </p>
          <p>
            What stays personal: each person&apos;s own watchlist, alert settings, personal Smart Router keys and
            provider keys. Only project keys are shared rules and shared reporting.
          </p>
        </Prose>
      </Section>

      <Section id="plans" title="Plans">
        <div className="doc-table-wrap is-narrow">
          <table className="doc-table">
            <thead>
              <tr><th></th><th>Developer</th><th>Teams</th><th>Enterprise</th></tr>
            </thead>
            <tbody>
              <tr><td>Editor seats, owner included</td><td>1</td><td>5</td><td>Unlimited</td></tr>
              <tr><td>Viewers</td><td>Unlimited</td><td>Unlimited</td><td>Unlimited</td></tr>
              <tr><td>Projects</td><td>1</td><td>3</td><td>Unlimited</td></tr>
              <tr><td>Models on the team watchlist, and on each project&apos;s</td><td>20</td><td>Unlimited</td><td>Unlimited</td></tr>
              <tr><td>Project keys, routing rules, budgets, reports</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
              <tr><td>Webhooks, single sign-on, SCIM, audit trail</td><td className="doc-muted">—</td><td>Yes</td><td>Yes</td></tr>
            </tbody>
          </table>
        </div>
        <Prose>
          <p>
            Free and Pro accounts cannot create a workspace, but can be invited to one. If the owner&apos;s plan
            lapses below Developer, projects become read-only and project keys pause until it is renewed.
          </p>
        </Prose>
      </Section>

      <Section id="members" title="Inviting people">
        <Prose>
          <ol>
            <li>Open <Link href="/account/team">Account → Team</Link> and create the workspace.</li>
            <li>On the <b>People</b> tab, enter the person&apos;s email address, choose <b>Viewer</b> or <b>Editor</b>,
              and send the invitation. They receive an email from AI Stupid Level with an <b>Accept invitation</b> button.</li>
            <li>They sign in — or create an account — with that same address and accept. An invitation only
              works for the address it was sent to, so a forwarded link is no use to anyone else.</li>
            <li>Add them to the projects they work on, from each project&apos;s <b>People</b> tab.</li>
          </ol>
        </Prose>
        <Facts rows={[
          ['Link lifetime', '14 days. Resend makes a new link, which restarts the 14 days and stops the old one working.'],
          ['Email did not arrive', 'Ask them to check spam, or use Copy link on the People tab and send the link yourself.'],
          ['Seats', 'An invitation for an editor holds a seat until it is accepted or withdrawn.'],
          ['Leaving and removing', 'A member can leave from the People tab. The owner can remove anyone except themselves. Either way, the person leaves every project and their project keys are revoked.'],
          ['One workspace per account', 'Someone who owns a workspace, or is in one, has to leave it before accepting an invitation to another.'],
        ]} />
      </Section>

      <Section id="roles" title="Roles">
        <Prose><p>In the workspace:</p></Prose>
        <Facts rows={[
          ['Owner', 'One per workspace: the person whose plan it is. Invites and removes people, shares provider keys with every project, sets team alerts, manages webhooks and security, reads the audit trail, and manages every project without being added to it. Uses a seat.'],
          ['Editor', 'Uses a seat and gets the workspace’s plan on their own account. Can change the team watchlist and create projects (and manages the ones they create).'],
          ['Viewer', 'Free: no seat, and no plan from the workspace. Reads the team watchlist and the projects they are added to, and gets their alerts — the role for clients and stakeholders. Sees the owner and the people they share a project with, not everyone in the workspace.'],
        ]} />
        <Prose><p>In a project:</p></Prose>
        <Facts rows={[
          ['Manager', 'Runs the project: its people, routing rules, provider keys, budget and caps, alert settings and webhooks; can rename or delete it. Needs an editor seat.'],
          ['Member (editor)', 'Holds their own project keys and edits the project watchlist. Reads the rules, budget, report and activity.'],
          ['Member (viewer)', 'Reads everything above and gets the project’s alerts. Holds no keys.'],
        ]} />
      </Section>

      <Section id="watchlist" title="Team watchlist">
        <Prose>
          <p>
            The models the whole team depends on, on the workspace page&apos;s <b>Team watchlist</b> tab. Everyone in
            the workspace sees each model&apos;s latest real score, its change over seven days, any open drift alert
            or task-level regression, and a note on why it is watched. Editors and the owner add, annotate and
            remove models; viewers read.
          </p>
          <p>
            When a model on it drops by the team&apos;s threshold (5 points unless the owner changes it) or a benchmark
            task starts failing, everyone in the workspace is emailed — the owner can narrow that to the owner and
            editors, or to webhooks only — and each person can mute the team list for themselves. See{' '}
            <a href="#alerts">Alerts</a>.
          </p>
        </Prose>
      </Section>

      <Section id="projects" title="Projects"
        lead="One per client or product. Created by the owner or an editor from the workspace page; whoever creates it manages it.">
        <Facts rows={[
          ['People', 'Who works on it, as managers or members. Only the people in a project (and the owner) can open it.'],
          ['Watchlist', 'The models this project depends on, with its own alert threshold and recipients.'],
          ['Smart Router', 'Project keys, the routing rules every key follows, and which provider keys pay. See below.'],
          ['Budget', 'A monthly budget for the project and a monthly cap per person. See below.'],
          ['Overview', 'What the project spent, who spent it, on which models, how reliably and how efficiently.'],
          ['Activity', 'Who changed what, and every request its keys made.'],
          ['Settings', 'Name and description, who sees per-person spend, the project’s own webhooks, deletion.'],
        ]} />
        <Prose>
          <p>
            Deleting a project revokes its keys and removes its provider keys, budget, watchlist and webhooks.
            Its request history stays in the workspace&apos;s records, and the deletion is in the audit trail.
          </p>
        </Prose>
      </Section>

      <Section id="keys" title="Project keys and routing rules"
        lead="A project key is a Smart Router key that follows the project’s rules and counts against its budget.">
        <Prose>
          <p>
            Each person with an editor seat in the project makes their own keys on its <b>Smart Router</b> tab, so the
            report can say who spent what. A key is shown once; it can expire after 7, 30, 90, 180 or 365 days, and
            its holder or a manager can revoke it. Use it anywhere a Smart Router key works:
          </p>
        </Prose>
        <pre className="doc-code">{KEY_SNIPPET}</pre>
        <Prose><p>The rules a manager sets, which every key in the project follows:</p></Prose>
        <Facts rows={[
          ['Strategy', 'What “auto” means: best overall, best for coding, reasoning or tool use, best value, most consistent, fastest good model, cheapest, fastest, matched to each request, or your own weighted traffic split.'],
          ['Use it for every routed request', 'Requests asking for auto-coding, auto-cheapest and so on get the project’s strategy too.'],
          ['Naming a model', 'Allowed or not. When not, requests that name a model — and /v1/messages, which always does — are refused, and everything is routed.'],
          ['Allowed models', 'Only these models, routed or named. Empty means any model we benchmark.'],
          ['Providers not used', 'Never route to, or accept requests for, these providers.'],
          ['Price and speed limits', 'Leave out models above a price per 1,000 tokens or slower than a measured latency.'],
          ['Tool calling', 'Only models that support it.'],
          ['Fallback', 'Try other models when one fails, optionally in an order you choose.'],
          ['Drifting models', 'Pass over models with an open drift alert (they are tried after the others).'],
          ['Output per request', 'A cap on output tokens for every request. Reasoning models count their thinking in it, so a low cap can leave them no room to answer.'],
          ['Rate limit', 'Requests per minute, per key.'],
          ['Prompt logging', 'Each key’s own setting, off for every key, or on for every key (encrypted, with secrets scrubbed first).'],
        ]} />
        <Prose>
          <p>The <b>Preview</b> button shows where “auto” would go right now under unsaved rules, without sending anything.</p>
          <h3>Who pays the providers</h3>
          <p>
            A provider bills whoever&apos;s key is used. For each provider a project request uses, in order: the
            project&apos;s own key for that provider (a client&apos;s account, say), the workspace&apos;s shared key (added by
            the owner on the workspace page), and — if the project allows it — the requester&apos;s own key from their
            Providers page. Shared keys are stored encrypted and shown by their last four characters; <b>Check</b>{' '}
            asks the provider whether it still accepts one.
          </p>
        </Prose>
      </Section>

      <Section id="budgets" title="Budgets and caps">
        <Facts rows={[
          ['Monthly budget', 'For the whole project, in dollars, from the 1st of each month (UTC).'],
          ['Alert only', 'Requests continue past the budget.'],
          ['Switch to the cheapest models', 'Past the budget, routed requests go to the cheapest models and requests that name a model are refused, so work continues at the lowest cost.'],
          ['Stop at the budget', 'A request that could take the month past the budget is refused with HTTP 429 and the reason, until the 1st or until the budget is raised.'],
          ['Thresholds', 'The owner and the project’s managers are emailed when spend reaches each threshold you choose (25–90%) and 100%, once per month for each — raising the budget re-arms them.'],
          ['Caps per person', 'A monthly cap for everyone in the project, with a different one per person if needed. A person at their cap is refused, whatever the budget mode, and is emailed along with the managers.'],
        ]} />
        <Prose>
          <p>
            Spend is the provider&apos;s list price for the tokens each request used — the same figure as the report.
            A request reserves its most expensive possible cost before it is sent and settles to the actual cost
            after, so many requests at once cannot run past a budget that stops at its limit. Your provider&apos;s
            invoice is the final word: discounts and caching are not included.
          </p>
        </Prose>
      </Section>

      <Section id="reports" title="Reports and activity">
        <Prose>
          <p>
            A project&apos;s <b>Overview</b> covers the last 7, 30 or 90 days, this month or last month: spend (and the change
            on the period before), requests and how many were answered, response times, cost per 1,000 tokens,
            requests saved by fallback, spend by day, and tables by person and by model — plus what the requests
            were for, whose provider keys paid, and why any failed. The workspace page adds it all up across projects,
            with a table of who works on what and what they spent in each project.
          </p>
          <h3>Who was most efficient</h3>
          <p>
            Comparing spend per request would punish whoever does the long tasks. So each person gets a <b>cost
            index</b>: their spend divided by what the same input and output tokens would have cost at the
            project&apos;s average price per input token and per output token. 1.00× is the project average; 0.60× means
            40% cheaper model choices for the same amount of work. It needs 20 answered requests, and the
            “most efficient” highlight needs two people who have them.
          </p>
          <h3>Activity</h3>
          <p>
            The <b>Activity</b> tab lists who changed what in the project — people, rules, budget, keys, provider keys,
            watchlist, webhooks — along with budget notices and change alerts, and every request its keys made (time,
            person, key, model asked for and used, tokens, cost, response time, outcome), filterable by person and
            downloadable as CSV. Prompt text is never shown there.
          </p>
          <p>
            By default everyone in a project sees each person&apos;s spend. A manager can limit that to managers, so
            that members — clients who are viewers, say — see the project&apos;s totals and their own requests only.
          </p>
        </Prose>
      </Section>

      <Section id="alerts" title="Alerts">
        <Prose>
          <p>
            Once a day (08:00, Berlin time) every watched model is checked against real measurements only: a model
            we could not measure that week is never reported as having changed. A model alerts when its score
            dropped by at least the list&apos;s threshold over seven days, or when a benchmark task started failing while
            the overall score held.
          </p>
        </Prose>
        <Facts rows={[
          ['One email per finding', 'A model on your own watchlist, the team watchlist and a project gets you one email, naming every list it is on.'],
          ['Who is emailed', 'Team list: everyone in the workspace, the owner and editors, or nobody. Project list: everyone in the project, its managers and the owner, or nobody. Your own alert settings still apply: if you turned alert emails off, team lists do not override that.'],
          ['Muting', 'Anyone can mute the team list or a project’s list for themselves, on its page.'],
          ['Weekly summary', 'The Monday summary covers your own watchlist, the team’s and your projects’, grouped by list.'],
          ['Activity', 'Each alert is recorded in the project’s activity log (or the workspace trail, for the team list).'],
        ]} />
      </Section>

      <Section id="webhooks" title="Webhooks"
        lead="Teams and Enterprise. Alerts and budget notices as signed JSON, so they reach your own tooling without anyone reading an email.">
        <Prose>
          <p>
            The owner adds a workspace-wide endpoint on the workspace page; a project&apos;s managers can add endpoints
            for that project only, in its Settings. Each is shown its signing secret once, and can be limited to the
            events you choose (none chosen means all). A workspace-wide endpoint hears about the team list, every
            project and members&apos; own watchlists; a project&apos;s endpoint hears about that project only.
          </p>
        </Prose>
        <Facts rows={[
          [<code key="e1">model.regression</code>, <span key="d1">A watched model alerted. <code>data</code>: <code>modelId</code>, <code>model</code>, <code>currentScore</code>, <code>deltaOver7d</code>, <code>openTaskRegressions</code>, <code>measuredAt</code>, <code>reason</code>, and <code>lists</code> — every list carrying the model (<code>{'{"type":"team"}'}</code>, <code>{'{"type":"project"}'}</code> with its id and name, or <code>{'{"type":"member"}'}</code> for a member&apos;s own watchlist, never naming them). Sent once per finding per endpoint.</span>],
          [<code key="e2">budget.threshold</code>, 'A project crossed one of its budget thresholds this month.'],
          [<code key="e3">budget.exceeded</code>, 'A project reached its budget, or a request was refused at it.'],
          [<code key="e4">member.cap_warning</code>, 'Someone used 80% of their monthly cap in a project.'],
          [<code key="e5">member.cap_reached</code>, 'Someone reached their cap; their requests in the project are refused.'],
          ['Budget payload', <code key="b">{'{ "project": {id, name}, "workspace": {id, name}, "month", "spendUsd", "limitUsd", "threshold", "budgetMode", "refused", "member"? }'}</code>],
          ['Headers', <span key="h"><code>X-ASL-Event</code>, <code>X-ASL-Timestamp</code> (Unix seconds), <code>X-ASL-Signature</code></span>],
          ['Signature', <span key="s"><code>sha256=</code> plus the hex HMAC-SHA256 of the timestamp, a full stop and the raw body, keyed with the endpoint&apos;s secret.</span>],
          ['Delivery', 'One attempt with a five-second timeout and no retries; the last result is shown next to each endpoint. Up to 20 endpoints per workspace and 5 per project, HTTPS only, never to private or loopback addresses.'],
        ]} />
        <Prose>
          <p>Checking a delivery in Node.js:</p>
        </Prose>
        <pre className="doc-code">{VERIFY_SNIPPET}</pre>
      </Section>

      <Section id="sso" title="Single sign-on"
        lead="Teams and Enterprise, set up by the workspace owner. Works with any OIDC or SAML 2.0 identity provider.">
        <Prose>
          <ol>
            <li>
              In your identity provider, create an application:
              <ul>
                <li><b>OIDC:</b> sign-in redirect URI <code>{ORIGIN}/api/sso/callback/oidc</code>, scopes
                  <code>openid</code>, <code>email</code> and <code>profile</code>. Copy its issuer URL, client ID
                  and client secret.</li>
                <li><b>SAML 2.0:</b> assertion consumer service (reply) URL <code>{ORIGIN}/api/sso/callback/saml</code>,
                  entity ID (audience) <code>{ORIGIN}/saml/metadata</code> — providers that import metadata can use
                  that URL — and the email address as the Name ID. Sign the assertion. Copy the sign-on URL and the
                  signing certificate.</li>
              </ul>
            </li>
            <li>Open <Link href="/account/security">Account → Security</Link>, choose the protocol, enter your
              email domain (for example <code>acme.com</code>), paste the values, choose the role new people get,
              and save.</li>
            <li>Verify the domain: add the TXT record the page shows — name <code>_asl-verification.acme.com</code>,
              value <code>asl-verification=…</code> — at your DNS host, then click <b>Verify domain</b>. A new
              record can take a few minutes to an hour to appear. If your DNS host adds the domain for you,
              enter just <code>_asl-verification</code> as the name.</li>
            <li>Switch <b>Connection enabled</b> on and save.</li>
            <li>Test it: sign out, choose <b>Continue with SSO</b> on the sign-in page and enter your work email.</li>
          </ol>
          <h3>Where the values are</h3>
        </Prose>
        <Facts rows={[
          ['Okta', <span key="o">An OIDC web app. The issuer is your authorization server, for example <code>https://acme.okta.com/oauth2/default</code>.</span>],
          ['Microsoft Entra ID', <span key="m">Register an app with a Web redirect URI and add a client secret. The issuer is <code>https://login.microsoftonline.com/&lt;tenant-id&gt;/v2.0</code>. Add the optional <code>email</code> claim to the ID token (Token configuration).</span>],
          ['Google Workspace', <span key="g">An OAuth client of type Web application in Google Cloud. The issuer is <code>https://accounts.google.com</code>.</span>],
        ]} />
        <Prose>
          <h3>What changes once it is on</h3>
        </Prose>
        <Facts rows={[
          ['Signing in', 'People whose email is in your domain sign in through your identity provider; password and Google/GitHub sign-ins are refused for them. The owner keeps password sign-in, so a broken provider cannot lock out the one person who can fix it.'],
          ['New people', 'With “Create accounts on first sign-in” on, someone without an account gets one at first sign-in and joins with the role you chose. With it off, only existing accounts can sign in.'],
          ['Existing accounts', 'An account with the same email is used as it is, and joins the workspace at its first SSO sign-in.'],
          ['Domain already claimed', 'If another workspace saved your domain without verifying it, publish your record and save again: the domain moves to you. A verified domain stays with its workspace.'],
        ]} />
      </Section>

      <Section id="scim" title="Directory sync (SCIM)"
        lead="Teams and Enterprise. Lets your directory add people and, more importantly, remove them the moment they leave.">
        <Prose>
          <ol>
            <li>On the <Link href="/account/security">Security</Link> page, create a SCIM token. It is shown once.</li>
            <li>In your identity provider&apos;s provisioning settings, enter the base URL
              <code>{ORIGIN}/api/scim/v2</code> and the token as an HTTP bearer token.</li>
            <li>Map the user name to the person&apos;s email address.</li>
          </ol>
        </Prose>
        <Facts rows={[
          ['Supported', <span key="s">Users: create, read, list (filtered by <code>userName eq &quot;…&quot;</code>), update and deactivate — PUT, PATCH of <code>active</code>, and DELETE.</span>],
          ['New people', 'Join as viewers. Change their role on the Team page.'],
          ['Deactivating', 'Switches the membership off: the person loses access to the workspace and its plan, and cannot sign in through single sign-on. Nothing is deleted, so reactivating restores them.'],
          ['Groups', 'Not supported, and the service-provider configuration says so.'],
          ['Tokens', 'Revoke one at any time on the Security page.'],
        ]} />
      </Section>

      <Section id="audit" title="Audit trail">
        <Prose>
          <p>
            On Teams and Enterprise the owner can read the workspace&apos;s audit trail on the Security page and
            download the latest 200 entries as CSV. Each entry records the time, who acted, what changed, and
            the IP address and browser it came from. It covers the workspace, invitations and members, the team
            watchlist and alert settings, projects and their people, watchlists, keys, routing rules, provider
            keys, budgets and caps, webhooks, budget notices and change alerts, the single sign-on connection and
            its domain verification, SSO sign-ins and the accounts they create, SCIM tokens and SCIM changes.
            A project&apos;s own entries also appear on its Activity tab, without addresses.
          </p>
          <p className="doc-muted">
            Entries recorded before 6 October 2026 show our own server&apos;s address and agent instead of the
            person&apos;s.
          </p>
        </Prose>
      </Section>

      <Section id="limits" title="Current limits">
        <Prose>
          <ul>
            <li>An account belongs to one workspace at a time.</li>
            <li>Viewers do not get the workspace&apos;s plan and cannot hold project keys.</li>
            <li>Ten active keys per person per project, two hundred per project.</li>
            <li>Spend is estimated from list prices and token counts, not read from your provider&apos;s invoice.</li>
            <li>When a directory deactivates someone, their project keys stop working within 30 seconds.</li>
            <li>Webhooks are sent once, without retries.</li>
            <li>SCIM covers users, not groups.</li>
            <li>SAML: we do not sign authentication requests, assertions must be signed, and sign-in starts from
              our sign-in page (not from your provider&apos;s app launcher).</li>
          </ul>
        </Prose>
      </Section>
    </DocPage>
  );
}
