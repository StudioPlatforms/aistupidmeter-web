/**
 * Forum Database CRUD Operations
 * Comprehensive data access layer for the forum system
 */

import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_URL || '/root/data/stupid_meter.db';

function getDb() {
  return new Database(DB_PATH);
}

// ============================================================
// Interfaces
// ============================================================

export interface ForumCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_locked: number;
  created_by: number | null;
  topic_count: number;
  post_count: number;
  last_post_at: string | null;
  last_post_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface ForumTopic {
  id: number;
  category_id: number;
  title: string;
  slug: string;
  author_id: number;
  is_pinned: number;
  is_locked: number;
  is_deleted: number;
  view_count: number;
  reply_count: number;
  last_reply_at: string | null;
  last_reply_by: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  author_username: string | null;
  author_avatar: string | null;
}

export interface ForumPost {
  id: number;
  topic_id: number;
  author_id: number;
  content: string;
  is_solution: number;
  is_deleted: number;
  edited_at: string | null;
  edited_by: number | null;
  parent_post_id: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  author_username: string | null;
  author_avatar: string | null;
  reactions: Record<string, number>;
}

export interface ForumProfile {
  user_id: number;
  bio: string | null;
  location: string | null;
  website: string | null;
  signature: string | null;
  avatar_type: string;
  custom_avatar_url: string | null;
  topic_count: number;
  post_count: number;
  reputation: number;
  title: string | null;
  is_banned: number;
  ban_reason: string | null;
  banned_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForumReport {
  id: number;
  reporter_id: number;
  post_id: number | null;
  topic_id: number | null;
  reason: string;
  details: string | null;
  status: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  action_taken: string | null;
  created_at: string;
}

// ============================================================
// Utility
// ============================================================

/**
 * Convert text to a URL-safe slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')  // Remove special chars
    .replace(/[\s_]+/g, '-')   // Replace spaces/underscores with hyphens
    .replace(/-+/g, '-')       // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '');  // Trim leading/trailing hyphens
}

// ============================================================
// Category Operations
// ============================================================

/**
 * Get all categories ordered by display_order
 */
export function getCategories(): ForumCategory[] {
  const db = getDb();
  try {
    return db.prepare(`
      SELECT * FROM forum_categories
      ORDER BY display_order ASC
    `).all() as ForumCategory[];
  } finally {
    db.close();
  }
}

/**
 * Get a category by its ID
 */
export function getCategoryById(id: number): ForumCategory | null {
  const db = getDb();
  try {
    const cat = db.prepare(`
      SELECT * FROM forum_categories WHERE id = ?
    `).get(id) as ForumCategory | undefined;
    return cat || null;
  } finally {
    db.close();
  }
}

/**
 * Get a category by its slug
 */
export function getCategoryBySlug(slug: string): ForumCategory | null {
  const db = getDb();
  try {
    const cat = db.prepare(`
      SELECT * FROM forum_categories WHERE slug = ?
    `).get(slug) as ForumCategory | undefined;
    return cat || null;
  } finally {
    db.close();
  }
}

/**
 * Create a new category
 */
export function createCategory(data: {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  display_order?: number;
  is_locked?: number;
  created_by?: number;
}): ForumCategory {
  const db = getDb();
  try {
    const result = db.prepare(`
      INSERT INTO forum_categories (name, slug, description, icon, display_order, is_locked, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      data.name,
      data.slug,
      data.description || null,
      data.icon || null,
      data.display_order || 0,
      data.is_locked || 0,
      data.created_by || null
    );

    return db.prepare('SELECT * FROM forum_categories WHERE id = ?').get(result.lastInsertRowid) as ForumCategory;
  } finally {
    db.close();
  }
}

/**
 * Update a category
 */
export function updateCategory(id: number, data: Partial<Pick<ForumCategory, 'name' | 'slug' | 'description' | 'icon' | 'display_order' | 'is_locked'>>): void {
  const db = getDb();
  try {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.slug !== undefined) { fields.push('slug = ?'); values.push(data.slug); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.icon !== undefined) { fields.push('icon = ?'); values.push(data.icon); }
    if (data.display_order !== undefined) { fields.push('display_order = ?'); values.push(data.display_order); }
    if (data.is_locked !== undefined) { fields.push('is_locked = ?'); values.push(data.is_locked); }

    if (fields.length === 0) return;

    fields.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE forum_categories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  } finally {
    db.close();
  }
}

/**
 * Delete a category
 */
export function deleteCategory(id: number): void {
  const db = getDb();
  try {
    db.prepare('DELETE FROM forum_categories WHERE id = ?').run(id);
  } finally {
    db.close();
  }
}

// ============================================================
// Topic Operations
// ============================================================

/**
 * Get topics by category with pagination
 * Sort: pinned first, then by view_count (highest views on top), then by last activity
 */
export function getTopicsByCategory(
  categoryId: number,
  page: number = 1,
  limit: number = 20
): { topics: ForumTopic[]; total: number } {
  const db = getDb();
  try {
    const offset = (page - 1) * limit;

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM forum_topics
      WHERE category_id = ? AND is_deleted = 0
    `).get(categoryId) as { count: number };

    const topics = db.prepare(`
      SELECT
        t.*,
        COALESCE(u.forum_username, u.name) as author_username,
        u.avatar_url as author_avatar,
        COALESCE(lr.forum_username, lr.name) as last_reply_by_username
      FROM forum_topics t
      LEFT JOIN router_users u ON t.author_id = u.id
      LEFT JOIN router_users lr ON t.last_reply_by = lr.id
      WHERE t.category_id = ? AND t.is_deleted = 0
      ORDER BY t.is_pinned DESC, t.view_count DESC, t.last_reply_at DESC NULLS LAST, t.created_at DESC
      LIMIT ? OFFSET ?
    `).all(categoryId, limit, offset) as ForumTopic[];

    return { topics, total: total.count };
  } finally {
    db.close();
  }
}

/**
 * Get a topic by ID (also increments view count)
 */
export function getTopicById(id: number): (ForumTopic & { category_name?: string; category_slug?: string; category_is_locked?: number }) | null {
  const db = getDb();
  try {
    // Increment view count
    db.prepare('UPDATE forum_topics SET view_count = view_count + 1 WHERE id = ? AND is_deleted = 0').run(id);

    const topic = db.prepare(`
      SELECT
        t.*,
        COALESCE(u.forum_username, u.name) as author_username,
        u.avatar_url as author_avatar,
        c.name as category_name,
        c.slug as category_slug,
        c.is_locked as category_is_locked
      FROM forum_topics t
      LEFT JOIN router_users u ON t.author_id = u.id
      LEFT JOIN forum_categories c ON t.category_id = c.id
      WHERE t.id = ? AND t.is_deleted = 0
    `).get(id) as (ForumTopic & { category_name?: string; category_slug?: string; category_is_locked?: number }) | undefined;

    return topic || null;
  } finally {
    db.close();
  }
}

/**
 * Create a new topic with its first post
 */
export function createTopic(
  categoryId: number,
  authorId: number,
  title: string,
  content: string
): ForumTopic {
  const db = getDb();
  try {
    const topicSlug = slugify(title) + '-' + Date.now().toString(36);

    const createAll = db.transaction(() => {
      // Create the topic
      const topicResult = db.prepare(`
        INSERT INTO forum_topics (category_id, title, slug, author_id, last_reply_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
      `).run(categoryId, title, topicSlug, authorId);

      const topicId = topicResult.lastInsertRowid as number;

      // Create the first post
      db.prepare(`
        INSERT INTO forum_posts (topic_id, author_id, content, created_at, updated_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
      `).run(topicId, authorId, content);

      // Update category topic_count
      db.prepare(`
        UPDATE forum_categories
        SET topic_count = topic_count + 1, updated_at = datetime('now')
        WHERE id = ?
      `).run(categoryId);

      // Update or create user profile topic_count
      const profile = db.prepare('SELECT user_id FROM forum_user_profiles WHERE user_id = ?').get(authorId);
      if (profile) {
        db.prepare(`
          UPDATE forum_user_profiles
          SET topic_count = topic_count + 1, updated_at = datetime('now')
          WHERE user_id = ?
        `).run(authorId);
      } else {
        db.prepare(`
          INSERT INTO forum_user_profiles (user_id, topic_count, created_at, updated_at)
          VALUES (?, 1, datetime('now'), datetime('now'))
        `).run(authorId);
      }

      return topicId;
    });

    const topicId = createAll();

    const topic = db.prepare(`
      SELECT
        t.*,
        COALESCE(u.forum_username, u.name) as author_username,
        u.avatar_url as author_avatar
      FROM forum_topics t
      LEFT JOIN router_users u ON t.author_id = u.id
      WHERE t.id = ?
    `).get(topicId) as ForumTopic;

    return topic;
  } finally {
    db.close();
  }
}

/**
 * Update a topic title
 */
export function updateTopic(id: number, title: string): void {
  const db = getDb();
  try {
    db.prepare(`
      UPDATE forum_topics SET title = ?, updated_at = datetime('now') WHERE id = ?
    `).run(title, id);
  } finally {
    db.close();
  }
}

/**
 * Soft-delete a topic and decrement category counter
 */
export function softDeleteTopic(id: number): void {
  const db = getDb();
  try {
    const topic = db.prepare('SELECT category_id, reply_count FROM forum_topics WHERE id = ? AND is_deleted = 0').get(id) as { category_id: number; reply_count: number } | undefined;
    if (!topic) return;

    db.transaction(() => {
      db.prepare(`
        UPDATE forum_topics SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?
      `).run(id);

      // Decrement category topic_count and post_count (replies + 1 for the OP)
      db.prepare(`
        UPDATE forum_categories
        SET topic_count = MAX(0, topic_count - 1),
            post_count = MAX(0, post_count - ?),
            updated_at = datetime('now')
        WHERE id = ?
      `).run((topic.reply_count || 0) + 1, topic.category_id);
    })();
  } finally {
    db.close();
  }
}

/**
 * Pin or unpin a topic
 */
export function pinTopic(id: number, pinned: boolean): void {
  const db = getDb();
  try {
    db.prepare(`
      UPDATE forum_topics SET is_pinned = ?, updated_at = datetime('now') WHERE id = ?
    `).run(pinned ? 1 : 0, id);
  } finally {
    db.close();
  }
}

/**
 * Lock or unlock a topic
 */
export function lockTopic(id: number, locked: boolean): void {
  const db = getDb();
  try {
    db.prepare(`
      UPDATE forum_topics SET is_locked = ?, updated_at = datetime('now') WHERE id = ?
    `).run(locked ? 1 : 0, id);
  } finally {
    db.close();
  }
}

// ============================================================
// Post Operations
// ============================================================

/**
 * Get posts by topic with pagination
 */
export function getPostsByTopic(
  topicId: number,
  page: number = 1,
  limit: number = 20
): { posts: ForumPost[]; total: number } {
  const db = getDb();
  try {
    const offset = (page - 1) * limit;

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM forum_posts
      WHERE topic_id = ? AND is_deleted = 0
    `).get(topicId) as { count: number };

    const posts = db.prepare(`
      SELECT
        p.*,
        COALESCE(u.forum_username, u.name) as author_username,
        u.avatar_url as author_avatar
      FROM forum_posts p
      LEFT JOIN router_users u ON p.author_id = u.id
      WHERE p.topic_id = ? AND p.is_deleted = 0
      ORDER BY p.created_at ASC
      LIMIT ? OFFSET ?
    `).all(topicId, limit, offset) as (Omit<ForumPost, 'reactions'> & { author_username: string | null; author_avatar: string | null })[];

    // Fetch reactions for all posts in batch
    const postIds = posts.map((p) => p.id);
    const postsWithReactions: ForumPost[] = posts.map((post) => ({
      ...post,
      reactions: {} as Record<string, number>,
    }));

    if (postIds.length > 0) {
      const placeholders = postIds.map(() => '?').join(',');
      const reactionRows = db.prepare(`
        SELECT post_id, reaction, COUNT(*) as count
        FROM forum_post_reactions
        WHERE post_id IN (${placeholders})
        GROUP BY post_id, reaction
      `).all(...postIds) as { post_id: number; reaction: string; count: number }[];

      const reactionsMap: Record<number, Record<string, number>> = {};
      for (const row of reactionRows) {
        if (!reactionsMap[row.post_id]) reactionsMap[row.post_id] = {};
        reactionsMap[row.post_id][row.reaction] = row.count;
      }

      for (const post of postsWithReactions) {
        post.reactions = reactionsMap[post.id] || {};
      }
    }

    return { posts: postsWithReactions, total: total.count };
  } finally {
    db.close();
  }
}

/**
 * Create a new post (reply)
 */
export function createPost(
  topicId: number,
  authorId: number,
  content: string,
  parentPostId?: number
): ForumPost {
  const db = getDb();
  try {
    const createAll = db.transaction(() => {
      // Insert the post
      const result = db.prepare(`
        INSERT INTO forum_posts (topic_id, author_id, content, parent_post_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(topicId, authorId, content, parentPostId || null);

      const postId = result.lastInsertRowid as number;

      // Update topic reply_count and last_reply
      db.prepare(`
        UPDATE forum_topics
        SET reply_count = reply_count + 1,
            last_reply_at = datetime('now'),
            last_reply_by = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(authorId, topicId);

      // Update category post_count and last_post
      const topic = db.prepare('SELECT category_id FROM forum_topics WHERE id = ?').get(topicId) as { category_id: number };
      db.prepare(`
        UPDATE forum_categories
        SET post_count = post_count + 1,
            last_post_at = datetime('now'),
            last_post_by = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(authorId, topic.category_id);

      // Update or create user profile post_count
      const profile = db.prepare('SELECT user_id FROM forum_user_profiles WHERE user_id = ?').get(authorId);
      if (profile) {
        db.prepare(`
          UPDATE forum_user_profiles
          SET post_count = post_count + 1, updated_at = datetime('now')
          WHERE user_id = ?
        `).run(authorId);
      } else {
        db.prepare(`
          INSERT INTO forum_user_profiles (user_id, post_count, created_at, updated_at)
          VALUES (?, 1, datetime('now'), datetime('now'))
        `).run(authorId);
      }

      return postId;
    });

    const postId = createAll();

    const post = db.prepare(`
      SELECT
        p.*,
        COALESCE(u.forum_username, u.name) as author_username,
        u.avatar_url as author_avatar
      FROM forum_posts p
      LEFT JOIN router_users u ON p.author_id = u.id
      WHERE p.id = ?
    `).get(postId) as Omit<ForumPost, 'reactions'>;

    return { ...post, reactions: {} };
  } finally {
    db.close();
  }
}

/**
 * Update a post's content
 */
export function updatePost(id: number, content: string, editedBy: number): void {
  const db = getDb();
  try {
    db.prepare(`
      UPDATE forum_posts
      SET content = ?, edited_at = datetime('now'), edited_by = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(content, editedBy, id);
  } finally {
    db.close();
  }
}

/**
 * Soft-delete a post and decrement counters
 */
export function softDeletePost(id: number): void {
  const db = getDb();
  try {
    const post = db.prepare('SELECT topic_id, author_id FROM forum_posts WHERE id = ? AND is_deleted = 0').get(id) as { topic_id: number; author_id: number } | undefined;
    if (!post) return;

    const topic = db.prepare('SELECT category_id FROM forum_topics WHERE id = ?').get(post.topic_id) as { category_id: number } | undefined;

    db.transaction(() => {
      db.prepare(`
        UPDATE forum_posts SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?
      `).run(id);

      // Decrement topic reply_count
      db.prepare(`
        UPDATE forum_topics
        SET reply_count = MAX(0, reply_count - 1), updated_at = datetime('now')
        WHERE id = ?
      `).run(post.topic_id);

      // Decrement category post_count
      if (topic) {
        db.prepare(`
          UPDATE forum_categories
          SET post_count = MAX(0, post_count - 1), updated_at = datetime('now')
          WHERE id = ?
        `).run(topic.category_id);
      }
    })();
  } finally {
    db.close();
  }
}

/**
 * Mark a post as the solution
 */
export function markAsSolution(postId: number): void {
  const db = getDb();
  try {
    // First, get topic_id for this post
    const post = db.prepare('SELECT topic_id FROM forum_posts WHERE id = ?').get(postId) as { topic_id: number } | undefined;
    if (!post) return;

    db.transaction(() => {
      // Unmark any previous solution in this topic
      db.prepare(`
        UPDATE forum_posts SET is_solution = 0, updated_at = datetime('now')
        WHERE topic_id = ? AND is_solution = 1
      `).run(post.topic_id);

      // Mark this post as solution
      db.prepare(`
        UPDATE forum_posts SET is_solution = 1, updated_at = datetime('now') WHERE id = ?
      `).run(postId);
    })();
  } finally {
    db.close();
  }
}

// ============================================================
// Profile Operations
// ============================================================

/**
 * Get or create a forum profile for a user
 */
export function getOrCreateForumProfile(userId: number): ForumProfile {
  const db = getDb();
  try {
    let profile = db.prepare('SELECT * FROM forum_user_profiles WHERE user_id = ?').get(userId) as ForumProfile | undefined;

    if (!profile) {
      db.prepare(`
        INSERT INTO forum_user_profiles (user_id, created_at, updated_at)
        VALUES (?, datetime('now'), datetime('now'))
      `).run(userId);

      profile = db.prepare('SELECT * FROM forum_user_profiles WHERE user_id = ?').get(userId) as ForumProfile;
    }

    return profile;
  } finally {
    db.close();
  }
}

/**
 * Get a forum profile by username (joined with router_users)
 */
export function getForumProfileByUsername(
  username: string
): (ForumProfile & { email: string; name: string; forum_username: string; role: string; avatar_url: string }) | null {
  const db = getDb();
  try {
    // Find the user by forum_username (case-insensitive)
    const user = db.prepare(`
      SELECT id FROM router_users WHERE forum_username = ? COLLATE NOCASE
    `).get(username) as { id: number } | undefined;

    if (!user) return null;

    // Ensure profile exists
    const profileExists = db.prepare('SELECT user_id FROM forum_user_profiles WHERE user_id = ?').get(user.id);
    if (!profileExists) {
      db.prepare(`
        INSERT INTO forum_user_profiles (user_id, created_at, updated_at)
        VALUES (?, datetime('now'), datetime('now'))
      `).run(user.id);
    }

    const result = db.prepare(`
      SELECT
        fp.*,
        u.email,
        u.name,
        u.forum_username,
        u.role,
        u.avatar_url
      FROM forum_user_profiles fp
      JOIN router_users u ON fp.user_id = u.id
      WHERE u.forum_username = ? COLLATE NOCASE
    `).get(username) as (ForumProfile & { email: string; name: string; forum_username: string; role: string; avatar_url: string }) | undefined;

    return result || null;
  } finally {
    db.close();
  }
}

/**
 * Update a forum profile
 */
export function updateForumProfile(userId: number, data: Partial<ForumProfile>): void {
  const db = getDb();
  try {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.bio !== undefined) { fields.push('bio = ?'); values.push(data.bio); }
    if (data.location !== undefined) { fields.push('location = ?'); values.push(data.location); }
    if (data.website !== undefined) { fields.push('website = ?'); values.push(data.website); }
    if (data.signature !== undefined) { fields.push('signature = ?'); values.push(data.signature); }
    if (data.avatar_type !== undefined) { fields.push('avatar_type = ?'); values.push(data.avatar_type); }
    if (data.custom_avatar_url !== undefined) { fields.push('custom_avatar_url = ?'); values.push(data.custom_avatar_url); }
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }

    if (fields.length === 0) return;

    fields.push("updated_at = datetime('now')");
    values.push(userId);

    db.prepare(`UPDATE forum_user_profiles SET ${fields.join(', ')} WHERE user_id = ?`).run(...values);
  } finally {
    db.close();
  }
}

/**
 * Reserved usernames that cannot be used
 */
const RESERVED_USERNAMES = [
  'admin', 'moderator', 'system', 'support', 'help', 'forum', 'root',
  'null', 'undefined', 'anonymous', 'deleted', 'bot', 'ai', 'mod',
  'staff', 'team', 'official',
];

/**
 * Check if a username is available (case-insensitive)
 */
export function checkUsernameAvailable(username: string): boolean {
  if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
    return false;
  }

  const db = getDb();
  try {
    const existing = db.prepare(`
      SELECT id FROM router_users WHERE forum_username = ? COLLATE NOCASE
    `).get(username);
    return !existing;
  } finally {
    db.close();
  }
}

/**
 * Set a user's forum username
 * Returns false if the username is taken or reserved
 */
export function setForumUsername(userId: number, username: string): boolean {
  if (!checkUsernameAvailable(username)) {
    // Also check if the current user already owns this username
    const db = getDb();
    try {
      const current = db.prepare(`
        SELECT forum_username FROM router_users WHERE id = ?
      `).get(userId) as { forum_username: string | null } | undefined;
      if (current?.forum_username?.toLowerCase() !== username.toLowerCase()) {
        return false;
      }
    } finally {
      db.close();
    }
  }

  const db = getDb();
  try {
    db.prepare(`
      UPDATE router_users
      SET forum_username = ?, forum_username_set_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(username, userId);
    return true;
  } finally {
    db.close();
  }
}

/**
 * Ban a user
 */
export function banUser(userId: number, reason: string, until?: string): void {
  const db = getDb();
  try {
    // Ensure profile exists
    const profile = db.prepare('SELECT user_id FROM forum_user_profiles WHERE user_id = ?').get(userId);
    if (!profile) {
      db.prepare(`
        INSERT INTO forum_user_profiles (user_id, is_banned, ban_reason, banned_until, created_at, updated_at)
        VALUES (?, 1, ?, ?, datetime('now'), datetime('now'))
      `).run(userId, reason, until || null);
    } else {
      db.prepare(`
        UPDATE forum_user_profiles
        SET is_banned = 1, ban_reason = ?, banned_until = ?, updated_at = datetime('now')
        WHERE user_id = ?
      `).run(reason, until || null, userId);
    }

    // Also update the role to 'banned' on router_users
    db.prepare(`
      UPDATE router_users SET role = 'banned', updated_at = datetime('now') WHERE id = ?
    `).run(userId);
  } finally {
    db.close();
  }
}

/**
 * Unban a user
 */
export function unbanUser(userId: number): void {
  const db = getDb();
  try {
    db.prepare(`
      UPDATE forum_user_profiles
      SET is_banned = 0, ban_reason = NULL, banned_until = NULL, updated_at = datetime('now')
      WHERE user_id = ?
    `).run(userId);

    // Restore role to 'user'
    db.prepare(`
      UPDATE router_users SET role = 'user', updated_at = datetime('now') WHERE id = ?
    `).run(userId);
  } finally {
    db.close();
  }
}

// ============================================================
// Reaction Operations
// ============================================================

/**
 * Toggle a reaction on a post (insert or delete)
 */
export function toggleReaction(
  postId: number,
  userId: number,
  reaction: string
): { added: boolean } {
  const db = getDb();
  try {
    const existing = db.prepare(`
      SELECT id FROM forum_post_reactions
      WHERE post_id = ? AND user_id = ? AND reaction = ?
    `).get(postId, userId, reaction);

    if (existing) {
      db.prepare(`
        DELETE FROM forum_post_reactions
        WHERE post_id = ? AND user_id = ? AND reaction = ?
      `).run(postId, userId, reaction);
      return { added: false };
    } else {
      db.prepare(`
        INSERT INTO forum_post_reactions (post_id, user_id, reaction, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(postId, userId, reaction);
      return { added: true };
    }
  } finally {
    db.close();
  }
}

/**
 * Get reaction counts for a post
 */
export function getReactionCounts(postId: number): Record<string, number> {
  const db = getDb();
  try {
    const rows = db.prepare(`
      SELECT reaction, COUNT(*) as count
      FROM forum_post_reactions
      WHERE post_id = ?
      GROUP BY reaction
    `).all(postId) as { reaction: string; count: number }[];

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.reaction] = row.count;
    }
    return counts;
  } finally {
    db.close();
  }
}

// ============================================================
// Report Operations
// ============================================================

/**
 * Create a new report
 */
export function createReport(
  reporterId: number,
  data: { postId?: number; topicId?: number; reason: string; details?: string }
): void {
  const db = getDb();
  try {
    db.prepare(`
      INSERT INTO forum_reports (reporter_id, post_id, topic_id, reason, details, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(reporterId, data.postId || null, data.topicId || null, data.reason, data.details || null);
  } finally {
    db.close();
  }
}

/**
 * Get pending reports with pagination
 */
export function getPendingReports(
  page: number = 1,
  limit: number = 20
): { reports: ForumReport[]; total: number } {
  const db = getDb();
  try {
    const offset = (page - 1) * limit;

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM forum_reports WHERE status = 'pending'
    `).get() as { count: number };

    const reports = db.prepare(`
      SELECT * FROM forum_reports
      WHERE status = 'pending'
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as ForumReport[];

    return { reports, total: total.count };
  } finally {
    db.close();
  }
}

/**
 * Review a report (mark as resolved/dismissed with action taken)
 */
export function reviewReport(id: number, reviewedBy: number, action: string): void {
  const db = getDb();
  try {
    db.prepare(`
      UPDATE forum_reports
      SET status = 'reviewed',
          reviewed_by = ?,
          reviewed_at = datetime('now'),
          action_taken = ?
      WHERE id = ?
    `).run(reviewedBy, action, id);
  } finally {
    db.close();
  }
}

// ============================================================
// Stats
// ============================================================

/**
 * Get forum-wide statistics
 */
export function getForumStats(): {
  totalTopics: number;
  totalPosts: number;
  totalUsers: number;
  activeToday: number;
  pendingReports: number;
} {
  const db = getDb();
  try {
    const topics = db.prepare('SELECT COUNT(*) as count FROM forum_topics WHERE is_deleted = 0').get() as { count: number };
    const posts = db.prepare('SELECT COUNT(*) as count FROM forum_posts WHERE is_deleted = 0').get() as { count: number };
    const users = db.prepare('SELECT COUNT(*) as count FROM forum_user_profiles').get() as { count: number };
    const activeToday = db.prepare(`
      SELECT COUNT(DISTINCT author_id) as count FROM forum_posts
      WHERE created_at >= datetime('now', '-1 day') AND is_deleted = 0
    `).get() as { count: number };
    const pendingReports = db.prepare("SELECT COUNT(*) as count FROM forum_reports WHERE status = 'pending'").get() as { count: number };

    return {
      totalTopics: topics.count,
      totalPosts: posts.count,
      totalUsers: users.count,
      activeToday: activeToday.count,
      pendingReports: pendingReports.count,
    };
  } finally {
    db.close();
  }
}
