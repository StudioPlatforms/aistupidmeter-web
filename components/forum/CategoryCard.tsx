'use client';

import { useRouter } from 'next/navigation';
import { formatDate } from './forum-utils';

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

interface CategoryCardProps {
  category: Category;
}

export default function CategoryCard({ category }: CategoryCardProps) {
  const router = useRouter();

  return (
    <div
      className="rv4-forum-category-card"
      onClick={() => router.push(`/router/forum/category/${category.slug}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          router.push(`/router/forum/category/${category.slug}`);
        }
      }}
    >
      <div className="rv4-forum-category-icon">
        {category.icon || '💬'}
      </div>

      <div className="rv4-forum-category-info">
        <div className="rv4-forum-category-name">{category.name}</div>
        {category.description && (
          <div className="rv4-forum-category-desc">{category.description}</div>
        )}
      </div>

      <div className="rv4-forum-category-stats">
        <span>
          <strong>{category.topic_count ?? 0}</strong> topics
        </span>
        <span>
          <strong>{category.post_count ?? 0}</strong> posts
        </span>
      </div>

      {category.last_post_at && (
        <div className="rv4-forum-category-last-post">
          {category.last_post_by && (
            <div className="last-post-title">by {category.last_post_by}</div>
          )}
          <div className="last-post-meta">{formatDate(category.last_post_at)}</div>
        </div>
      )}

      {category.is_locked ? (
        <span className="rv4-forum-category-locked">🔒 Locked</span>
      ) : null}
    </div>
  );
}
