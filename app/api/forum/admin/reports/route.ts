import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPendingReports } from '@/lib/forum-db';
import { requireRole } from '@/lib/forum-auth';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    const { reports, total } = getPendingReports(page, limit);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      reports,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error('[FORUM API] Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
