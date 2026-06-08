import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createPost, getTopicById, getCategoryById } from '@/lib/forum-db';
import { getForumUser, hasForumUsername, isUserBanned, canModerate } from '@/lib/forum-auth';

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
    const { topicId, content, parentPostId } = body;

    if (!topicId || typeof topicId !== 'number') {
      return NextResponse.json(
        { error: 'topicId is required and must be a number' },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string' || content.length < 1 || content.length > 50000) {
      return NextResponse.json(
        { error: 'Content is required and must be 1-50000 characters' },
        { status: 400 }
      );
    }

    // Verify topic exists and is not locked
    const topic = getTopicById(topicId);
    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    if (topic.is_locked && !canModerate(forumUser.role)) {
      return NextResponse.json(
        { error: 'This topic is locked and cannot accept new replies' },
        { status: 403 }
      );
    }

    // Check if category is locked (e.g., Announcements) — only mods can reply
    const category = getCategoryById(topic.category_id);
    if (category?.is_locked && !canModerate(forumUser.role)) {
      return NextResponse.json(
        { error: 'This category is restricted. Only moderators and admins can reply here.' },
        { status: 403 }
      );
    }

    if (parentPostId !== undefined && parentPostId !== null && typeof parentPostId !== 'number') {
      return NextResponse.json(
        { error: 'parentPostId must be a number if provided' },
        { status: 400 }
      );
    }

    const post = createPost(topicId, userId, content, parentPostId || undefined);

    return NextResponse.json({ success: true, post }, { status: 201 });
  } catch (error) {
    console.error('[FORUM API] Error creating post:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
