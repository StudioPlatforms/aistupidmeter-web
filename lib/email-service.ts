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
      intro:
        'We received a request to reset the password for this account. Choose a new one using ' +
        'the button below. The link is valid for one hour.',
      ctaLabel: 'Choose a new password',
      ctaUrl: resetLink,
      footnote:
        'If the button does not work, paste this into your browser:<br>' +
        `<span style="word-break:break-all;color:#1a73e8;">${resetLink}</span>` +
        '<br><br>If you did not ask for this, you can ignore this email — your password ' +
        'will not change until the link above is used. Never share the link with anyone; ' +
        'it grants access to your account.',
    }),
    `Reset your AI Stupid Level password\n\n` +
    `We received a request to reset the password for this account.\n` +
    `Open the link below to choose a new one. It is valid for one hour.\n\n` +
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

/**
 * Shared layout for customer-facing mail.
 *
 * Deliberately plain: a light background, system fonts, no images, no tracking
 * pixel, one link colour. The older password-reset template renders neon green
 * on near-black, which several clients invert badly in dark mode and which spam
 * filters score against. Simple markup delivers better and reads the same
 * everywhere.
 *
 * Every message ships a text/plain alternative. A missing plain-text part is one
 * of the cheapest spam points to give away.
 */
function renderEmail(opts: {
  heading: string;
  intro: string;
  rows?: Array<[string, string]>;
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
}): string {
  const { heading, intro, rows = [], ctaLabel, ctaUrl, footnote } = opts;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f8fc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e6ea;border-radius:6px;">
        <tr><td style="padding:24px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#202124;">
          <div style="font-size:13px;font-weight:600;color:#1a73e8;letter-spacing:.4px;">AI STUPID LEVEL</div>
          <h1 style="font-size:19px;line-height:1.35;margin:14px 0 10px;font-weight:600;">${heading}</h1>
          <p style="font-size:14px;line-height:1.65;color:#3c4043;margin:0 0 16px;">${intro}</p>
          ${rows.length ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px;margin:0 0 18px;">
            ${rows.map(([k, v]) => `<tr>
              <td style="padding:7px 0;color:#5f6368;border-bottom:1px solid #eceff1;">${k}</td>
              <td style="padding:7px 0;text-align:right;font-weight:600;border-bottom:1px solid #eceff1;">${v}</td>
            </tr>`).join('')}
          </table>` : ''}
          ${ctaLabel && ctaUrl ? `<p style="margin:0 0 18px;">
            <a href="${ctaUrl}" style="display:inline-block;background:#1a73e8;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:4px;font-size:14px;font-weight:600;">${ctaLabel}</a>
          </p>` : ''}
          ${footnote ? `<p style="font-size:12.5px;line-height:1.6;color:#5f6368;margin:0;">${footnote}</p>` : ''}
        </td></tr>
        <tr><td style="padding:14px 28px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11.5px;color:#80868b;border-top:1px solid #eceff1;">
          AI Stupid Level &middot; independent AI model benchmarking<br>
          <a href="https://aistupidlevel.info" style="color:#1a73e8;text-decoration:none;">aistupidlevel.info</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function deliver(to: string, subject: string, html: string, text: string) {
  try {
    const isLocalhost = SMTP_HOST === 'localhost' || SMTP_HOST === '127.0.0.1';
    if (!isLocalhost && (!SMTP_USER || !SMTP_PASS)) {
      console.error('[EMAIL] SMTP credentials not configured');
      return { success: false, error: 'Email service not configured' };
    }
    await createTransporter().sendMail({
      from: `"AI Stupid Level" <${SMTP_FROM}>`,
      to, subject, html, text,
    });
    return { success: true };
  } catch (error: any) {
    // A failed email must never break signup or checkout. Log and move on.
    console.error(`[EMAIL] "${subject}" to ${to} failed:`, error?.message || error);
    return { success: false, error: error?.message || 'Send failed' };
  }
}

/** Sent once, immediately after an account is created. */
export async function sendWelcomeEmail(email: string, name?: string | null, verifyLink?: string | null) {
  const who = name ? `${name}, ` : '';
  const intro =
    `${who}your account is ready. The fastest way to get value from it is to tell us which models ` +
    `your work actually depends on — then we will tell you when their measured performance changes, ` +
    `and just as usefully when it does not.`;
  return deliver(
    email,
    'Welcome to AI Stupid Level',
    renderEmail({
      heading: 'Track the models you depend on',
      intro,
      rows: [
        ['Models you can track', '3 on the free plan'],
        ['Weekly summary', 'Every Monday'],
        ['Change alerts', 'When a tracked model moves'],
      ],
      ctaLabel: verifyLink ? 'Confirm my address' : 'Choose your models',
      ctaUrl: verifyLink ?? 'https://aistupidlevel.info/watchlist',
      footnote:
        (verifyLink
          ? 'Confirming your address is what lets us send the digest and alerts — we only mail ' +
            'confirmed addresses, which is how our email stays out of spam folders. The link is ' +
            'valid for 24 hours.<br><br>'
          : '') +
        'You can turn off the summary and alerts at any time from your account settings. ' +
        'We never sell your data and take no money from any model provider.',
    }),
    `${who}your AI Stupid Level account is ready.\n\n` +
    `Tell us which models your work depends on and we will tell you when their measured\n` +
    `performance changes — and when it does not.\n\n` +
    `  Models you can track: 3 on the free plan\n` +
    `  Weekly summary: every Monday\n` +
    `  Change alerts: when a tracked model moves\n\n` +
    (verifyLink ? `Confirm your address: ${verifyLink}\n\n` : `Choose your models: https://aistupidlevel.info/watchlist\n\n`) +
    `You can turn off the summary and alerts at any time in your account settings.\n`
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
      ctaUrl: 'https://aistupidlevel.info/router/subscription',
      footnote:
        'We would rather you cancelled than paid for something you are not using — ' +
        'if it is not earning its place, tell us what was missing.',
    }),
    `Your ${opts.planLabel} trial ends on ${opts.chargeDate}, when it renews at ${opts.amount}.\n\n` +
    `No action is needed to continue. To cancel before being charged:\n` +
    `https://aistupidlevel.info/router/subscription\n`
  );
}

/** Confirm-your-address link. Sent on password signup and on request. */
export async function sendVerificationEmail(email: string, verifyLink: string) {
  return deliver(
    email,
    'Confirm your email address',
    renderEmail({
      heading: 'Confirm your email address',
      intro:
        'One click and your weekly digest and change alerts can start arriving. ' +
        'We only send those to confirmed addresses — it keeps our mail out of spam ' +
        'folders, including for the people waiting on a receipt.',
      ctaLabel: 'Confirm my address',
      ctaUrl: verifyLink,
      footnote:
        'If the button does not work, paste this into your browser:<br>' +
        `<span style="word-break:break-all;color:#1a73e8;">${verifyLink}</span>` +
        '<br><br>The link is valid for 24 hours. If you did not create an account, ignore this email.',
    }),
    `Confirm your email address\n\n` +
    `One click and your weekly digest and change alerts can start arriving.\n` +
    `We only send those to confirmed addresses.\n\n${verifyLink}\n\n` +
    `The link is valid for 24 hours. If you did not create an account, ignore this email.\n`
  );
}
