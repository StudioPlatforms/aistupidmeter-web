/**
 * Forum Database Initialization & Migration
 * Creates all forum-related tables and seeds default categories
 */

import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_URL || '/root/data/stupid_meter.db';

function getDb() {
  return new Database(DB_PATH);
}

/**
 * Add forum-related columns to router_users table
 */
function migrateRouterUsers(db: Database.Database): void {
  // Check if columns already exist before adding
  const tableInfo = db.prepare("PRAGMA table_info(router_users)").all() as { name: string }[];
  const columnNames = tableInfo.map((col) => col.name);

  if (!columnNames.includes('role')) {
    db.prepare("ALTER TABLE router_users ADD COLUMN role TEXT DEFAULT 'user'").run();
  }

  if (!columnNames.includes('forum_username')) {
    db.prepare("ALTER TABLE router_users ADD COLUMN forum_username TEXT").run();
  }

  if (!columnNames.includes('forum_username_set_at')) {
    db.prepare("ALTER TABLE router_users ADD COLUMN forum_username_set_at TEXT").run();
  }

  // Create unique case-insensitive index on forum_username
  db.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_forum_username
    ON router_users(forum_username COLLATE NOCASE)
  `).run();
}

/**
 * Create forum_categories table
 */
function createCategoriesTable(db: Database.Database): void {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS forum_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      icon TEXT,
      display_order INTEGER DEFAULT 0,
      is_locked INTEGER DEFAULT 0,
      created_by INTEGER,
      topic_count INTEGER DEFAULT 0,
      post_count INTEGER DEFAULT 0,
      last_post_at TEXT,
      last_post_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES router_users(id),
      FOREIGN KEY (last_post_by) REFERENCES router_users(id)
    )
  `).run();
}

/**
 * Create forum_topics table
 */
function createTopicsTable(db: Database.Database): void {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS forum_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      is_pinned INTEGER DEFAULT 0,
      is_locked INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      reply_count INTEGER DEFAULT 0,
      last_reply_at TEXT,
      last_reply_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES forum_categories(id),
      FOREIGN KEY (author_id) REFERENCES router_users(id),
      FOREIGN KEY (last_reply_by) REFERENCES router_users(id)
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_forum_topics_category_id
    ON forum_topics(category_id)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_forum_topics_author_id
    ON forum_topics(author_id)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_forum_topics_slug
    ON forum_topics(slug)
  `).run();
}

/**
 * Create forum_posts table
 */
function createPostsTable(db: Database.Database): void {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS forum_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      is_solution INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      edited_at TEXT,
      edited_by INTEGER,
      parent_post_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (topic_id) REFERENCES forum_topics(id),
      FOREIGN KEY (author_id) REFERENCES router_users(id),
      FOREIGN KEY (edited_by) REFERENCES router_users(id),
      FOREIGN KEY (parent_post_id) REFERENCES forum_posts(id)
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_forum_posts_topic_id
    ON forum_posts(topic_id)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_forum_posts_author_id
    ON forum_posts(author_id)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_forum_posts_parent_post_id
    ON forum_posts(parent_post_id)
  `).run();
}

/**
 * Create forum_user_profiles table
 */
function createUserProfilesTable(db: Database.Database): void {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS forum_user_profiles (
      user_id INTEGER PRIMARY KEY,
      bio TEXT,
      location TEXT,
      website TEXT,
      signature TEXT,
      avatar_type TEXT DEFAULT 'default',
      custom_avatar_url TEXT,
      topic_count INTEGER DEFAULT 0,
      post_count INTEGER DEFAULT 0,
      reputation INTEGER DEFAULT 0,
      title TEXT,
      is_banned INTEGER DEFAULT 0,
      ban_reason TEXT,
      banned_until TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES router_users(id)
    )
  `).run();
}

/**
 * Create forum_post_reactions table
 */
function createPostReactionsTable(db: Database.Database): void {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS forum_post_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reaction TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(post_id, user_id, reaction),
      FOREIGN KEY (post_id) REFERENCES forum_posts(id),
      FOREIGN KEY (user_id) REFERENCES router_users(id)
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_forum_post_reactions_post_id
    ON forum_post_reactions(post_id)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_forum_post_reactions_user_id
    ON forum_post_reactions(user_id)
  `).run();
}

/**
 * Create forum_reports table
 */
function createReportsTable(db: Database.Database): void {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS forum_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL,
      post_id INTEGER,
      topic_id INTEGER,
      reason TEXT NOT NULL,
      details TEXT,
      status TEXT DEFAULT 'pending',
      reviewed_by INTEGER,
      reviewed_at TEXT,
      action_taken TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (reporter_id) REFERENCES router_users(id),
      FOREIGN KEY (post_id) REFERENCES forum_posts(id),
      FOREIGN KEY (topic_id) REFERENCES forum_topics(id),
      FOREIGN KEY (reviewed_by) REFERENCES router_users(id)
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_forum_reports_reporter_id
    ON forum_reports(reporter_id)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_forum_reports_status
    ON forum_reports(status)
  `).run();
}

/**
 * Seed default forum categories
 */
function seedDefaultCategories(db: Database.Database): void {
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM forum_categories').get() as { count: number };
  if (existingCount.count > 0) {
    return; // Already seeded
  }

  const categories = [
    { name: 'General Discussion', slug: 'general', description: 'Chat about anything AI-related', icon: '💬', display_order: 1, is_locked: 0 },
    { name: 'AI Model Reviews', slug: 'model-reviews', description: 'Share and read reviews of AI models', icon: '🔍', display_order: 2, is_locked: 0 },
    { name: 'Router Tips & Tricks', slug: 'router-tips', description: 'Tips for getting the most out of the AI router', icon: '🛠️', display_order: 3, is_locked: 0 },
    { name: 'Bug Reports', slug: 'bug-reports', description: 'Report bugs and issues', icon: '🐛', display_order: 4, is_locked: 0 },
    { name: 'Feature Requests', slug: 'feature-requests', description: 'Suggest new features and improvements', icon: '💡', display_order: 5, is_locked: 0 },
    { name: 'Benchmarks & Data', slug: 'benchmarks', description: 'Share benchmark results and data analysis', icon: '📊', display_order: 6, is_locked: 0 },
    { name: 'Off-Topic', slug: 'off-topic', description: 'Non-AI discussions and casual chat', icon: '🎲', display_order: 7, is_locked: 0 },
    { name: 'Announcements', slug: 'announcements', description: 'Official announcements and updates', icon: '📢', display_order: 8, is_locked: 1 },
  ];

  const insertStmt = db.prepare(`
    INSERT INTO forum_categories (name, slug, description, icon, display_order, is_locked, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const insertMany = db.transaction((cats: typeof categories) => {
    for (const cat of cats) {
      insertStmt.run(cat.name, cat.slug, cat.description, cat.icon, cat.display_order, cat.is_locked);
    }
  });

  insertMany(categories);
}

/**
 * Initialize the forum database — run all migrations and seed data
 */
export function initializeForumDatabase(): void {
  const db = getDb();
  try {
    // Enable WAL mode for better concurrent access
    db.pragma('journal_mode = WAL');

    // Run all migrations
    migrateRouterUsers(db);
    createCategoriesTable(db);
    createTopicsTable(db);
    createPostsTable(db);
    createUserProfilesTable(db);
    createPostReactionsTable(db);
    createReportsTable(db);

    // Seed default data
    seedDefaultCategories(db);

    console.log('[FORUM] Database initialized successfully');
  } finally {
    db.close();
  }
}
