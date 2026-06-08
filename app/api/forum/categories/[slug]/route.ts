import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCategoryBySlug, updateCategory, deleteCategory } from '@/lib/forum-db';
import { requireRole } from '@/lib/forum-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const category = getCategoryBySlug(slug);

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error('[FORUM API] Error fetching category:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
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

    const { slug } = params;
    const category = getCategoryBySlug(slug);

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, slug: newSlug, description, icon, display_order, is_locked } = body;

    if (name !== undefined && (typeof name !== 'string' || name.length < 1 || name.length > 100)) {
      return NextResponse.json(
        { error: 'Category name must be 1-100 characters' },
        { status: 400 }
      );
    }

    updateCategory(category.id, {
      name,
      slug: newSlug,
      description,
      icon,
      display_order,
      is_locked: is_locked !== undefined ? (is_locked ? 1 : 0) : undefined,
    });

    return NextResponse.json({ success: true, message: 'Category updated' });
  } catch (error) {
    console.error('[FORUM API] Error updating category:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
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

    const { slug } = params;
    const category = getCategoryBySlug(slug);

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    deleteCategory(category.id);

    return NextResponse.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    console.error('[FORUM API] Error deleting category:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
