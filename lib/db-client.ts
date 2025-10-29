/**
 * Database Client for Authentication
 * Handles user operations in the router_users table
 */

import Database from 'better-sqlite3';
import path from 'path';

// Get database path from environment or use default
const DB_PATH = process.env.DATABASE_URL || '/root/data/stupid_meter.db';

export interface User {
  id: number;
  email: string;
  password_hash: string | null;
  oauth_provider: string | null;
  oauth_id: string | null;
  name: string | null;
  avatar_url: string | null;
  email_verified: number;
  subscription_status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_tier: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  subscription_canceled_at: string | null;
  last_payment_at: string | null;
  reset_token: string | null;
  reset_token_expires: string | null;
  reset_requested_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get database connection
 */
function getDb() {
  return new Database(DB_PATH);
}

/**
 * Find user by email
 */
export function findUserByEmail(email: string): User | null {
  const db = getDb();
  try {
    const user = db.prepare('SELECT * FROM router_users WHERE email = ?').get(email) as User | undefined;
    return user || null;
  } finally {
    db.close();
  }
}

/**
 * Find user by ID
 */
export function findUserById(id: number): User | null {
  const db = getDb();
  try {
    const user = db.prepare('SELECT * FROM router_users WHERE id = ?').get(id) as User | undefined;
    return user || null;
  } finally {
    db.close();
  }
}

/**
 * Find user by OAuth provider and ID
 */
export function findUserByOAuth(provider: string, oauthId: string): User | null {
  const db = getDb();
  try {
    const user = db.prepare(
      'SELECT * FROM router_users WHERE oauth_provider = ? AND oauth_id = ?'
    ).get(provider, oauthId) as User | undefined;
    return user || null;
  } finally {
    db.close();
  }
}

/**
 * Create a new user with email/password
 */
export function createUserWithPassword(
  email: string,
  passwordHash: string,
  name?: string
): User {
  const db = getDb();
  try {
    const result = db.prepare(`
      INSERT INTO router_users (
        email, 
        password_hash, 
        name,
        email_verified,
        subscription_status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 0, 'trial', datetime('now'), datetime('now'))
    `).run(email, passwordHash, name || null);

    const user = db.prepare('SELECT * FROM router_users WHERE id = ?').get(result.lastInsertRowid) as User;
    return user;
  } finally {
    db.close();
  }
}

/**
 * Create a new user with OAuth
 */
export function createUserWithOAuth(
  email: string,
  provider: string,
  oauthId: string,
  name?: string,
  avatarUrl?: string
): User {
  const db = getDb();
  try {
    const result = db.prepare(`
      INSERT INTO router_users (
        email,
        oauth_provider,
        oauth_id,
        name,
        avatar_url,
        email_verified,
        subscription_status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, 'trial', datetime('now'), datetime('now'))
    `).run(email, provider, oauthId, name || null, avatarUrl || null);

    const user = db.prepare('SELECT * FROM router_users WHERE id = ?').get(result.lastInsertRowid) as User;
    return user;
  } finally {
    db.close();
  }
}

/**
 * Update user's last login time
 */
export function updateUserLastLogin(userId: number): void {
  const db = getDb();
  try {
    db.prepare('UPDATE router_users SET updated_at = datetime(\'now\') WHERE id = ?').run(userId);
  } finally {
    db.close();
  }
}

/**
 * Verify email
 */
export function verifyUserEmail(userId: number): void {
  const db = getDb();
  try {
    db.prepare('UPDATE router_users SET email_verified = 1, updated_at = datetime(\'now\') WHERE id = ?').run(userId);
  } finally {
    db.close();
  }
}

/**
 * Update user's Stripe customer ID
 */
export function updateStripeCustomerId(userId: number, customerId: string): void {
  const db = getDb();
  try {
    db.prepare('UPDATE router_users SET stripe_customer_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(customerId, userId);
  } finally {
    db.close();
  }
}

/**
 * Start user's trial period
 */
export function startUserTrial(userId: number, stripeCustomerId: string, stripeSubscriptionId: string): void {
  const db = getDb();
  try {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7); // 7 days from now
    
    db.prepare(`
      UPDATE router_users SET
        stripe_customer_id = ?,
        stripe_subscription_id = ?,
        subscription_tier = 'pro',
        trial_started_at = datetime('now'),
        trial_ends_at = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(stripeCustomerId, stripeSubscriptionId, trialEndsAt.toISOString(), userId);
  } finally {
    db.close();
  }
}

/**
 * Activate user's paid subscription
 */
export function activateSubscription(userId: number, stripeSubscriptionId: string): void {
  const db = getDb();
  try {
    db.prepare(`
      UPDATE router_users SET
        stripe_subscription_id = ?,
        subscription_tier = 'pro',
        last_payment_at = datetime('now'),
        subscription_canceled_at = NULL,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(stripeSubscriptionId, userId);
  } finally {
    db.close();
  }
}

/**
 * Cancel user's subscription
 */
export function cancelSubscription(userId: number, endsAt: string): void {
  const db = getDb();
  try {
    db.prepare(`
      UPDATE router_users SET
        subscription_canceled_at = datetime('now'),
        subscription_ends_at = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(endsAt, userId);
  } finally {
    db.close();
  }
}

/**
 * Downgrade user to free tier
 */
export function downgradeToFree(userId: number): void {
  const db = getDb();
  try {
    db.prepare(`
      UPDATE router_users SET
        subscription_tier = 'free',
        stripe_subscription_id = NULL,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(userId);
  } finally {
    db.close();
  }
}

/**
 * Check if user has active subscription (trial or paid)
 */
export function hasActiveSubscription(user: User): boolean {
  // Check if trial is active
  if (user.trial_ends_at) {
    const trialEnds = new Date(user.trial_ends_at);
    if (trialEnds > new Date()) {
      return true;
    }
  }
  
  // Check if paid subscription is active
  if (user.subscription_tier === 'pro') {
    // If subscription is canceled, check if it hasn't ended yet
    if (user.subscription_canceled_at && user.subscription_ends_at) {
      const endsAt = new Date(user.subscription_ends_at);
      return endsAt > new Date();
    }
    // If not canceled, it's active
    if (!user.subscription_canceled_at) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get user by Stripe customer ID
 */
export function findUserByStripeCustomerId(customerId: string): User | null {
  const db = getDb();
  try {
    const user = db.prepare('SELECT * FROM router_users WHERE stripe_customer_id = ?')
      .get(customerId) as User | undefined;
    return user || null;
  } finally {
    db.close();
  }
}

/**
 * Check subscription status for a user by email
 * Returns subscription details including access status
 */
export function checkSubscription(email: string): {
  hasAccess: boolean;
  status: string;
  tier: string;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
} {
  const user = findUserByEmail(email);
  
  if (!user) {
    return {
      hasAccess: false,
      status: 'no_account',
      tier: 'free',
      trialEndsAt: null,
      subscriptionEndsAt: null
    };
  }
  
  const hasAccess = hasActiveSubscription(user);
  
  return {
    hasAccess,
    status: user.subscription_status,
    tier: user.subscription_tier,
    trialEndsAt: user.trial_ends_at,
    subscriptionEndsAt: user.subscription_ends_at
  };
}

/**
 * Create password reset token for user
 * Returns the plain token (to send via email) and stores hashed version
 */
export function createPasswordResetToken(email: string): { token: string; expires: string } | null {
  const user = findUserByEmail(email);
  if (!user) {
    return null;
  }

  const db = getDb();
  try {
    // Generate secure random token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    
    // Hash the token before storing
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // Token expires in 1 hour
    const expires = new Date();
    expires.setHours(expires.getHours() + 1);
    const expiresISO = expires.toISOString();
    
    // Store hashed token in database
    db.prepare(`
      UPDATE router_users SET
        reset_token = ?,
        reset_token_expires = ?,
        reset_requested_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(tokenHash, expiresISO, user.id);
    
    // Return plain token (to send via email) and expiration
    return { token, expires: expiresISO };
  } finally {
    db.close();
  }
}

/**
 * Validate reset token and return user if valid
 */
export function validateResetToken(token: string): User | null {
  const crypto = require('crypto');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  const db = getDb();
  try {
    const user = db.prepare(`
      SELECT * FROM router_users 
      WHERE reset_token = ? 
      AND reset_token_expires > datetime('now')
    `).get(tokenHash) as User | undefined;
    
    return user || null;
  } finally {
    db.close();
  }
}

/**
 * Update user password and clear reset token
 */
export function updatePassword(userId: number, newPasswordHash: string): void {
  const db = getDb();
  try {
    db.prepare(`
      UPDATE router_users SET
        password_hash = ?,
        reset_token = NULL,
        reset_token_expires = NULL,
        reset_requested_at = NULL,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(newPasswordHash, userId);
  } finally {
    db.close();
  }
}

/**
 * Clear reset token (e.g., after failed attempts)
 */
export function clearResetToken(userId: number): void {
  const db = getDb();
  try {
    db.prepare(`
      UPDATE router_users SET
        reset_token = NULL,
        reset_token_expires = NULL,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(userId);
  } finally {
    db.close();
  }
}
