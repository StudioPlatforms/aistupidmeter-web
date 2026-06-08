import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTopicsByCategory, createTopic, getCategoryById } from '@/lib/forum-db';
import { getForumUser, hasForumUsername, isUserBanned, canModerate } from '@/lib/forum-auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    if (!categoryId) {
      return NextResponse.json(
        { error: 'categoryId query parameter is required' },
        { status: 400 }
      );
    }

    const { topics, total } = getTopicsByCategory(parseInt(categoryId), page, limit);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      topics,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error('[FORUM API] Error fetching topics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    // Check forum username
    const forumUser = getForumUser(userId);
    if (!forumUser || !hasForumUsername(forumUser)) {
      return NextResponse.json(
        { error: 'You must set a forum username before posting' },
        { status: 403 }
      );
    }

    // Check ban status
    if (isUserBanned(userId)) {
      return NextResponse.json(
        { error: 'Your account is currently banned from the forum' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { categoryId, title, content } = body;

    if (!categoryId || typeof categoryId !== 'number') {
      return NextResponse.json(
        { error: 'categoryId is required and must be a number' },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string' || title.length < 3 || title.length > 200) {
      return NextResponse.json(
        { error: 'Title is required and must be 3-200 characters' },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string' || content.length < 1 || content.length > 50000) {
      return NextResponse.json(
        { error: 'Content is required and must be 1-50000 characters' },
        { status: 400 }
      );
    }

    // Check if category is locked (e.g. Announcements) — only moderators+ can post
    const category = getCategoryById(categoryId);
    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    if (category.is_locked && !canModerate(forumUser.role)) {
      return NextResponse.json(
        { error: 'This category is restricted. Only moderators and admins can post here.' },
        { status: 403 }
      );
    }

    const topic = createTopic(categoryId, userId, title, content);

    return NextResponse.json({ success: true, topic }, { status: 201 });
  } catch (error) {
    console.error('[FORUM API] Error creating topic:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
