/**
 * Forum Auth — Role system and permission helpers
 */

import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_URL || '/root/data/stupid_meter.db';

function getDb() {
  return new Database(DB_PATH);
}

// Role hierarchy — higher number = more privilege
const ROLE_HIERARCHY: Record<string, number> = {
  superadmin: 4,
  admin: 3,
  moderator: 2,
  user: 1,
  banned: 0,
};

export interface ForumUser {
  id: number;
  email: string;
  name: string | null;
  role: string;
  forum_username: string | null;
  forum_username_set_at: string | null;
  avatar_url: string | null;
  subscription_tier: string;
}

/**
 * Get forum user by ID with role and forum fields
 */
export function getForumUser(userId: number): ForumUser | null {
  const db = getDb();
  try {
    const user = db.prepare(`
      SELECT id, email, name, role, forum_username, forum_username_set_at, avatar_url, subscription_tier
      FROM router_users
      WHERE id = ?
    `).get(userId) as ForumUser | undefined;
    if (!user) return null;
    // Ensure role defaults to 'user' if null
    user.role = user.role || 'user';
    return user;
  } finally {
    db.close();
  }
}

/**
 * Get forum user and throw if role is insufficient
 */
export function requireRole(userId: number, minimumRole: string): ForumUser {
  const user = getForumUser(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const userLevel = ROLE_HIERARCHY[user.role] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 0;

  if (userLevel < requiredLevel) {
    throw new Error(`Insufficient permissions. Required: ${minimumRole}, current: ${user.role}`);
  }

  return user;
}

/**
 * Check if role has moderation privileges (moderator or higher)
 */
export function canModerate(role: string): boolean {
  const level = ROLE_HIERARCHY[role] ?? 0;
  return level >= ROLE_HIERARCHY.moderator;
}

/**
 * Check if role has admin privileges (admin or higher)
 */
export function canAdminister(role: string): boolean {
  const level = ROLE_HIERARCHY[role] ?? 0;
  return level >= ROLE_HIERARCHY.admin;
}

/**
 * Check if role is superadmin
 */
export function isSuperAdmin(role: string): boolean {
  return role === 'superadmin';
}

/**
 * Check if user has set a forum username
 */
export function hasForumUsername(user: ForumUser): boolean {
  return user.forum_username !== null && user.forum_username !== '';
}

/**
 * Check if a user is currently banned (via forum_user_profiles)
 */
export function isUserBanned(userId: number): boolean {
  const db = getDb();
  try {
    const profile = db.prepare(`
      SELECT is_banned, banned_until
      FROM forum_user_profiles
      WHERE user_id = ?
    `).get(userId) as { is_banned: number; banned_until: string | null } | undefined;

    if (!profile) return false;
    if (!profile.is_banned) return false;

    // If banned_until is set, check if the ban has expired
    if (profile.banned_until) {
      const banEnd = new Date(profile.banned_until);
      if (banEnd <= new Date()) {
        // Ban has expired — auto-unban
        db.prepare(`
          UPDATE forum_user_profiles
          SET is_banned = 0, ban_reason = NULL, banned_until = NULL, updated_at = datetime('now')
          WHERE user_id = ?
        `).run(userId);
        return false;
      }
    }

    return true;
  } finally {
    db.close();
  }
}
