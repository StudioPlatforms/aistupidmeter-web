'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import ForumLayout from '@/components/forum/ForumLayout';
import ForumBreadcrumbs from '@/components/forum/ForumBreadcrumbs';
import ForumSearch from '@/components/forum/ForumSearch';
import CategoryCard from '@/components/forum/CategoryCard';

interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  topic_count?: number;
  post_count?: number;
  is_locked?: number;
  last_post_at?: string;
  last_post_by?: string;
}

export default function ForumHomePage() {
  const { data: session, status } = useSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;

    const fetchCategories = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/forum/categories');
        const data = await res.json();

        if (data.success && data.categories) {
          setCategories(data.categories);
        } else {
          setError(data.error || 'Failed to load categories');
        }
      } catch {
        setError('Failed to connect to the forum. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [status]);

  return (
    <ForumLayout title="FORUM" subtitle="AI Stupid Meter Community — Discuss, share, and connect">
      <ForumBreadcrumbs items={[]} />
      <ForumSearch />

      {loading && (
        <div className="rv4-loading" style={{ minHeight: '200px' }}>
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <span>LOADING CATEGORIES</span>
        </div>
      )}

      {error && (
        <div className="rv4-error-banner">
          {error}
        </div>
      )}

      {!loading && !error && categories.length === 0 && (
        <div className="rv4-forum-empty">
          <div className="empty-icon">📋</div>
          <div className="empty-title">No Categories Yet</div>
          <div className="empty-text">
            The forum is being set up. Categories will appear here once an admin creates them.
          </div>
        </div>
      )}

      {!loading && !error && categories.length > 0 && (
        <div className="rv4-forum-categories">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      )}
    </ForumLayout>
  );
}
