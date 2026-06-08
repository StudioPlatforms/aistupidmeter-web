import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCategories, createCategory, slugify } from '@/lib/forum-db';
import { requireRole, canAdminister } from '@/lib/forum-auth';

export async function GET() {
  try {
    const categories = getCategories();
    return NextResponse.json({ success: true, categories });
  } catch (error) {
    console.error('[FORUM API] Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, slug, description, icon, display_order, is_locked } = body;

    if (!name || typeof name !== 'string' || name.length < 1 || name.length > 100) {
      return NextResponse.json(
        { error: 'Category name is required and must be 1-100 characters' },
        { status: 400 }
      );
    }

    const categorySlug = slug || slugify(name);

    const category = createCategory({
      name,
      slug: categorySlug,
      description: description || undefined,
      icon: icon || undefined,
      display_order: display_order !== undefined ? display_order : 0,
      is_locked: is_locked ? 1 : 0,
      created_by: userId,
    });

    return NextResponse.json({ success: true, category }, { status: 201 });
  } catch (error) {
    console.error('[FORUM API] Error creating category:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
