/**
 * Password Hashing Utilities
 * Secure password handling with bcrypt
 */

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12; // Industry standard for security vs performance

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 * @param password - Plain text password to verify
 * @param hash - Hashed password to compare against
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Object with validation result and message
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  message: string;
} {
  if (password.length < 8) {
    return {
      valid: false,
      message: 'Password must be at least 8 characters long',
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one uppercase letter',
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one lowercase letter',
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one number',
    };
  }

  return {
    valid: true,
    message: 'Password is strong',
  };
}

const ATOM = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+";
const LOCAL_PART = new RegExp(`^${ATOM}(?:\\.${ATOM})*$`);
const LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const TOP_LABEL = /^(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})$/;

/**
 * True for an address a mail server will accept: an RFC 5321 dot-atom before the @ (no leading,
 * trailing or doubled dot, no quotes or spaces) and real DNS labels after it. Until 2026-10-16
 * this took anything with an @ and a dot, so we mailed addresses like "j..doe@gmail.com" and
 * Gmail bounced them as invalid. International domains are checked in their punycode form.
 */
export function validateEmail(email: string): boolean {
  if (typeof email !== 'string' || email.length > 254) return false;
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at);
  let domain = email.slice(at + 1);
  if (at < 1 || local.length > 64 || !LOCAL_PART.test(local)) return false;
  if (/[^\x21-\x7e]/.test(domain)) {
    if (/[\s/\\:?#@%[\]]/.test(domain)) return false;
    try { domain = new URL(`http://${domain}`).hostname; } catch { return false; }
  }
  const labels = domain.split('.');
  return labels.length >= 2 && labels.every(l => LABEL.test(l)) && TOP_LABEL.test(labels[labels.length - 1]);
}
