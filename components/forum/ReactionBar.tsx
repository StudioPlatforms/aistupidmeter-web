'use client';

interface ReactionBarProps {
  reactions: Record<string, number>;
  userReactions: string[];
  onReact: (reaction: string) => void;
  disabled?: boolean;
}

const REACTION_CONFIG = [
  { key: 'like', emoji: '👍', label: 'Like' },
  { key: 'helpful', emoji: '💡', label: 'Helpful' },
  { key: 'insightful', emoji: '🔥', label: 'Insightful' },
];

export default function ReactionBar({ reactions, userReactions, onReact, disabled }: ReactionBarProps) {
  return (
    <div className="rv4-forum-reactions">
      {REACTION_CONFIG.map(({ key, emoji, label }) => {
        const count = reactions[key] || 0;
        const isActive = userReactions.includes(key);

        return (
          <button
            key={key}
            className={`rv4-forum-reaction-btn${isActive ? ' active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) onReact(key);
            }}
            disabled={disabled}
            title={label}
          >
            <span className="emoji">{emoji}</span>
            {count > 0 && (
              <span className="rv4-forum-reaction-count">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
