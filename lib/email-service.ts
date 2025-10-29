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
const SMTP_FROM = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@aistupidlevel.com';

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
export async function sendPasswordResetEmail(
  email: string,
  token: string,
  resetLink: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if SMTP is configured (skip check for localhost)
    const isLocalhost = SMTP_HOST === 'localhost' || SMTP_HOST === '127.0.0.1';
    if (!isLocalhost && (!SMTP_USER || !SMTP_PASS)) {
      console.error('[EMAIL] SMTP credentials not configured');
      return {
        success: false,
        error: 'Email service not configured. Please contact support.',
      };
    }

    const transporter = createTransporter();

    // Email content
    const mailOptions = {
      from: `"AI Stupid Level" <${SMTP_FROM}>`,
      to: email,
      subject: 'Password Reset Request - AI Stupid Level',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: 'Courier New', monospace;
              background-color: #0a0a0a;
              color: #00ff00;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #1a1a1a;
              border: 2px solid #00ff00;
              padding: 30px;
              box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
            }
            .header {
              text-align: center;
              font-size: 24px;
              margin-bottom: 20px;
              color: #00ff00;
              text-shadow: 0 0 10px #00ff00;
            }
            .content {
              line-height: 1.6;
              margin-bottom: 30px;
            }
            .button {
              display: inline-block;
              padding: 15px 30px;
              background-color: #00ff00;
              color: #0a0a0a;
              text-decoration: none;
              font-weight: bold;
              border: 2px solid #00ff00;
              box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
              transition: all 0.3s;
            }
            .button:hover {
              background-color: #0a0a0a;
              color: #00ff00;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #00ff00;
              font-size: 12px;
              color: #00aa00;
              text-align: center;
            }
            .warning {
              color: #ffaa00;
              margin-top: 20px;
              padding: 10px;
              border: 1px solid #ffaa00;
              background-color: rgba(255, 170, 0, 0.1);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              🔐 PASSWORD RESET REQUEST
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>We received a request to reset your password for your AI Stupid Level account.</p>
              <p>Click the button below to reset your password:</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" class="button">RESET PASSWORD</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #00aaff;">${resetLink}</p>
              <div class="warning">
                <strong>⚠️ SECURITY NOTICE:</strong>
                <ul style="margin: 10px 0;">
                  <li>This link will expire in 1 hour</li>
                  <li>If you didn't request this reset, please ignore this email</li>
                  <li>Never share this link with anyone</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated message from AI Stupid Level</p>
              <p>If you have any questions, please contact support</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
PASSWORD RESET REQUEST

Hello,

We received a request to reset your password for your AI Stupid Level account.

Click the link below to reset your password:
${resetLink}

SECURITY NOTICE:
- This link will expire in 1 hour
- If you didn't request this reset, please ignore this email
- Never share this link with anyone

This is an automated message from AI Stupid Level.
      `,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('[EMAIL] Password reset email sent:', info.messageId);

    return { success: true };
  } catch (error) {
    console.error('[EMAIL] Error sending password reset email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

/**
 * Verify SMTP configuration
 */
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
