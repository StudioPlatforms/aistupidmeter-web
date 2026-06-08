'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import ForumLayout from '@/components/forum/ForumLayout';
import ForumBreadcrumbs from '@/components/forum/ForumBreadcrumbs';
import PostEditor from '@/components/forum/PostEditor';

interface Category {
  id: number;
  name: string;
  slug: string;
  is_locked?: number;
}

function NewTopicContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get('category') || '';
  const { data: session, status } = useSession();

  const userRole = (session?.user as any)?.role || 'user';
  const isMod = userRole === 'moderator' || userRole === 'admin' || userRole === 'superadmin';

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch categories for dropdown
  useEffect(() => {
    if (status !== 'authenticated') return;

    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/forum/categories');
        const data = await res.json();

        if (data.success && data.categories) {
          setCategories(data.categories);

          // Pre-select category from query param
          if (categorySlug) {
            const match = data.categories.find(
              (c: Category) => c.slug === categorySlug
            );
            if (match) {
              setSelectedCategoryId(match.id);
            }
          }
        }
      } catch {
        setError('Failed to load categories');
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [status, categorySlug]);

  const handleSubmit = async (content: string) => {
    if (!title.trim() || title.trim().length < 3) {
      setError('Title must be at least 3 characters');
      return;
    }
    if (title.trim().length > 200) {
      setError('Title must be 200 characters or less');
      return;
    }
    if (!selectedCategoryId) {
      setError('Please select a category');
      return;
    }
    if (!content.trim()) {
      setError('Content is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/forum/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: selectedCategoryId,
          title: title.trim(),
          content: content.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.topic) {
        router.push(`/router/forum/topic/${data.topic.id}`);
      } else {
        setError(data.error || 'Failed to create topic');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  return (
    <ForumLayout title="NEW TOPIC" subtitle="Start a new discussion">
      <ForumBreadcrumbs
        items={[
          ...(selectedCategory
            ? [{ label: selectedCategory.name, href: `/router/forum/category/${selectedCategory.slug}` }]
            : []),
          { label: 'New Topic' },
        ]}
      />

      {loading ? (
        <div className="rv4-loading" style={{ minHeight: '200px' }}>
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <span>LOADING</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {error && <div className="rv4-error-banner">{error}</div>}

          {/* Category selector */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '10px',
                fontWeight: 'bold',
                color: 'var(--phosphor-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                marginBottom: '6px',
              }}
            >
              Category
            </label>
            <select
              value={selectedCategoryId || ''}
              onChange={(e) => setSelectedCategoryId(Number(e.target.value) || null)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--terminal-black, #0a0a0a)',
                border: '1px solid rgba(192,192,192,0.3)',
                borderRadius: '2px',
                color: 'var(--phosphor-green)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                minHeight: '44px',
              }}
            >
              <option value="">Select a category…</option>
              {categories
                .filter((c) => !c.is_locked || isMod)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.is_locked ? ' 🔒' : ''}
                  </option>
                ))}
            </select>
          </div>

          {/* Title input */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '10px',
                fontWeight: 'bold',
                color: 'var(--phosphor-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                marginBottom: '6px',
              }}
            >
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter topic title…"
              maxLength={200}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--terminal-black, #0a0a0a)',
                border: '1px solid rgba(192,192,192,0.3)',
                borderRadius: '2px',
                color: 'var(--phosphor-green)',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: 'bold',
                boxSizing: 'border-box',
                minHeight: '44px',
              }}
            />
            <div
              style={{
                fontSize: '9px',
                color: 'var(--phosphor-dim)',
                marginTop: '4px',
                textAlign: 'right',
              }}
            >
              {title.length}/200
            </div>
          </div>

          {/* Content editor */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '10px',
                fontWeight: 'bold',
                color: 'var(--phosphor-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                marginBottom: '6px',
              }}
            >
              Content
            </label>
            <PostEditor
              onSubmit={handleSubmit}
              onCancel={() => router.back()}
              placeholder="Write your topic content… (Markdown supported)"
              submitLabel="CREATE TOPIC"
              isSubmitting={submitting}
            />
          </div>
        </div>
      )}
    </ForumLayout>
  );
}

export default function NewTopicPage() {
  return (
    <Suspense
      fallback={
        <ForumLayout title="NEW TOPIC" subtitle="Start a new discussion">
          <div className="rv4-loading" style={{ minHeight: '200px' }}>
            <div className="rv4-loading-dot" />
            <div className="rv4-loading-dot" />
            <div className="rv4-loading-dot" />
            <span>LOADING</span>
          </div>
        </ForumLayout>
      }
    >
      <NewTopicContent />
    </Suspense>
  );
}
