'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import ForumLayout from '@/components/forum/ForumLayout';
import ForumBreadcrumbs from '@/components/forum/ForumBreadcrumbs';
import ForumProfileCard from '@/components/forum/ForumProfileCard';
import { formatDate } from '@/components/forum/forum-utils';

interface Profile {
  user_id: number;
  forum_username?: string;
  username?: string;
  avatar_url?: string;
  role?: string;
  bio?: string;
  location?: string;
  website?: string;
  topic_count?: number;
  post_count?: number;
  reputation?: number;
  title?: string;
  created_at?: string;
}

interface RecentTopic {
  id: number;
  title: string;
  slug: string;
  created_at: string;
  category_name: string;
  category_slug: string;
}

interface RecentPost {
  id: number;
  content: string;
  created_at: string;
  topic_id: number;
  topic_title: string;
  topic_slug: string;
}

export default function ForumProfilePage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  const { data: session, status } = useSession();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentTopics, setRecentTopics] = useState<RecentTopic[]>([]);
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [activeTab, setActiveTab] = useState<'topics' | 'posts'>('topics');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isOwnProfile =
    session?.user && (session.user as any).forumUsername === username;

  useEffect(() => {
    if (status !== 'authenticated' || !username) return;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/forum/profile/${encodeURIComponent(username)}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setProfile(data.profile);
          setRecentTopics(data.recentTopics || []);
          setRecentPosts(data.recentPosts || []);
        } else {
          setError(data.error || 'Profile not found');
        }
      } catch {
        setError('Failed to load profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [status, username]);

  return (
    <ForumLayout title={`@${username}`} subtitle="Forum Member Profile">
      <ForumBreadcrumbs items={[{ label: `@${username}` }]} />

      {loading && (
        <div className="rv4-loading" style={{ minHeight: '200px' }}>
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <span>LOADING PROFILE</span>
        </div>
      )}

      {error && <div className="rv4-error-banner">{error}</div>}

      {!loading && !error && profile && (
        <>
          <ForumProfileCard profile={profile} />

          {isOwnProfile && (
            <div style={{ marginTop: '12px', marginBottom: '12px' }}>
              <button
                className="rv4-ctrl-btn"
                onClick={() => router.push('/router/forum/profile/edit')}
                style={{ fontSize: '10px' }}
              >
                ✎ EDIT PROFILE
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="rv4-forum-profile-tabs" style={{ marginTop: '16px' }}>
            <button
              className={activeTab === 'topics' ? 'active' : ''}
              onClick={() => setActiveTab('topics')}
            >
              Recent Topics ({recentTopics.length})
            </button>
            <button
              className={activeTab === 'posts' ? 'active' : ''}
              onClick={() => setActiveTab('posts')}
            >
              Recent Posts ({recentPosts.length})
            </button>
          </div>

          {/* Tab content */}
          <div className="rv4-forum-profile-content">
            {activeTab === 'topics' && (
              <>
                {recentTopics.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '30px',
                      color: 'var(--phosphor-dim)',
                      fontSize: '11px',
                    }}
                  >
                    No topics yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    {recentTopics.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                          borderBottom: '1px solid rgba(192,192,192,0.08)',
                        }}
                        onClick={() => router.push(`/router/forum/topic/${t.id}`)}
                        onMouseEnter={(e) =>
                          ((e.target as HTMLElement).style.background =
                            'rgba(0,255,65,0.06)')
                        }
                        onMouseLeave={(e) =>
                          ((e.target as HTMLElement).style.background = 'transparent')
                        }
                      >
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: 'var(--phosphor-green)',
                            marginBottom: '4px',
                          }}
                        >
                          {t.title}
                        </div>
                        <div
                          style={{
                            fontSize: '9px',
                            color: 'var(--phosphor-dim)',
                            display: 'flex',
                            gap: '8px',
                          }}
                        >
                          <span>in {t.category_name}</span>
                          <span>· {formatDate(t.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'posts' && (
              <>
                {recentPosts.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '30px',
                      color: 'var(--phosphor-dim)',
                      fontSize: '11px',
                    }}
                  >
                    No posts yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    {recentPosts.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                          borderBottom: '1px solid rgba(192,192,192,0.08)',
                        }}
                        onClick={() => router.push(`/router/forum/topic/${p.topic_id}`)}
                        onMouseEnter={(e) =>
                          ((e.target as HTMLElement).style.background =
                            'rgba(0,255,65,0.06)')
                        }
                        onMouseLeave={(e) =>
                          ((e.target as HTMLElement).style.background = 'transparent')
                        }
                      >
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--metal-silver)',
                            marginBottom: '4px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p.content.substring(0, 150)}
                          {p.content.length > 150 ? '…' : ''}
                        </div>
                        <div
                          style={{
                            fontSize: '9px',
                            color: 'var(--phosphor-dim)',
                            display: 'flex',
                            gap: '8px',
                          }}
                        >
                          <span>in {p.topic_title}</span>
                          <span>· {formatDate(p.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </ForumLayout>
  );
}
