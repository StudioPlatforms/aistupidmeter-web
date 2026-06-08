import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { checkUsernameAvailable } from '@/lib/forum-db';

const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;
const RESERVED_WORDS = [
  'admin', 'moderator', 'system', 'support', 'help', 'forum', 'root',
  'null', 'undefined', 'anonymous', 'deleted', 'bot', 'ai', 'mod',
  'staff', 'team', 'official',
];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ available: false, reason: 'Username is required' });
    }

    if (username.length < 3 || username.length > 20) {
      return NextResponse.json({ available: false, reason: 'Username must be 3-20 characters' });
    }

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json({ available: false, reason: 'Username can only contain letters, numbers, underscores, and hyphens' });
    }

    if (RESERVED_WORDS.includes(username.toLowerCase())) {
      return NextResponse.json({ available: false, reason: 'This username is reserved' });
    }

    const available = checkUsernameAvailable(username);

    return NextResponse.json({
      available,
      reason: available ? undefined : 'This username is already taken',
    });
  } catch (error) {
    console.error('[FORUM API] Error checking username:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
