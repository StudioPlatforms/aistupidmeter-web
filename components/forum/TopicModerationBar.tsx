'use client';

interface Topic {
  id: number;
  is_pinned?: number;
  is_locked?: number;
}

interface TopicModerationBarProps {
  topic: Topic;
  onPin: () => void;
  onLock: () => void;
  onDelete: () => void;
}

export default function TopicModerationBar({ topic, onPin, onLock, onDelete }: TopicModerationBarProps) {
  return (
    <div className="rv4-forum-mod-bar">
      <button
        className={`rv4-forum-mod-btn${topic.is_pinned ? ' active' : ''}`}
        onClick={onPin}
      >
        📌 {topic.is_pinned ? 'Unpin' : 'Pin'}
      </button>

      <button
        className={`rv4-forum-mod-btn${topic.is_locked ? ' active' : ''}`}
        onClick={onLock}
      >
        🔒 {topic.is_locked ? 'Unlock' : 'Lock'}
      </button>

      <button
        className="rv4-forum-mod-btn danger"
        onClick={() => {
          if (window.confirm('Are you sure you want to delete this topic? This cannot be undone.')) {
            onDelete();
          }
        }}
      >
        🗑 Delete
      </button>
    </div>
  );
}
