import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { setForumUsername, checkUsernameAvailable } from '@/lib/forum-db';

const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;
const RESERVED_WORDS = [
  'admin', 'moderator', 'system', 'support', 'help', 'forum', 'root',
  'null', 'undefined', 'anonymous', 'deleted', 'bot', 'ai', 'mod',
  'staff', 'team', 'official',
];

function validateUsername(username: string): { valid: boolean; reason?: string } {
  if (!username || typeof username !== 'string') {
    return { valid: false, reason: 'Username is required' };
  }

  if (username.length < 3 || username.length > 20) {
    return { valid: false, reason: 'Username must be 3-20 characters' };
  }

  if (!USERNAME_REGEX.test(username)) {
    return { valid: false, reason: 'Username can only contain letters, numbers, underscores, and hyphens' };
  }

  if (RESERVED_WORDS.includes(username.toLowerCase())) {
    return { valid: false, reason: 'This username is reserved' };
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    const body = await request.json();
    const { username } = body;

    // Validate
    const validation = validateUsername(username);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }

    // Check availability
    if (!checkUsernameAvailable(username)) {
      return NextResponse.json(
        { error: 'This username is already taken' },
        { status: 409 }
      );
    }

    // Set username
    const success = setForumUsername(userId, username);
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to set username. It may already be taken.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, message: 'Forum username set', username });
  } catch (error) {
    console.error('[FORUM API] Error setting username:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
