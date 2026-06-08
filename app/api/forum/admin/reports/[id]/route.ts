import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { reviewReport } from '@/lib/forum-db';
import { requireRole } from '@/lib/forum-auth';

const VALID_ACTIONS = ['dismissed', 'warned', 'deleted', 'banned'];

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

    try {
      requireRole(userId, 'moderator');
    } catch {
      return NextResponse.json({ error: 'Forbidden: Moderator access required' }, { status: 403 });
    }

    const reportId = parseInt(params.id);
    if (isNaN(reportId)) {
      return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;

    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    reviewReport(reportId, userId, action);

    return NextResponse.json({ success: true, message: `Report reviewed with action: ${action}` });
  } catch (error) {
    console.error('[FORUM API] Error reviewing report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
