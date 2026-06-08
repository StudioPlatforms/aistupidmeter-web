import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { lockTopic, getTopicById } from '@/lib/forum-db';
import { requireRole } from '@/lib/forum-auth';

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

    try {
      requireRole(userId, 'moderator');
    } catch {
      return NextResponse.json({ error: 'Forbidden: Moderator access required' }, { status: 403 });
    }

    const topicId = parseInt(params.id);
    if (isNaN(topicId)) {
      return NextResponse.json({ error: 'Invalid topic ID' }, { status: 400 });
    }

    const topic = getTopicById(topicId);
    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    const body = await request.json();
    const { locked } = body;

    if (typeof locked !== 'boolean') {
      return NextResponse.json(
        { error: 'locked field is required and must be a boolean' },
        { status: 400 }
      );
    }

    lockTopic(topicId, locked);

    return NextResponse.json({ success: true, message: locked ? 'Topic locked' : 'Topic unlocked' });
  } catch (error) {
    console.error('[FORUM API] Error locking topic:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
