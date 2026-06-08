'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import ForumLayout from '@/components/forum/ForumLayout';
import ForumBreadcrumbs from '@/components/forum/ForumBreadcrumbs';
import TopicRow from '@/components/forum/TopicRow';
import ForumPagination from '@/components/forum/ForumPagination';
import { canModerate } from '@/components/forum/forum-utils';

interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  is_locked?: number;
}

interface Topic {
  id: number;
  title: string;
  slug?: string;
  author_username?: string;
  author_avatar?: string;
  is_pinned?: number;
  is_locked?: number;
  reply_count?: number;
  view_count?: number;
  created_at?: string;
  last_reply_at?: string;
  last_reply_by_username?: string;
}

export default function CategoryPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const { data: session, status } = useSession();

  const [category, setCategory] = useState<Category | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isGuest = !session?.user;
  const userRole = (session?.user as any)?.role;
  const isMod = canModerate(userRole);

  useEffect(() => {
    if (status === 'loading' || !slug) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        // Fetch category info
        const catRes = await fetch(`/api/forum/categories/${slug}`);
        const catData = await catRes.json();

        if (!catRes.ok || !catData.success) {
          setError(catData.error || 'Category not found');
          setLoading(false);
          return;
        }

        setCategory(catData.category);

        // Fetch topics
        const topicsRes = await fetch(
          `/api/forum/topics?categoryId=${catData.category.id}&page=${page}&limit=20`
        );
        const topicsData = await topicsRes.json();

        if (topicsData.success) {
          setTopics(topicsData.topics || []);
          setTotalPages(topicsData.totalPages || 1);
        }
      } catch {
        setError('Failed to load category. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [status, slug, page]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <ForumLayout title={category?.name || 'CATEGORY'} subtitle={category?.description}>
      <ForumBreadcrumbs
        items={category ? [{ label: category.name }] : [{ label: 'Loading…' }]}
      />

      {/* New Topic button — hidden for guests */}
      {!isGuest && category && (!category.is_locked || isMod) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button
            className="rv4-ctrl-btn primary"
            onClick={() => router.push(`/router/forum/topic/new?category=${slug}`)}
            style={{ fontSize: '11px', letterSpacing: '0.5px' }}
          >
            + NEW TOPIC
          </button>
        </div>
      )}

      {/* Locked notice */}
      {category?.is_locked && !isMod ? (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(255,45,0,0.06)',
            border: '1px solid rgba(255,45,0,0.2)',
            borderRadius: '3px',
            fontSize: '11px',
            color: 'var(--red-alert)',
            marginBottom: '12px',
          }}
        >
          🔒 This category is locked. New topics cannot be created.
        </div>
      ) : null}

      {/* FAB for mobile — hidden for guests */}
      {!isGuest && category && (!category.is_locked || isMod) && (
        <button
          className="rv4-forum-fab"
          onClick={() => router.push(`/router/forum/topic/new?category=${slug}`)}
          aria-label="New Topic"
        >
          +
        </button>
      )}

      {loading && (
        <div className="rv4-loading" style={{ minHeight: '200px' }}>
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <span>LOADING TOPICS</span>
        </div>
      )}

      {error && <div className="rv4-error-banner">{error}</div>}

      {!loading && !error && topics.length === 0 && (
        <div className="rv4-forum-empty">
          <div className="empty-icon">💬</div>
          <div className="empty-title">No Topics Yet</div>
          <div className="empty-text">
            Be the first to start a discussion in this category.
          </div>
          {(!category?.is_locked || isMod) && (
            <div className="empty-action">
              <button
                className="rv4-ctrl-btn primary"
                onClick={() => router.push(`/router/forum/topic/new?category=${slug}`)}
              >
                CREATE FIRST TOPIC
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && !error && topics.length > 0 && (
        <>
          <div className="rv4-forum-topics">
            {topics.map((topic) => (
              <TopicRow key={topic.id} topic={topic} />
            ))}
          </div>
          <ForumPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </ForumLayout>
  );
}
