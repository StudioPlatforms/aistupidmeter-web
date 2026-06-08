import { NextResponse } from 'next/server';
import { initializeForumDatabase } from '@/lib/forum-db-init';

export async function POST() {
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
