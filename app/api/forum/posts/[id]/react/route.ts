import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { toggleReaction } from '@/lib/forum-db';

const VALID_REACTIONS = ['like', 'helpful', 'insightful'];

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

    const body = await request.json();
    const { reaction } = body;

    if (!reaction || !VALID_REACTIONS.includes(reaction)) {
      return NextResponse.json(
        { error: `Invalid reaction. Must be one of: ${VALID_REACTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    const result = toggleReaction(postId, userId, reaction);

    return NextResponse.json({ success: true, added: result.added });
  } catch (error) {
    console.error('[FORUM API] Error toggling reaction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
