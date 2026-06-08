import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { requireRole, getForumUser, isSuperAdmin, canAdminister } from '@/lib/forum-auth';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_URL || '/root/data/stupid_meter.db';
const VALID_ROLES = ['user', 'moderator', 'admin'];

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

    // Must be admin+
    let currentUser;
    try {
      currentUser = requireRole(userId, 'admin');
    } catch {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const targetUserId = parseInt(params.id);
    if (isNaN(targetUserId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const body = await request.json();
    const { role } = body;

    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    // Only superadmin can assign admin role
    if (role === 'admin' && !isSuperAdmin(currentUser.role)) {
      return NextResponse.json(
        { error: 'Only superadmins can assign the admin role' },
        { status: 403 }
      );
    }

    // Cannot change your own role
    if (targetUserId === userId) {
      return NextResponse.json(
        { error: 'You cannot change your own role' },
        { status: 400 }
      );
    }

    // Check target user exists
    const targetUser = getForumUser(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    // Cannot change role of a superadmin
    if (isSuperAdmin(targetUser.role)) {
      return NextResponse.json(
        { error: 'Cannot change the role of a superadmin' },
        { status: 403 }
      );
    }

    // Admin can only demote other admins if they are superadmin
    if (canAdminister(targetUser.role) && !isSuperAdmin(currentUser.role)) {
      return NextResponse.json(
        { error: 'Only superadmins can change the role of admins' },
        { status: 403 }
      );
    }

    const db = new Database(DB_PATH);
    try {
      db.prepare(`
        UPDATE router_users SET role = ?, updated_at = datetime('now') WHERE id = ?
      `).run(role, targetUserId);
    } finally {
      db.close();
    }

    return NextResponse.json({ success: true, message: `User role updated to ${role}` });
  } catch (error) {
    console.error('[FORUM API] Error updating user role:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
