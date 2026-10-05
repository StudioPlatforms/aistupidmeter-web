import { NextResponse } from 'next/server';
import { initializeForumDatabase } from '@/lib/forum-db-init';
import { requireAdminSession } from '@/lib/admin-auth';

export async function POST() {
  // Idempotent, but a schema migration is not something the internet gets to trigger.
  const admin = await requireAdminSession();
  if (admin instanceof NextResponse) return admin;
  try {
    initializeForumDatabase();
    return NextResponse.json({ success: true, message: 'Forum database initialized' });
  } catch (error) {
    console.error('[FORUM API] Error initializing database:', error);
    return NextResponse.json(
      { error: 'Failed to initialize forum database' },
      { status: 500 }
    );
  }
}
