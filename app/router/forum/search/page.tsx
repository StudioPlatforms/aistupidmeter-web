'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import ForumLayout from '@/components/forum/ForumLayout';
import ForumBreadcrumbs from '@/components/forum/ForumBreadcrumbs';
import ForumSearch from '@/components/forum/ForumSearch';
import TopicRow from '@/components/forum/TopicRow';

interface Topic {
  id: number;
  title: string;
  slug?: string;
  author_username?: string;
  is_pinned?: number;
  is_locked?: number;
  reply_count?: number;
  view_count?: number;
  created_at?: string;
  last_reply_at?: string;
  last_reply_by_username?: string;
}

function ForumSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const { data: session, status } = useSession();

  const [results, setResults] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated' || !query.trim()) return;

    const performSearch = async () => {
      setLoading(true);
      setSearched(false);

      try {
        // Fetch all categories and their topics, then filter client-side
        // This is a simple approach since we don't have full-text search
        const catRes = await fetch('/api/forum/categories');
        const catData = await catRes.json();

        if (!catData.success || !catData.categories) {
          setResults([]);
          setSearched(true);
          setLoading(false);
          return;
        }

        const allTopics: Topic[] = [];
        const lowerQuery = query.toLowerCase();

        // Fetch topics from each category
        for (const cat of catData.categories) {
          try {
            const topicsRes = await fetch(
              `/api/forum/topics?categoryId=${cat.id}&page=1&limit=100`
            );
            const topicsData = await topicsRes.json();

            if (topicsData.success && topicsData.topics) {
              for (const topic of topicsData.topics) {
                if (
                  topic.title?.toLowerCase().includes(lowerQuery) ||
                  topic.author_username?.toLowerCase().includes(lowerQuery)
                ) {
                  allTopics.push(topic);
                }
              }
            }
          } catch {
            // Skip failed category fetch
          }
        }

        setResults(allTopics);
      } catch {
        setResults([]);
      } finally {
        setSearched(true);
        setLoading(false);
      }
    };

    performSearch();
  }, [status, query]);

  return (
    <ForumLayout title="SEARCH" subtitle={query ? `Results for "${query}"` : 'Search the forum'}>
      <ForumBreadcrumbs items={[{ label: 'Search' }]} />

      <ForumSearch initialQuery={query} />

      {loading && (
        <div className="rv4-loading" style={{ minHeight: '200px' }}>
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <span>SEARCHING</span>
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="rv4-forum-empty">
          <div className="empty-icon">🔍</div>
          <div className="empty-title">No Results Found</div>
          <div className="empty-text">
            {query
              ? `No topics matching "${query}" were found. Try different keywords.`
              : 'Enter a search term to find topics.'}
          </div>
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          <div
            style={{
              fontSize: '10px',
              color: 'var(--phosphor-dim)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </div>
          <div className="rv4-forum-topics">
            {results.map((topic) => (
              <TopicRow key={topic.id} topic={topic} />
            ))}
          </div>
        </>
      )}

      {!query && !loading && !searched && (
        <div className="rv4-forum-empty">
          <div className="empty-icon">🔍</div>
          <div className="empty-title">Search the Forum</div>
          <div className="empty-text">
            Enter keywords above to search for topics by title or author.
          </div>
        </div>
      )}
    </ForumLayout>
  );
}

export default function ForumSearchPage() {
  return (
    <Suspense
      fallback={
        <ForumLayout title="SEARCH" subtitle="Search the forum">
          <div className="rv4-loading" style={{ minHeight: '200px' }}>
            <div className="rv4-loading-dot" />
            <div className="rv4-loading-dot" />
            <div className="rv4-loading-dot" />
            <span>LOADING</span>
          </div>
        </ForumLayout>
      }
    >
      <ForumSearchContent />
    </Suspense>
  );
}
