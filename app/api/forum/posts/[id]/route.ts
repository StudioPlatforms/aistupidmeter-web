import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPostsByTopic, updatePost, softDeletePost } from '@/lib/forum-db';
import { getForumUser, canModerate } from '@/lib/forum-auth';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_URL || '/root/data/stupid_meter.db';

function getPostById(postId: number) {
  const db = new Database(DB_PATH);
  try {
    return db.prepare(`
      SELECT * FROM forum_posts WHERE id = ? AND is_deleted = 0
    `).get(postId) as { id: number; topic_id: number; author_id: number; content: string; is_deleted: number } | undefined;
  } finally {
    db.close();
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get('topicId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    // If topicId is provided, get posts by topic (primary use case)
    if (topicId) {
      const { posts, total } = getPostsByTopic(parseInt(topicId), page, limit);
      const totalPages = Math.ceil(total / limit);

      return NextResponse.json({
        success: true,
        posts,
        total,
        page,
        limit,
        totalPages,
      });
    }

    // Otherwise get a single post by the route param id
    const postId = parseInt(params.id);
    if (isNaN(postId)) {
      return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
    }

    const post = getPostById(postId);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, post });
  } catch (error) {
    console.error('[FORUM API] Error fetching posts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    const post = getPostById(postId);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Check permission: author or moderator+
    const forumUser = getForumUser(userId);
    if (!forumUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (post.author_id !== userId && !canModerate(forumUser.role)) {
      return NextResponse.json(
        { error: 'Forbidden: You can only edit your own posts' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.length < 1 || content.length > 50000) {
      return NextResponse.json(
        { error: 'Content is required and must be 1-50000 characters' },
        { status: 400 }
      );
    }

    updatePost(postId, content, userId);

    return NextResponse.json({ success: true, message: 'Post updated' });
  } catch (error) {
    console.error('[FORUM API] Error updating post:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const post = getPostById(postId);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Check permission: author or moderator+
    const forumUser = getForumUser(userId);
    if (!forumUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (post.author_id !== userId && !canModerate(forumUser.role)) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own posts' },
        { status: 403 }
      );
    }

    softDeletePost(postId);

    return NextResponse.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    console.error('[FORUM API] Error deleting post:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
