/**
 * Email Service for Password Reset
 * Uses nodemailer with SMTP configuration
 */

import nodemailer from 'nodemailer';

// Email configuration from environment variables
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@aistupidlevel.info';

/**
 * Create email transporter
 */
function createTransporter() {
  // For localhost (postfix), no authentication needed
  if (SMTP_HOST === 'localhost' || SMTP_HOST === '127.0.0.1') {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  
  // For external SMTP servers, use authentication
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

/**
 * Send password reset email
 */
/**
 * Password reset.
 *
 * Signature and return shape are unchanged — forgot-password/route.ts checks
 * `success` and returns a 500 to the user when sending fails, so unlike the
 * welcome and receipt mails this one is NOT fire-and-forget.
 *
 * Reformatted 2026-09-09 onto the shared renderEmail layout. The previous
 * version was neon green on a near-black background in Courier: several clients
 * invert that badly in dark mode, Outlook renders it poorly, and heavy styling
 * with a low text-to-markup ratio costs deliverability points on the one message
 * a locked-out user genuinely needs to receive.
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
  resetLink: string
): Promise<{ success: boolean; error?: string }> {
  return deliver(
    email,
    'Reset your AI Stupid Level password',
    renderEmail({
      heading: 'Reset your password',
      preheader: 'Choose a new password. The link is valid for one hour.',
      intro:
        'We received a request to reset the password for your AI Stupid Level account. Choose a ' +
        'new one using the button below. The link is valid for one hour and works once.',
      ctaLabel: 'Choose a new password',
      ctaUrl: resetLink,
      footnote:
        linkFallback(resetLink) +
        '<br><br>If you did not ask for this, you can ignore this email: your password will not ' +
        'change until the link above is used. Never share the link with anyone; it grants access ' +
        'to your account.',
    }),
    `Reset your AI Stupid Level password\n\n` +
    `We received a request to reset the password for your AI Stupid Level account.\n` +
    `Open the link below to choose a new one. It is valid for one hour and works once.\n\n` +
    `${resetLink}\n\n` +
    `If you did not ask for this you can ignore this email — your password will not\n` +
    `change until the link is used. Never share this link with anyone.\n`
  );
}

export async function verifyEmailConfig(): Promise<boolean> {
  try {
    if (!SMTP_USER || !SMTP_PASS) {
      return false;
    }

    const transporter = createTransporter();
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('[EMAIL] SMTP configuration error:', error);
    return false;
  }
}

// ─── Transactional emails ────────────────────────────────────────────────────

/** The ASL mark from the site header, transparent, legible on light and dark. */
const LOGO_URL = 'https://aistupidlevel.info/asl-mark.png';
const SITE = 'https://aistupidlevel.info';
const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

/**
 * Shared layout for customer-facing mail: the official look, as approved for the
 * 2026-09-25 research invite (admin/mail/research-invite.js). A #f6f8fc page, a
 * white 560px card, system fonts, one blue, the ASL mark linked to the site, a
 * details table, one button, a grey footer. No tracking pixel. The logo carries
 * alt text, so the brand still shows when a client blocks images.
 *
 * `preheader` is the line inboxes show beside the subject; without it they show
 * the first text in the body, which here would be the logo's alt text.
 *
 * Every message ships a text/plain alternative. A missing plain-text part is one
 * of the cheapest spam points to give away.
 */
function renderEmail(opts: {
  heading: string;
  intro: string;
  rows?: Array<[string, string]>;
  /** Further paragraphs, after the details table. */
  paragraphs?: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
  preheader?: string;
  signoff?: boolean;
}): string {
  const { heading, intro, rows = [], paragraphs = [], ctaLabel, ctaUrl, footnote, preheader, signoff } = opts;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${heading}</title></head>
<body style="margin:0;padding:0;background:#f6f8fc;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f6f8fc;font-size:1px;line-height:1px;">${preheader}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e6ea;border-radius:6px;">
        <tr><td style="padding:24px 28px;font-family:${FONT};color:#202124;">
          <a href="${SITE}" style="text-decoration:none;"><img src="${LOGO_URL}" width="104" height="22" alt="AI Stupid Level" style="display:block;border:0;outline:none;height:22px;width:104px;font-size:13px;font-weight:600;color:#1a73e8;"></a>
          <h1 style="font-size:19px;line-height:1.35;margin:20px 0 10px;font-weight:600;color:#202124;">${heading}</h1>
          <p style="font-size:14px;line-height:1.65;color:#3c4043;margin:0 0 16px;">${intro}</p>
          ${rows.length ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px;margin:0 0 20px;">
            ${rows.map(([k, v]) => `<tr>
              <td style="padding:7px 0;color:#5f6368;border-bottom:1px solid #eceff1;">${k}</td>
              <td style="padding:7px 0;text-align:right;font-weight:600;color:#202124;border-bottom:1px solid #eceff1;">${v}</td>
            </tr>`).join('')}
          </table>` : ''}
          ${paragraphs.map(p => `<p style="font-size:14px;line-height:1.65;color:#3c4043;margin:0 0 16px;">${p}</p>`).join('')}
          ${ctaLabel && ctaUrl ? `<p style="margin:0 0 18px;">
            <a href="${ctaUrl}" style="display:inline-block;background:#1a73e8;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:4px;font-size:14px;font-weight:600;">${ctaLabel}</a>
          </p>` : ''}
          ${signoff ? `<p style="font-size:14px;line-height:1.65;color:#3c4043;margin:0 0 18px;">Thank you,<br>The AI Stupid Level team</p>` : ''}
          ${footnote ? `<p style="font-size:12.5px;line-height:1.6;color:#5f6368;margin:0;">${footnote}</p>` : ''}
        </td></tr>
        <tr><td style="padding:14px 28px 22px;font-family:${FONT};font-size:11.5px;line-height:1.6;color:#80868b;border-top:1px solid #eceff1;">
          AI Stupid Level &middot; independent AI model benchmarking<br>
          <a href="${SITE}" style="color:#1a73e8;text-decoration:none;">aistupidlevel.info</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** A link a reader can copy when the button does not work. */
function linkFallback(url: string): string {
  return 'If the button does not work, paste this into your browser:<br>' +
    `<a href="${url}" style="word-break:break-all;color:#1a73e8;text-decoration:none;">${url}</a>`;
}

/** The sender for mail a customer may want to answer: it reaches a person (the noreply@ default does not invite replies). */
const HELLO = 'hello@aistupidlevel.info';

async function deliver(to: string, subject: string, html: string, text: string, replyTo?: string, from = SMTP_FROM) {
  try {
    const isLocalhost = SMTP_HOST === 'localhost' || SMTP_HOST === '127.0.0.1';
    if (!isLocalhost && (!SMTP_USER || !SMTP_PASS)) {
      console.error('[EMAIL] SMTP credentials not configured');
      return { success: false, error: 'Email service not configured' };
    }
    await createTransporter().sendMail({
      from: `"AI Stupid Level" <${from}>`,
      // Never put the sender's address in From: — we are not authorised to sign
      // for their domain, and DMARC-protected senders would fail outright.
      // Reply-To is the correct header for "answer this person".
      ...(replyTo ? { replyTo } : {}),
      to, subject, html, text,
    });
    return { success: true };
  } catch (error: any) {
    // A failed email must never break signup or checkout. Log and move on.
    console.error(`[EMAIL] "${subject}" to ${to} failed:`, error?.message || error);
    return { success: false, error: error?.message || 'Send failed' };
  }
}

/**
 * Sent once, immediately after an account is created.
 *
 * Password sign-ups get it with a confirmation link: since 2026-10-04 they must confirm
 * their email before they can sign in, so this email is how the account is finished.
 * Google and GitHub sign-ups get it without one, because the provider has already
 * verified the address.
 */
export async function sendWelcomeEmail(email: string, name?: string | null, verifyLink?: string | null) {
  const hello = name ? `Hi ${esc(name)},` : '';
  // Short enough that every row stays on one line on a phone.
  const rows: Array<[string, string]> = [
    ['Tracked models', '3 on the free plan'],
    ['Weekly summary', 'Every Monday'],
    ['Change alerts', 'When a model moves'],
  ];
  if (verifyLink) {
    return deliver(
      email,
      'Welcome to AI Stupid Level: confirm your email',
      renderEmail({
        heading: 'Confirm your email to finish signing up',
        preheader: 'One click and your account is ready.',
        intro:
          `${hello ? `${hello} w` : 'W'}elcome to AI Stupid Level. Confirm your email address to activate your ` +
          `account; it takes one click. Then choose the models your work depends on, and we will ` +
          `tell you when their measured performance changes, and just as usefully when it does not.`,
        rows,
        ctaLabel: 'Confirm my email',
        ctaUrl: verifyLink,
        signoff: true,
        footnote:
          linkFallback(verifyLink) +
          '<br><br>The link is valid for 24 hours. If you did not create an account, you can ignore ' +
          'this email and nothing will happen.',
      }),
      `${name ? `Hi ${name},\n\n` : ''}Welcome to AI Stupid Level. Confirm your email address to activate your account:\n\n` +
      `${verifyLink}\n\n` +
      `Then choose the models your work depends on, and we will tell you when their measured\n` +
      `performance changes, and when it does not.\n\n` +
      rows.map(([k, v]) => `  ${k}: ${v}`).join('\n') + '\n\n' +
      `The link is valid for 24 hours. If you did not create an account, ignore this email.\n\n` +
      `Thank you,\nThe AI Stupid Level team\n${SITE}\n`
    );
  }
  return deliver(
    email,
    'Welcome to AI Stupid Level',
    renderEmail({
      heading: 'Welcome to AI Stupid Level',
      preheader: 'Choose the models you depend on, and we will watch them for you.',
      intro:
        `${hello ? `${hello} y` : 'Y'}our account is ready. The fastest way to get value from it is to choose ` +
        `the models your work depends on. We will tell you when their measured performance changes, ` +
        `and just as usefully when it does not.`,
      rows,
      ctaLabel: 'Choose your models',
      ctaUrl: `${SITE}/watchlist`,
      signoff: true,
      footnote:
        'You can turn off the weekly summary and alerts any time in your ' +
        `<a href="${SITE}/account/settings" style="color:#1a73e8;text-decoration:none;">account settings</a>. ` +
        'We never sell your data and take no money from any model provider.',
    }),
    `${name ? `Hi ${name},\n\n` : ''}Your AI Stupid Level account is ready.\n\n` +
    `Choose the models your work depends on and we will tell you when their measured\n` +
    `performance changes, and when it does not:\n${SITE}/watchlist\n\n` +
    rows.map(([k, v]) => `  ${k}: ${v}`).join('\n') + '\n\n' +
    `You can turn off the summary and alerts any time in your account settings:\n${SITE}/account/settings\n\n` +
    `Thank you,\nThe AI Stupid Level team\n${SITE}\n`
  );
}

/** Sent on checkout.session.completed. */
export async function sendPurchaseConfirmationEmail(
  email: string,
  opts: { planLabel: string; amount: string; interval: string; trialEnds?: string | null },
) {
  const rows: Array<[string, string]> = [
    ['Plan', opts.planLabel],
    ['Price', `${opts.amount} / ${opts.interval}`],
  ];
  // Being explicit about the first charge date is the single biggest driver of
  // "I didn't expect this" refund requests. State it plainly.
  if (opts.trialEnds) rows.push(['First charge', opts.trialEnds]);

  const intro = opts.trialEnds
    ? `Your ${opts.planLabel} trial has started. You will not be charged until the date below, and you can cancel before then from the billing portal without paying anything.`
    : `Your ${opts.planLabel} subscription is active. Here is what you bought.`;

  return deliver(
    email,
    `Your AI Stupid Level ${opts.planLabel} subscription`,
    renderEmail({
      heading: opts.trialEnds ? 'Your trial has started' : 'Subscription confirmed',
      intro,
      rows,
      ctaLabel: 'Open your dashboard',
      ctaUrl: 'https://aistupidlevel.info/watchlist',
      footnote:
        'Manage or cancel your subscription any time from your account settings. ' +
        'Provider inference is billed separately by your own AI providers — we never mark it up.',
    }),
    `${intro}\n\n` + rows.map(([k, v]) => `  ${k}: ${v}`).join('\n') +
    `\n\nDashboard: https://aistupidlevel.info/watchlist\n` +
    `Manage or cancel any time in your account settings.\n`
  );
}

/** Sent from the trial_will_end webhook, three days before the first charge. */
export async function sendTrialEndingEmail(
  email: string,
  opts: { planLabel: string; amount: string; chargeDate: string },
) {
  return deliver(
    email,
    `Your ${opts.planLabel} trial ends in 3 days`,
    renderEmail({
      heading: 'Your trial ends in three days',
      intro:
        `On ${opts.chargeDate} your ${opts.planLabel} plan will renew at ${opts.amount}. ` +
        `No action is needed if you want to continue. If it has not been useful, cancel before ` +
        `then and you will not be charged.`,
      rows: [
        ['Plan', opts.planLabel],
        ['Renews on', opts.chargeDate],
        ['Amount', opts.amount],
      ],
      ctaLabel: 'Review your account',
      ctaUrl: `${SITE}/account/billing`,
      footnote:
        'We would rather you cancelled than paid for something you are not using — ' +
        'if it is not earning its place, tell us what was missing.',
    }),
    `Your ${opts.planLabel} trial ends on ${opts.chargeDate}, when it renews at ${opts.amount}.\n\n` +
    `No action is needed to continue. To cancel before being charged:\n` +
    `${SITE}/account/billing\n`
  );
}

/**
 * A renewal charge failed. Sent once per unpaid invoice (lib/billing-watch.ts), on the first
 * failure: Stripe keeps retrying, and cancels the subscription if every retry fails.
 */
export async function sendPaymentFailedEmail(
  email: string,
  opts: { planLabel: string; amount: string; nextAttempt: string | null },
) {
  const retry = opts.nextAttempt ? `We will try again on ${opts.nextAttempt}. ` : '';
  return deliver(
    email,
    'Your AI Stupid Level payment did not go through',
    renderEmail({
      heading: 'Your payment did not go through',
      preheader: 'Update your payment method to keep your subscription.',
      intro:
        `We could not collect the payment for your ${opts.planLabel} subscription. ${retry}` +
        `If the payment keeps failing, your subscription will be cancelled and your account will move to the free plan. ` +
        `To keep it, update your payment method.`,
      rows: [
        ['Plan', opts.planLabel],
        ['Amount due', opts.amount],
        ...(opts.nextAttempt ? [['Next attempt', opts.nextAttempt] as [string, string]] : []),
      ],
      ctaLabel: 'Update payment method',
      ctaUrl: `${SITE}/account/billing`,
      footnote: `If you meant to stop, you do not need to do anything. Questions: <a href="${SITE}/contact" style="color:#1a73e8;text-decoration:none;">contact us</a>.`,
    }),
    `We could not collect the payment for your ${opts.planLabel} subscription (${opts.amount}). ${retry}` +
    `If the payment keeps failing, your subscription will be cancelled and your account will move to the free plan.\n\n` +
    `Update your payment method: ${SITE}/account/billing\n`
  );
}

/** The subscription was cancelled because its payments failed (lib/billing-watch.ts). */
export async function sendSubscriptionCancelledUnpaidEmail(email: string, opts: { planLabel: string }) {
  return deliver(
    email,
    'Your AI Stupid Level subscription has been cancelled',
    renderEmail({
      heading: 'There is a problem with your billing',
      preheader: 'Your subscription has been cancelled.',
      intro:
        `We could not collect the payment for your ${opts.planLabel} subscription, so it has been cancelled ` +
        `and your account is now on the free plan. Your account, watchlist and settings are unchanged, ` +
        `and you can subscribe again at any time.`,
      ctaLabel: 'See plans',
      ctaUrl: `${SITE}/pricing`,
      footnote: `If you think this is a mistake, <a href="${SITE}/contact" style="color:#1a73e8;text-decoration:none;">contact us</a>.`,
    }),
    `We could not collect the payment for your ${opts.planLabel} subscription, so it has been cancelled ` +
    `and your account is now on the free plan. You can subscribe again at any time:\n${SITE}/pricing\n`
  );
}

/**
 * The original $4.99 Pro subscription moves to the current Pro price after its twelve months
 * (lib/billing-watch.ts). Sent at least 30 days before the first charge at $12, as the terms
 * promise, from hello@ so a reply reaches a person. Keeping the subscription takes nothing; the
 * cancel link (lib/cancel-link.ts) opens a page that asks before anything is cancelled.
 */
export async function sendLegacyPriceChangeEmail(
  email: string,
  opts: { started: string; changes: string; cancelUrl: string },
) {
  const link = (href: string, label: string) => `<a href="${href}" style="color:#1a73e8;font-weight:600;">${label}</a>`;
  return deliver(
    email,
    'Your AI Stupid Level subscription price is changing',
    renderEmail({
      heading: 'Your subscription is moving to $12 a month',
      preheader: `From ${opts.changes}. To keep your subscription, you do not need to do anything.`,
      intro:
        `Thank you for being one of our first subscribers. You joined on ${opts.started} at our original price of ` +
        `$4.99 a month, which covers your first 12 months. From your renewal on ${opts.changes}, your Pro ` +
        `subscription moves to our current Pro price of $12 a month.`,
      rows: [
        ['Plan', 'Pro'],
        ['Your price now', '$4.99 a month'],
        [`From ${opts.changes}`, '$12 a month'],
      ],
      paragraphs: [
        `To keep your subscription, you do not need to do anything. It renews on the same payment method, and ` +
        `your account, watchlist and alerts stay as they are. Everything Pro includes is on our ${link(`${SITE}/pricing`, 'pricing page')}.`,
        `If you would rather not continue, you can ${link(opts.cancelUrl, 'cancel your subscription')} at any time ` +
        `before ${opts.changes}. You will not be charged again, and you keep full access until the end of the ` +
        `period you have already paid for.`,
      ],
      signoff: true,
      footnote: 'Questions about this change? Reply to this email and we will help.',
    }),
    `Thank you for being one of our first subscribers. You joined on ${opts.started} at our original price of ` +
    `$4.99 a month, which covers your first 12 months. From your renewal on ${opts.changes}, your Pro subscription ` +
    `moves to our current Pro price of $12 a month.\n\n` +
    `To keep your subscription, you do not need to do anything. It renews on the same payment method, and your ` +
    `account, watchlist and alerts stay as they are. Everything Pro includes: ${SITE}/pricing\n\n` +
    `If you would rather not continue, you can cancel your subscription at any time before ${opts.changes}. ` +
    `You will not be charged again, and you keep full access until the end of the period you have already paid for:\n` +
    `${opts.cancelUrl}\n\n` +
    `Questions about this change? Reply to this email and we will help.\n\n` +
    `Thank you,\nThe AI Stupid Level team\n`,
    undefined,
    HELLO,
  );
}

/** Confirm-your-address link, sent again on request (sign-in page, sign-up page, settings). */
export async function sendVerificationEmail(email: string, verifyLink: string) {
  return deliver(
    email,
    'Confirm your email address',
    renderEmail({
      heading: 'Confirm your email address',
      preheader: 'One click to finish setting up your account.',
      intro:
        'Here is a new link to confirm your email address and finish setting up your AI Stupid ' +
        'Level account. It takes one click.',
      ctaLabel: 'Confirm my email',
      ctaUrl: verifyLink,
      footnote:
        linkFallback(verifyLink) +
        '<br><br>The link is valid for 24 hours, and any earlier link no longer works. If you did ' +
        'not create an account, you can ignore this email.',
    }),
    `Confirm your email address\n\n` +
    `Open this link to confirm your email and finish setting up your AI Stupid Level account:\n\n` +
    `${verifyLink}\n\n` +
    `The link is valid for 24 hours, and any earlier link no longer works.\n` +
    `If you did not create an account, ignore this email.\n`
  );
}


/** Sent once an account has been deleted (app/api/account/delete), to the address it had. */
export async function sendAccountDeletedEmail(email: string) {
  // Short labels, so every row stays on one line on a phone.
  const rows: Array<[string, string]> = [
    ['Watchlist and alerts', 'Deleted'],
    ['Smart Router data', 'Deleted'],
    ['Data API keys', 'Deleted'],
    ['Forum posts', 'Shown as “Deleted user”'],
  ];
  return deliver(
    email,
    'Your AI Stupid Level account has been deleted',
    renderEmail({
      heading: 'Your account has been deleted',
      preheader: 'Your account and the data linked to it are gone.',
      intro:
        'As you asked, we have deleted your AI Stupid Level account and the data linked to it. You will ' +
        'not receive any more email from us, and you can create a new account with this address at any time.',
      rows,
      signoff: true,
      footnote:
        'We keep only what we must: invoices for past payments (held by Stripe, our payment provider) ' +
        'and any messages you sent us. If you did not ask for this, reply to this email straight away.',
    }),
    `Your AI Stupid Level account has been deleted.\n\n` +
    `As you asked, we have deleted your account and the data linked to it. You will not receive any\n` +
    `more email from us, and you can create a new account with this address at any time.\n\n` +
    rows.map(([k, v]) => `  ${k}: ${v}`).join('\n') + '\n\n' +
    `We keep only what we must: invoices for past payments (held by Stripe) and any messages you sent us.\n` +
    `If you did not ask for this, reply to this email straight away.\n\n` +
    `Thank you,\nThe AI Stupid Level team\n${SITE}\n`,
    CONTACT_INBOX,
  );
}


// ─── Contact form ────────────────────────────────────────────────────────────

/**
 * Where public enquiries are routed.
 *
 * NOTE ON THE ADDRESS: components/EnterpriseContact.tsx has carried
 * `ionutvisan@studioplatforms.eu` (with the "t") since it was written, and that
 * is used as the default here. The brief for this form said "ionuvisan", one
 * letter shorter. Rather than guess in a way that fails silently — a wrong
 * address means sales enquiries bounce into nothing and nobody finds out — the
 * value is overridable without a deploy. Set CONTACT_INBOX in .env.local if the
 * shorter spelling is the correct one.
 */
export const CONTACT_INBOX = process.env.CONTACT_INBOX || 'ionutvisan@studioplatforms.eu';

const TOPIC_LABEL: Record<string, string> = {
  general: 'General enquiry',
  enterprise: 'Enterprise',
  sales: 'Sales and pricing',
  support: 'Support',
  security: 'Security',
  press: 'Press',
};

/** HTML-escape untrusted text before it goes into an email body. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Tell the operator that someone got in touch.
 *
 * Reply-To is the sender, so answering is one keystroke. The body carries
 * everything needed to reply without opening the database.
 */
export async function sendContactNotification(msg: {
  id: number;
  name?: string | null;
  email: string;
  company?: string | null;
  topic: string;
  message: string;
  accountPlan?: string | null;
}) {
  const label = TOPIC_LABEL[msg.topic] ?? msg.topic;
  const rows: Array<[string, string]> = [
    ['From', esc(msg.name ? `${msg.name} <${msg.email}>` : msg.email)],
    ['Topic', esc(label)],
  ];
  if (msg.company) rows.push(['Company', esc(msg.company)]);
  if (msg.accountPlan) rows.push(['Account', esc(msg.accountPlan)]);
  rows.push(['Reference', `#${msg.id}`]);

  const text =
    `New ${label.toLowerCase()} enquiry (#${msg.id})\n\n` +
    `From: ${msg.name ? `${msg.name} <${msg.email}>` : msg.email}\n` +
    (msg.company ? `Company: ${msg.company}\n` : '') +
    (msg.accountPlan ? `Account: ${msg.accountPlan}\n` : '') +
    `\n${msg.message}\n`;

  return deliver(
    CONTACT_INBOX,
    `[${label}] ${msg.name || msg.email} — AI Stupid Level`,
    renderEmail({
      heading: `New ${label.toLowerCase()} enquiry`,
      intro: `<span style="white-space:pre-wrap;">${esc(msg.message)}</span>`,
      rows,
      ctaLabel: 'Reply',
      ctaUrl: `mailto:${msg.email}`,
      footnote: `Stored as contact_messages #${msg.id}. Reply to this email to answer ${esc(msg.email)} directly.`,
    }),
    text,
    msg.email,
  );
}

/**
 * Confirm receipt to the person who wrote in.
 *
 * Deliberately does not echo their message back: a form that mails an
 * attacker-controlled body to an arbitrary address is a spam relay, and the
 * value of the acknowledgement is the promise of a reply, not a transcript.
 */
export async function sendContactAcknowledgement(to: string, name?: string | null, topic = 'general') {
  const label = TOPIC_LABEL[topic] ?? 'enquiry';
  const who = name ? `${name}, thanks` : 'Thanks';
  return deliver(
    to,
    'We have your message — AI Stupid Level',
    renderEmail({
      heading: 'Thanks for getting in touch',
      intro:
        `${who} for writing to us. Your ${label.toLowerCase()} has reached a person, not a queue — ` +
        `we answer every message ourselves, usually within one business day.`,
      footnote:
        'If it is urgent, replying to this email adds to the same thread. ' +
        'You are receiving this because you used the contact form on aistupidlevel.info.',
    }),
    `Thanks for getting in touch.\n\nYour message has reached a person, not a queue — we answer ` +
    `every message ourselves, usually within one business day.\n\nAI Stupid Level\nhttps://aistupidlevel.info\n`,
  );
}

/** Tell the operator about a newly PAID workload assessment. Sent once, when payment is confirmed. */
export async function sendAssessmentNotification(req: {
  id: number;
  contactEmail: string;
  company?: string | null;
  workload: string;
  candidateModels?: string | null;
  taskCount?: number | null;
  amount: string;
}) {
  const rows: Array<[string, string]> = [['From', esc(req.contactEmail)]];
  if (req.company) rows.push(['Company', esc(req.company)]);
  if (req.candidateModels) rows.push(['Candidate models', esc(req.candidateModels)]);
  if (req.taskCount) rows.push(['Tasks', String(req.taskCount)]);
  rows.push(['Paid', esc(req.amount)]);
  rows.push(['Reference', `#${req.id}`]);

  return deliver(
    CONTACT_INBOX,
    `[Assessment — paid] ${req.company || req.contactEmail} — AI Stupid Level`,
    renderEmail({
      heading: 'New paid workload assessment',
      intro: `<span style="white-space:pre-wrap;">${esc(req.workload)}</span>`,
      rows,
      ctaLabel: 'Reply to the customer',
      ctaUrl: `mailto:${req.contactEmail}`,
      footnote:
        `Stored as assessment_requests #${req.id}, status "paid". The customer was promised a scope ` +
        `confirmation within two business days — or a full refund (Stripe dashboard) if the workload ` +
        `cannot be measured.`,
    }),
    `New paid workload assessment (#${req.id}, ${req.amount})\n\nFrom: ${req.contactEmail}\n` +
    (req.company ? `Company: ${req.company}\n` : '') +
    `\n${req.workload}\n\nConfirm scope within two business days, or refund in full.\n`,
    req.contactEmail,
  );
}

/** Confirm a Smart Router top-up. */
export async function sendRouterCreditsConfirmation(to: string, opts: { requests: number; amountCents: number }) {
  const amount = `$${(opts.amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: opts.amountCents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
  const rows: Array<[string, string]> = [
    ['Paid', amount],
    ['Added', `${opts.requests.toLocaleString('en-US')} Smart Router requests`],
    ['Used', 'Only after your plan’s monthly allowance, one per successful request'],
    ['Expiry', 'Credits do not expire'],
  ];
  const intro = 'Thank you — your Smart Router top-up has been added to your account.';
  return deliver(
    to,
    'Your Smart Router credits — AI Stupid Level',
    renderEmail({
      heading: 'Credits added',
      intro,
      rows,
      ctaLabel: 'See your balance',
      ctaUrl: 'https://aistupidlevel.info/account/billing',
      footnote: 'Stripe sends the invoice separately. Questions about a charge? Reply to this email.',
    }),
    `${intro}\n\n` + rows.map(([k, v]) => `  ${k}: ${v}`).join('\n') + `\n\nBalance: https://aistupidlevel.info/account/billing\n`,
    CONTACT_INBOX,
  );
}

/** Confirm a paid workload assessment to the customer: what happens next, and the guarantees. */
export async function sendAssessmentConfirmation(to: string, opts: { id: number; amount: string }) {
  const rows: Array<[string, string]> = [
    ['Reference', `Assessment #${opts.id}`],
    ['Paid', opts.amount],
    ['Next step', 'We confirm the scope with you within two business days'],
    ['Report', 'Within seven business days of us having your tasks'],
  ];
  const intro =
    'Thank you — your workload assessment is booked. A member of the team will write to you within two ' +
    'business days to agree the tasks, the three candidate models and the success criteria.';
  const footnote =
    'If, once we have read your workload, we cannot measure it, we refund the full amount before any work ' +
    'starts; we also refund in full if we cannot deliver the agreed report. The amount is credited against ' +
    'an annual plan bought within 30 days, up to that plan\u2019s price. Reply to this email to reach us directly.';
  return deliver(
    to,
    `Your workload assessment is booked (#${opts.id}) — AI Stupid Level`,
    renderEmail({ heading: 'Your assessment is booked', intro, rows, footnote }),
    `${intro}\n\n` + rows.map(([k, v]) => `  ${k}: ${v}`).join('\n') + `\n\n${footnote}\n\nAI Stupid Level\nhttps://aistupidlevel.info\n`,
    CONTACT_INBOX,
  );
}
