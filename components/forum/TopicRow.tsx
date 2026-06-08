'use client';

import { useRouter } from 'next/navigation';
import { formatDate } from './forum-utils';

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

interface TopicRowProps {
  topic: Topic;
}

export default function TopicRow({ topic }: TopicRowProps) {
  const router = useRouter();

  const classes = [
    'rv4-forum-topic-row',
    topic.is_pinned ? 'pinned' : '',
    topic.is_locked ? 'locked' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      onClick={() => router.push(`/router/forum/topic/${topic.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          router.push(`/router/forum/topic/${topic.id}`);
        }
      }}
    >
      {topic.is_pinned ? (
        <span className="rv4-forum-pin-badge">📌 Pinned</span>
      ) : null}
      {topic.is_locked ? (
        <span className="rv4-forum-category-locked" style={{ fontSize: '9px', marginRight: '4px' }}>🔒</span>
      ) : null}

      <span className="rv4-forum-topic-title">{topic.title}</span>

      <div className="rv4-forum-topic-meta">
        {topic.author_username && (
          <span className="rv4-forum-topic-author">{topic.author_username}</span>
        )}
        {topic.created_at && (
          <span style={{ fontSize: '9px', color: 'var(--phosphor-dim)' }}>
            {formatDate(topic.created_at)}
          </span>
        )}
      </div>

      <div className="rv4-forum-topic-stats">
        <span className="rv4-forum-topic-stat">
          <span className="stat-icon">💬</span>
          <span className="stat-value">{topic.reply_count ?? 0}</span>
        </span>
        <span className="rv4-forum-topic-stat views">
          <span className="stat-icon">👁</span>
          <span className="stat-value">{topic.view_count ?? 0}</span>
        </span>
      </div>

      {topic.last_reply_at && (
        <div className="rv4-forum-topic-last-reply">
          {topic.last_reply_by_username && (
            <div className="last-reply-author">{topic.last_reply_by_username}</div>
          )}
          <div className="last-reply-date">{formatDate(topic.last_reply_at)}</div>
        </div>
      )}
    </div>
  );
}
