import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTopicById, updateTopic, softDeleteTopic } from '@/lib/forum-db';
import { getForumUser, canModerate } from '@/lib/forum-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid topic ID' }, { status: 400 });
    }

    const topic = getTopicById(id);

    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, topic });
  } catch (error) {
    console.error('[FORUM API] Error fetching topic:', error);
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
    const topicId = parseInt(params.id);
    if (isNaN(topicId)) {
      return NextResponse.json({ error: 'Invalid topic ID' }, { status: 400 });
    }

    const topic = getTopicById(topicId);
    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    // Check permission: author or moderator+
    const forumUser = getForumUser(userId);
    if (!forumUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (topic.author_id !== userId && !canModerate(forumUser.role)) {
      return NextResponse.json(
        { error: 'Forbidden: You can only edit your own topics' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== 'string' || title.length < 3 || title.length > 200) {
      return NextResponse.json(
        { error: 'Title is required and must be 3-200 characters' },
        { status: 400 }
      );
    }

    updateTopic(topicId, title);

    return NextResponse.json({ success: true, message: 'Topic updated' });
  } catch (error) {
    console.error('[FORUM API] Error updating topic:', error);
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
    const topicId = parseInt(params.id);
    if (isNaN(topicId)) {
      return NextResponse.json({ error: 'Invalid topic ID' }, { status: 400 });
    }

    const topic = getTopicById(topicId);
    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    // Check permission: author or moderator+
    const forumUser = getForumUser(userId);
    if (!forumUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (topic.author_id !== userId && !canModerate(forumUser.role)) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own topics' },
        { status: 403 }
      );
    }

    softDeleteTopic(topicId);

    return NextResponse.json({ success: true, message: 'Topic deleted' });
  } catch (error) {
    console.error('[FORUM API] Error deleting topic:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
