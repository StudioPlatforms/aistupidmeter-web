import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { requireRole } from '@/lib/forum-auth';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_URL || '/root/data/stupid_meter.db';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || '';
    const roleFilter = searchParams.get('role') || '';
    const offset = (page - 1) * limit;

    const db = new Database(DB_PATH);
    try {
      let whereClause = '1=1';
      const params: any[] = [];

      if (search) {
        whereClause += ' AND (u.email LIKE ? OR u.name LIKE ? OR u.forum_username LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      if (roleFilter) {
        whereClause += ' AND u.role = ?';
        params.push(roleFilter);
      }

      const total = db.prepare(`
        SELECT COUNT(*) as count
        FROM router_users u
        WHERE ${whereClause}
      `).get(...params) as { count: number };

      const users = db.prepare(`
        SELECT
          u.id,
          u.email,
          u.name,
          u.role,
          u.forum_username,
          u.avatar_url,
          u.subscription_tier,
          u.created_at,
          fp.is_banned,
          fp.ban_reason,
          fp.banned_until,
          fp.topic_count,
          fp.post_count,
          fp.reputation
        FROM router_users u
        LEFT JOIN forum_user_profiles fp ON u.id = fp.user_id
        WHERE ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset) as any[];

      const totalPages = Math.ceil(total.count / limit);

      return NextResponse.json({
        success: true,
        users,
        total: total.count,
        page,
        limit,
        totalPages,
      });
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('[FORUM API] Error fetching admin users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
