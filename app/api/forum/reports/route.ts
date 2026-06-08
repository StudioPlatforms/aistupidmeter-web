import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createReport } from '@/lib/forum-db';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    const body = await request.json();
    const { postId, topicId, reason, details } = body;

    if (!postId && !topicId) {
      return NextResponse.json(
        { error: 'Either postId or topicId is required' },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== 'string' || reason.length < 1 || reason.length > 500) {
      return NextResponse.json(
        { error: 'Reason is required and must be 1-500 characters' },
        { status: 400 }
      );
    }

    if (details !== undefined && typeof details === 'string' && details.length > 2000) {
      return NextResponse.json(
        { error: 'Details must be 2000 characters or less' },
        { status: 400 }
      );
    }

    createReport(userId, {
      postId: postId || undefined,
      topicId: topicId || undefined,
      reason,
      details: details || undefined,
    });

    return NextResponse.json({ success: true, message: 'Report submitted' }, { status: 201 });
  } catch (error) {
    console.error('[FORUM API] Error creating report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
