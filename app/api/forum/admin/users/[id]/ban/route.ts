import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { banUser, unbanUser } from '@/lib/forum-db';
import { requireRole, getForumUser, canModerate, canAdminister } from '@/lib/forum-auth';

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

    let currentUser;
    try {
      currentUser = requireRole(userId, 'moderator');
    } catch {
      return NextResponse.json({ error: 'Forbidden: Moderator access required' }, { status: 403 });
    }

    const targetUserId = parseInt(params.id);
    if (isNaN(targetUserId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // Cannot ban yourself
    if (targetUserId === userId) {
      return NextResponse.json({ error: 'You cannot ban yourself' }, { status: 400 });
    }

    // Check target user exists
    const targetUser = getForumUser(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    // Cannot ban moderators/admins unless you outrank them
    if (canModerate(targetUser.role) && !canAdminister(currentUser.role)) {
      return NextResponse.json(
        { error: 'You cannot ban a user with equal or higher privileges' },
        { status: 403 }
      );
    }

    if (canAdminister(targetUser.role)) {
      return NextResponse.json(
        { error: 'Admins and superadmins cannot be banned' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { reason, until } = body;

    if (!reason || typeof reason !== 'string' || reason.length < 1 || reason.length > 500) {
      return NextResponse.json(
        { error: 'Ban reason is required and must be 1-500 characters' },
        { status: 400 }
      );
    }

    banUser(targetUserId, reason, until || undefined);

    return NextResponse.json({ success: true, message: 'User banned' });
  } catch (error) {
    console.error('[FORUM API] Error banning user:', error);
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

    try {
      requireRole(userId, 'moderator');
    } catch {
      return NextResponse.json({ error: 'Forbidden: Moderator access required' }, { status: 403 });
    }

    const targetUserId = parseInt(params.id);
    if (isNaN(targetUserId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const targetUser = getForumUser(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    unbanUser(targetUserId);

    return NextResponse.json({ success: true, message: 'User unbanned' });
  } catch (error) {
    console.error('[FORUM API] Error unbanning user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
