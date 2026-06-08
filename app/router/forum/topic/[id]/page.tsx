'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import ForumLayout from '@/components/forum/ForumLayout';
import ForumBreadcrumbs from '@/components/forum/ForumBreadcrumbs';
import PostCard from '@/components/forum/PostCard';
import PostEditor from '@/components/forum/PostEditor';
import TopicModerationBar from '@/components/forum/TopicModerationBar';
import ForumPagination from '@/components/forum/ForumPagination';
import { formatDate, canModerate as canMod } from '@/components/forum/forum-utils';

interface TopicDetail {
  id: number;
  title: string;
  slug?: string;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  category_is_locked?: number;
  author_id: number;
  author_username?: string;
  is_pinned?: number;
  is_locked?: number;
  view_count?: number;
  created_at?: string;
}

interface Post {
  id: number;
  topic_id: number;
  author_id: number;
  author_username?: string;
  author_avatar?: string;
  author_role?: string;
  content: string;
  is_solution?: number;
  reactions?: Record<string, number>;
  user_reactions?: string[];
  created_at?: string;
  updated_at?: string;
}

export default function TopicDetailPage() {
  const router = useRouter();
  const params = useParams();
  const topicId = params.id as string;
  const { data: session, status } = useSession();

  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  const currentUserId = session?.user?.id;
  const userRole = (session?.user as any)?.role;
  const forumUsername = (session?.user as any)?.forumUsername;
  const isModerator = canMod(userRole);
  const isTopicAuthor = topic ? topic.author_id.toString() === currentUserId : false;

  const fetchTopicAndPosts = useCallback(async () => {
    if (!topicId) return;
    try {
      setLoading(true);
      setError('');

      // Fetch topic
      const topicRes = await fetch(`/api/forum/topics/${topicId}`);
      const topicData = await topicRes.json();

      if (!topicRes.ok || !topicData.success) {
        setError(topicData.error || 'Topic not found');
        setLoading(false);
        return;
      }

      setTopic(topicData.topic);

      // Fetch posts using the topic's ID
      const postsRes = await fetch(
        `/api/forum/posts/${topicId}?topicId=${topicId}&page=${page}&limit=20`
      );
      const postsData = await postsRes.json();

      if (postsData.success) {
        setPosts(postsData.posts || []);
        setTotalPages(postsData.totalPages || 1);
      }
    } catch {
      setError('Failed to load topic. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [topicId, page]);

  useEffect(() => {
    if (status === 'loading') return;
    fetchTopicAndPosts();
  }, [status, fetchTopicAndPosts]);

  const handleReact = async (postId: number, reaction: string) => {
    try {
      const res = await fetch(`/api/forum/posts/${postId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction }),
      });

      if (res.ok) {
        // Refresh posts to get updated reactions
        const postsRes = await fetch(
          `/api/forum/posts/${topicId}?topicId=${topicId}&page=${page}&limit=20`
        );
        const postsData = await postsRes.json();
        if (postsData.success) {
          setPosts(postsData.posts || []);
        }
      }
    } catch {
      // Silently handle
    }
  };

  const handleEditPost = async (postId: number, content: string) => {
    try {
      const res = await fetch(`/api/forum/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        await fetchTopicAndPosts();
      }
    } catch {
      // Silently handle
    }
  };

  const handleDeletePost = async (postId: number) => {
    try {
      const res = await fetch(`/api/forum/posts/${postId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchTopicAndPosts();
      }
    } catch {
      // Silently handle
    }
  };

  const handleMarkSolution = async (postId: number) => {
    try {
      const res = await fetch(`/api/forum/posts/${postId}/solution`, {
        method: 'POST',
      });

      if (res.ok) {
        await fetchTopicAndPosts();
      }
    } catch {
      // Silently handle
    }
  };

  const handleReply = async (content: string) => {
    if (!topic) return;
    setReplySubmitting(true);

    try {
      const res = await fetch('/api/forum/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: topic.id,
          content,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Go to last page to see new reply
        const postsRes = await fetch(
          `/api/forum/posts/${topicId}?topicId=${topicId}&page=1&limit=20`
        );
        const postsData = await postsRes.json();
        const lastPage = postsData.totalPages || 1;
        setPage(lastPage);
        await fetchTopicAndPosts();
      }
    } catch {
      // Silently handle
    } finally {
      setReplySubmitting(false);
    }
  };

  const handlePin = async () => {
    if (!topic) return;
    try {
      await fetch(`/api/forum/topics/${topic.id}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !topic.is_pinned }),
      });
      await fetchTopicAndPosts();
    } catch {
      // Silently handle
    }
  };

  const handleLock = async () => {
    if (!topic) return;
    try {
      await fetch(`/api/forum/topics/${topic.id}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: !topic.is_locked }),
      });
      await fetchTopicAndPosts();
    } catch {
      // Silently handle
    }
  };

  const handleDeleteTopic = async () => {
    if (!topic) return;
    try {
      const res = await fetch(`/api/forum/topics/${topic.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/router/forum');
      }
    } catch {
      // Silently handle
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <ForumLayout title={topic?.title || 'TOPIC'}>
      <ForumBreadcrumbs
        items={[
          ...(topic?.category_name
            ? [
                {
                  label: topic.category_name,
                  href: `/router/forum/category/${topic.category_slug}`,
                },
              ]
            : []),
          { label: topic?.title || 'Loading…' },
        ]}
      />

      {loading && (
        <div className="rv4-loading" style={{ minHeight: '200px' }}>
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <span>LOADING TOPIC</span>
        </div>
      )}

      {error && <div className="rv4-error-banner">{error}</div>}

      {!loading && !error && topic && (
        <>
          {/* Topic header info */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '12px',
              flexWrap: 'wrap',
              fontSize: '10px',
              color: 'var(--phosphor-dim)',
            }}
          >
            {topic.is_pinned ? (
              <span className="rv4-forum-pin-badge">📌 Pinned</span>
            ) : null}
            {topic.is_locked ? (
              <span className="rv4-forum-category-locked">🔒 Locked</span>
            ) : null}
            <span>by {topic.author_username || 'Unknown'}</span>
            <span>·</span>
            <span>{formatDate(topic.created_at)}</span>
            <span>·</span>
            <span>👁 {topic.view_count ?? 0} views</span>
          </div>

          {/* Moderation bar for mods, or delete-only for topic author */}
          {isModerator ? (
            <TopicModerationBar
              topic={topic}
              onPin={handlePin}
              onLock={handleLock}
              onDelete={handleDeleteTopic}
            />
          ) : isTopicAuthor ? (
            <div className="rv4-forum-mod-bar">
              <button
                className="rv4-forum-mod-btn danger"
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this topic? This cannot be undone.')) {
                    handleDeleteTopic();
                  }
                }}
              >
                🗑 Delete My Topic
              </button>
            </div>
          ) : null}

          {/* Posts */}
          <div className="rv4-forum-thread">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                onReact={handleReact}
                onEdit={handleEditPost}
                onDelete={handleDeletePost}
                onMarkSolution={handleMarkSolution}
                canModerate={isModerator}
                isTopicAuthor={isTopicAuthor}
              />
            ))}
          </div>

          {/* Pagination */}
          <ForumPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />

          {/* Reply editor — hidden if topic or category is locked (unless user is moderator+) */}
          {(() => {
            const isGuest = !currentUserId;
            const isLocked = !!(topic.is_locked || topic.category_is_locked);
            const canReply = forumUsername && (!isLocked || isModerator);

            if (isGuest) {
              return (
                <div
                  style={{
                    padding: '14px',
                    background: 'rgba(0,191,255,0.06)',
                    border: '1px solid rgba(0,191,255,0.25)',
                    borderRadius: '3px',
                    fontSize: '11px',
                    color: 'var(--phosphor-green)',
                    textAlign: 'center',
                    marginTop: '16px',
                  }}
                >
                  💬 Want to join the discussion?{' '}
                  <a href="/auth/signin?callbackUrl=/router/forum" style={{ color: 'var(--phosphor-green)', textDecoration: 'underline' }}>Sign in</a>
                  {' '}or{' '}
                  <a href="/auth/signup?callbackUrl=/router/forum" style={{ color: 'var(--phosphor-green)', textDecoration: 'underline' }}>create an account</a>
                  {' '}to reply.
                </div>
              );
            }

            if (canReply) {
              return (
                <div style={{ marginTop: '16px' }}>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: 'var(--phosphor-green)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '8px',
                    }}
                  >
                    Reply to this topic
                  </div>
                  <PostEditor
                    onSubmit={handleReply}
                    placeholder="Write your reply… (Markdown supported)"
                    submitLabel="POST REPLY"
                    isSubmitting={replySubmitting}
                  />
                </div>
              );
            }

            if (isLocked) {
              return (
                <div
                  style={{
                    padding: '14px',
                    background: 'rgba(255,45,0,0.06)',
                    border: '1px solid rgba(255,45,0,0.2)',
                    borderRadius: '3px',
                    fontSize: '11px',
                    color: 'var(--red-alert)',
                    textAlign: 'center',
                    marginTop: '16px',
                  }}
                >
                  🔒 {topic.is_locked
                    ? 'This topic is locked. No new replies can be posted.'
                    : 'This category is restricted. Only moderators and admins can reply here.'}
                </div>
              );
            }

            return null;
          })()}
        </>
      )}
    </ForumLayout>
  );
}
