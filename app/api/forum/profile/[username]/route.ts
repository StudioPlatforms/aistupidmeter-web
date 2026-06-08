import { NextRequest, NextResponse } from 'next/server';
import { getForumProfileByUsername } from '@/lib/forum-db';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_URL || '/root/data/stupid_meter.db';

function getRecentActivity(userId: number) {
  const db = new Database(DB_PATH);
  try {
    const recentTopics = db.prepare(`
      SELECT t.id, t.title, t.slug, t.created_at, c.name as category_name, c.slug as category_slug
      FROM forum_topics t
      LEFT JOIN forum_categories c ON t.category_id = c.id
      WHERE t.author_id = ? AND t.is_deleted = 0
      ORDER BY t.created_at DESC
      LIMIT 10
    `).all(userId) as { id: number; title: string; slug: string; created_at: string; category_name: string; category_slug: string }[];

    const recentPosts = db.prepare(`
      SELECT p.id, p.content, p.created_at, t.id as topic_id, t.title as topic_title, t.slug as topic_slug
      FROM forum_posts p
      JOIN forum_topics t ON p.topic_id = t.id
      WHERE p.author_id = ? AND p.is_deleted = 0 AND t.is_deleted = 0
      ORDER BY p.created_at DESC
      LIMIT 10
    `).all(userId) as { id: number; content: string; created_at: string; topic_id: number; topic_title: string; topic_slug: string }[];

    return { recentTopics, recentPosts };
  } finally {
    db.close();
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    const { username } = params;

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Invalid username' }, { status: 400 });
    }

    const profile = getForumProfileByUsername(username);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get recent activity
    const { recentTopics, recentPosts } = getRecentActivity(profile.user_id);

    // Remove sensitive fields
    const { email, ...safeProfile } = profile;

    return NextResponse.json({
      success: true,
      profile: safeProfile,
      recentTopics,
      recentPosts,
    });
  } catch (error) {
    console.error('[FORUM API] Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
