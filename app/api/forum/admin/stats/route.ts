import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getForumStats } from '@/lib/forum-db';
import { requireRole } from '@/lib/forum-auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    try {
      requireRole(userId, 'admin');
    } catch {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const stats = getForumStats();

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('[FORUM API] Error fetching forum stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
