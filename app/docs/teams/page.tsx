import type { Metadata } from 'next';
import Link from 'next/link';
import { DocPage, Section, Prose, Facts } from '@/components/docs/Doc';

export const metadata: Metadata = {
  title: 'Workspaces, single sign-on and SCIM | Setup guide',
  description:
    'How to set up a team workspace on AI Stupid Level: invite people, roles, webhooks, single sign-on over OIDC or SAML with DNS domain verification, SCIM provisioning and the audit trail.',
  alternates: { canonical: '/docs/teams' },
};

/**
 * The setup guide the Team and Security pages link to ("How workspaces work", "How to set
 * these up"). Every statement here describes code that exists: when a feature changes, change
 * this page with it — /account/team and /account/security send people here.
 */
const TOC = [
  { id: 'workspace', label: 'What a workspace is' },
  { id: 'plans', label: 'Plans' },
  { id: 'members', label: 'Inviting people' },
  { id: 'roles', label: 'Roles' },
  { id: 'projects', label: 'Projects' },
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

export default function TeamsGuidePage() {
  return (
    <DocPage
      kicker="Guide"
      title="Workspaces, single sign-on and SCIM"
      lead="How to put your team on one plan, invite people, send alerts to your own tools, connect your identity provider and let your directory manage who has access."
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
            A workspace puts a team under one plan. The owner holds the plan; the editors they invite
            get the same plan on their own accounts — its watched-model limit, history, Smart Router
            allowance and monitoring — without paying separately. On Teams and Enterprise the workspace
            also adds webhooks, single sign-on, directory provisioning (SCIM) and an audit trail.
          </p>
          <p>
            Each person keeps their own watchlist, keys and alert settings: a workspace shares the plan
            and the administration, not the data.
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
              <tr><td>Webhooks, single sign-on, SCIM, audit trail</td><td className="doc-muted">—</td><td>Yes</td><td>Yes</td></tr>
            </tbody>
          </table>
        </div>
        <Prose>
          <p>Free and Pro accounts cannot create a workspace, but can be invited to one.</p>
        </Prose>
      </Section>

      <Section id="members" title="Inviting people">
        <Prose>
          <ol>
            <li>Open <Link href="/account/team">Account → Team</Link> and create the workspace.</li>
            <li>Enter the person&apos;s email address, choose <b>Viewer</b> or <b>Editor</b>, and send the
              invitation. They receive an email from AI Stupid Level with an <b>Accept invitation</b> button.</li>
            <li>They sign in — or create an account — with that same address and accept. An invitation only
              works for the address it was sent to, so a forwarded link is no use to anyone else.</li>
          </ol>
        </Prose>
        <Facts rows={[
          ['Link lifetime', '14 days. Resend makes a new link, which restarts the 14 days and stops the old one working.'],
          ['Email did not arrive', 'Ask them to check spam, or use Copy link on the Team page and send the link yourself.'],
          ['Seats', 'An invitation for an editor holds a seat until it is accepted or withdrawn.'],
          ['Leaving and removing', 'A member can leave from the Team page. The owner can remove anyone except themselves.'],
          ['One workspace per account', 'Someone who owns a workspace, or is in one, has to leave it before accepting an invitation to another.'],
        ]} />
      </Section>

      <Section id="roles" title="Roles">
        <Facts rows={[
          ['Owner', 'One per workspace: the person whose plan it is. Invites and removes people, manages webhooks and security, and reads the audit trail. Uses a seat.'],
          ['Editor', 'Uses a seat and gets the workspace’s plan on their own account. Can add and delete projects.'],
          ['Viewer', 'Free: no seat. Can open the workspace page and see its members, projects and webhooks. Does not get the workspace’s plan.'],
        ]} />
      </Section>

      <Section id="projects" title="Projects">
        <Prose>
          <p>
            Projects are names for organising your team&apos;s work — one per client, say. Today they are
            labels only: watchlists, Smart Router keys and reports are not yet scoped to a project, and
            creating one changes nothing else.
          </p>
        </Prose>
      </Section>

      <Section id="webhooks" title="Webhooks"
        lead="Teams and Enterprise. Alerts as signed JSON, so they reach your own tooling without anyone reading an email.">
        <Prose>
          <p>
            The owner adds an HTTPS endpoint on the Team page and is shown its signing secret once. We send
            a <code>POST</code> to it when a model on any member&apos;s watchlist triggers a regression alert —
            the same check as the alert emails, which runs once a day.
          </p>
        </Prose>
        <Facts rows={[
          ['Event', <code key="e">model.regression</code>],
          ['Body', <code key="b">{'{ "event", "sentAt", "data": { "modelId", "model", "currentScore", "deltaOver7d", "openTaskRegressions", "measuredAt", "reason" } }'}</code>],
          ['Headers', <span key="h"><code>X-ASL-Event</code>, <code>X-ASL-Timestamp</code> (Unix seconds), <code>X-ASL-Signature</code></span>],
          ['Signature', <span key="s"><code>sha256=</code> plus the hex HMAC-SHA256 of the timestamp, a full stop and the raw body, keyed with the endpoint&apos;s secret.</span>],
          ['Delivery', 'One attempt with a five-second timeout and no retries; the Team page shows the last result. Up to 10 endpoints, HTTPS only, and never to private or loopback addresses.'],
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
            the IP address and browser it came from. It covers the workspace, invitations and members, projects,
            webhooks, the single sign-on connection and its domain verification, SSO sign-ins and the accounts
            they create, SCIM tokens and SCIM changes.
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
            <li>Projects are labels; nothing is scoped to them yet.</li>
            <li>Viewers can see the workspace page but do not get its plan.</li>
            <li>Webhooks carry regression alerts only, sent once without retries.</li>
            <li>SCIM covers users, not groups.</li>
            <li>SAML: we do not sign authentication requests, assertions must be signed, and sign-in starts from
              our sign-in page (not from your provider&apos;s app launcher).</li>
          </ul>
        </Prose>
      </Section>
    </DocPage>
  );
}
