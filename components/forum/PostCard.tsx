'use client';

import { useState } from 'react';
import { formatDate, renderMarkdown, getInitials, getRoleBadgeClass } from './forum-utils';
import ReactionBar from './ReactionBar';
import PostEditor from './PostEditor';
import ReportButton from './ReportButton';

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
  edited_by_username?: string;
}

interface PostCardProps {
  post: Post;
  currentUserId?: string;
  onReact: (postId: number, reaction: string) => void;
  onEdit?: (postId: number, content: string) => void;
  onDelete?: (postId: number) => void;
  onMarkSolution?: (postId: number) => void;
  onReport?: (postId: number, reason: string, details: string) => void;
  canModerate?: boolean;
  isTopicAuthor?: boolean;
}

export default function PostCard({
  post,
  currentUserId,
  onReact,
  onEdit,
  onDelete,
  onMarkSolution,
  canModerate = false,
  isTopicAuthor = false,
}: PostCardProps) {
  const [editing, setEditing] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const isAuthor = currentUserId && post.author_id.toString() === currentUserId;
  const canEditPost = isAuthor || canModerate;
  const canDeletePost = isAuthor || canModerate;
  const canMarkAsSolution = isTopicAuthor && !post.is_solution;

  const handleEdit = async (content: string) => {
    if (!onEdit) return;
    setEditSubmitting(true);
    try {
      await onEdit(post.id, content);
      setEditing(false);
    } finally {
      setEditSubmitting(false);
    }
  };

  const roleBadgeClass = post.author_role ? getRoleBadgeClass(post.author_role) : '';

  return (
    <div className={`rv4-forum-post${post.is_solution ? ' solution' : ''}`}>
      {/* Post header */}
      <div className="rv4-forum-post-header">
        <div className="rv4-forum-post-avatar">
          {post.author_avatar ? (
            <img src={post.author_avatar} alt={post.author_username || 'User'} />
          ) : (
            getInitials(post.author_username || 'U')
          )}
        </div>

        <div className="rv4-forum-post-author-info">
          <span className="rv4-forum-post-author-name">
            {post.author_username || 'Unknown'}
            {roleBadgeClass && (
              <span className={roleBadgeClass}>
                {post.author_role?.toUpperCase()}
              </span>
            )}
          </span>
          <span className="rv4-forum-post-date">
            {formatDate(post.created_at)}
            {post.updated_at && post.updated_at !== post.created_at && (
              <> · edited {formatDate(post.updated_at)}</>
            )}
          </span>
        </div>
      </div>

      {/* Post content */}
      {editing ? (
        <div style={{ padding: '12px 14px' }}>
          <PostEditor
            initialContent={post.content}
            onSubmit={handleEdit}
            onCancel={() => setEditing(false)}
            submitLabel="SAVE EDIT"
            isSubmitting={editSubmitting}
          />
        </div>
      ) : (
        <div
          className="rv4-forum-post-content"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
        />
      )}

      {/* Post footer */}
      {!editing && (
        <div className="rv4-forum-post-footer">
          <ReactionBar
            reactions={post.reactions || {}}
            userReactions={post.user_reactions || []}
            onReact={(reaction) => onReact(post.id, reaction)}
            disabled={!currentUserId}
          />

          <div className="rv4-forum-post-actions">
            {canMarkAsSolution && onMarkSolution && (
              <button onClick={() => onMarkSolution(post.id)} title="Mark as solution">
                ✓ Solution
              </button>
            )}
            {canEditPost && onEdit && (
              <button onClick={() => setEditing(true)}>Edit</button>
            )}
            {canDeletePost && onDelete && (
              <button
                className="danger"
                onClick={() => {
                  if (window.confirm('Delete this post?')) {
                    onDelete(post.id);
                  }
                }}
              >
                Delete
              </button>
            )}
            {currentUserId && !isAuthor && (
              <ReportButton postId={post.id} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
