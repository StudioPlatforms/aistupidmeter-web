import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { markAsSolution, getTopicById } from '@/lib/forum-db';
import { getForumUser, canModerate } from '@/lib/forum-auth';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_URL || '/root/data/stupid_meter.db';

function getPostTopicAuthor(postId: number) {
  const db = new Database(DB_PATH);
  try {
    return db.prepare(`
      SELECT p.topic_id, t.author_id as topic_author_id
      FROM forum_posts p
      JOIN forum_topics t ON p.topic_id = t.id
      WHERE p.id = ? AND p.is_deleted = 0
    `).get(postId) as { topic_id: number; topic_author_id: number } | undefined;
  } finally {
    db.close();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const postId = parseInt(params.id);
    if (isNaN(postId)) {
      return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
    }

    // Get post and topic info
    const postInfo = getPostTopicAuthor(postId);
    if (!postInfo) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Check permission: topic author or moderator+
    const forumUser = getForumUser(userId);
    if (!forumUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (postInfo.topic_author_id !== userId && !canModerate(forumUser.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only the topic author or moderators can mark solutions' },
        { status: 403 }
      );
    }

    markAsSolution(postId);

    return NextResponse.json({ success: true, message: 'Post marked as solution' });
  } catch (error) {
    console.error('[FORUM API] Error marking solution:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
