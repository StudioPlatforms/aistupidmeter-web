import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getOrCreateForumProfile, updateForumProfile } from '@/lib/forum-db';
import { getForumUser } from '@/lib/forum-auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const profile = getOrCreateForumProfile(userId);
    const user = getForumUser(userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        email: user.email,
        name: user.name,
        forum_username: user.forum_username,
        role: user.role,
        avatar_url: user.avatar_url,
        subscription_tier: user.subscription_tier,
      },
    });
  } catch (error) {
    console.error('[FORUM API] Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    // Ensure profile exists
    getOrCreateForumProfile(userId);

    const body = await request.json();
    const { bio, location, website, signature, title } = body;

    // Validate field lengths
    if (bio !== undefined && typeof bio === 'string' && bio.length > 5000) {
      return NextResponse.json({ error: 'Bio must be 5000 characters or less' }, { status: 400 });
    }
    if (location !== undefined && typeof location === 'string' && location.length > 200) {
      return NextResponse.json({ error: 'Location must be 200 characters or less' }, { status: 400 });
    }
    if (website !== undefined && typeof website === 'string' && website.length > 500) {
      return NextResponse.json({ error: 'Website must be 500 characters or less' }, { status: 400 });
    }
    if (signature !== undefined && typeof signature === 'string' && signature.length > 500) {
      return NextResponse.json({ error: 'Signature must be 500 characters or less' }, { status: 400 });
    }
    if (title !== undefined && typeof title === 'string' && title.length > 100) {
      return NextResponse.json({ error: 'Title must be 100 characters or less' }, { status: 400 });
    }

    updateForumProfile(userId, {
      bio: bio !== undefined ? bio : undefined,
      location: location !== undefined ? location : undefined,
      website: website !== undefined ? website : undefined,
      signature: signature !== undefined ? signature : undefined,
      title: title !== undefined ? title : undefined,
    });

    return NextResponse.json({ success: true, message: 'Profile updated' });
  } catch (error) {
    console.error('[FORUM API] Error updating profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
