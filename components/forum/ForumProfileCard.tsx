'use client';

import { formatDate, getInitials, getRoleBadgeClass } from './forum-utils';

interface Profile {
  username?: string;
  forum_username?: string;
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

interface ForumProfileCardProps {
  profile: Profile;
}

export default function ForumProfileCard({ profile }: ForumProfileCardProps) {
  const displayName = profile.forum_username || profile.username || 'Unknown';
  const roleBadgeClass = profile.role ? getRoleBadgeClass(profile.role) : '';

  return (
    <div className="rv4-forum-profile">
      {/* Header */}
      <div className="rv4-forum-profile-header">
        <div className="rv4-forum-profile-avatar">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={displayName} />
          ) : (
            getInitials(displayName)
          )}
        </div>

        <div className="rv4-forum-profile-info">
          <div className="profile-name">
            {displayName}
            {roleBadgeClass && (
              <>
                {' '}
                <span className={roleBadgeClass}>
                  {profile.role?.toUpperCase()}
                </span>
              </>
            )}
          </div>

          {profile.title && (
            <div className="profile-title">{profile.title}</div>
          )}

          {profile.bio && (
            <div className="profile-bio">{profile.bio}</div>
          )}

          {(profile.location || profile.website) && (
            <div
              style={{
                display: 'flex',
                gap: '12px',
                marginTop: '6px',
                fontSize: '10px',
                color: 'var(--phosphor-dim)',
              }}
            >
              {profile.location && <span>📍 {profile.location}</span>}
              {profile.website && (
                <a
                  href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--phosphor-green)', textDecoration: 'underline' }}
                >
                  🔗 {profile.website}
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="rv4-forum-profile-stats-bar">
        <div className="rv4-forum-profile-stat">
          <div className="stat-value">{profile.topic_count ?? 0}</div>
          <div className="stat-label">Topics</div>
        </div>
        <div className="rv4-forum-profile-stat">
          <div className="stat-value">{profile.post_count ?? 0}</div>
          <div className="stat-label">Posts</div>
        </div>
        <div className="rv4-forum-profile-stat">
          <div className="stat-value">{profile.reputation ?? 0}</div>
          <div className="stat-label">Reputation</div>
        </div>
        <div className="rv4-forum-profile-stat">
          <div className="stat-value" style={{ fontSize: '11px' }}>
            {profile.created_at ? formatDate(profile.created_at) : 'N/A'}
          </div>
          <div className="stat-label">Member Since</div>
        </div>
      </div>
    </div>
  );
}
