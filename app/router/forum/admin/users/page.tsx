'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import ForumLayout from '@/components/forum/ForumLayout';
import ForumAdminSidebar from '@/components/forum/ForumAdminSidebar';
import ForumPagination from '@/components/forum/ForumPagination';
import { formatDate, getInitials, getRoleBadgeClass } from '@/components/forum/forum-utils';

interface ForumUser {
  id: number;
  name?: string;
  email?: string;
  forum_username?: string;
  role: string;
  post_count?: number;
  created_at?: string;
  is_banned?: boolean;
  ban_reason?: string;
  ban_until?: string;
}

export default function ForumAdminUsers() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<ForumUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Modals
  const [roleModal, setRoleModal] = useState<ForumUser | null>(null);
  const [newRole, setNewRole] = useState('user');
  const [roleSubmitting, setRoleSubmitting] = useState(false);

  const [banModal, setBanModal] = useState<ForumUser | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState('permanent');
  const [banCustomDate, setBanCustomDate] = useState('');
  const [banSubmitting, setBanSubmitting] = useState(false);

  const [unbanConfirm, setUnbanConfirm] = useState<ForumUser | null>(null);
  const [unbanSubmitting, setUnbanSubmitting] = useState(false);

  // Actions dropdown
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  const role = (session?.user as any)?.role || 'user';
  const isAdmin = role === 'admin' || role === 'superadmin';
  const isSuperadmin = role === 'superadmin';

  const fetchUsers = useCallback(async (pageNum: number, searchQuery: string, roleQuery: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: '20',
      });
      if (searchQuery) params.set('search', searchQuery);
      if (roleQuery) params.set('role', roleQuery);

      const res = await fetch(`/api/forum/admin/users?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setUsers(data.users || []);
        setTotalPages(data.totalPages || 1);
      } else {
        setError(data.error || 'Failed to load users');
      }
    } catch {
      setError('Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (!isAdmin) return;
    fetchUsers(page, search, roleFilter);
  }, [status, isAdmin, page, search, roleFilter, fetchUsers]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = () => setOpenDropdown(null);
    if (openDropdown !== null) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [openDropdown]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleRoleFilterChange = (newFilter: string) => {
    setPage(1);
    setRoleFilter(newFilter);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Role change
  const openRoleModal = (user: ForumUser) => {
    setRoleModal(user);
    setNewRole(user.role);
    setOpenDropdown(null);
  };

  const handleRoleChange = async () => {
    if (!roleModal) return;
    setRoleSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/forum/admin/users/${roleModal.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();

      if (data.success || res.ok) {
        setRoleModal(null);
        await fetchUsers(page, search, roleFilter);
      } else {
        setError(data.error || 'Failed to change role');
      }
    } catch {
      setError('Failed to change role.');
    } finally {
      setRoleSubmitting(false);
    }
  };

  // Ban user
  const openBanModal = (user: ForumUser) => {
    setBanModal(user);
    setBanReason('');
    setBanDuration('permanent');
    setBanCustomDate('');
    setOpenDropdown(null);
  };

  const handleBan = async () => {
    if (!banModal || !banReason.trim()) return;
    setBanSubmitting(true);
    setError('');

    try {
      let until: string | undefined;
      if (banDuration === '1d') {
        const d = new Date(); d.setDate(d.getDate() + 1);
        until = d.toISOString();
      } else if (banDuration === '7d') {
        const d = new Date(); d.setDate(d.getDate() + 7);
        until = d.toISOString();
      } else if (banDuration === '30d') {
        const d = new Date(); d.setDate(d.getDate() + 30);
        until = d.toISOString();
      } else if (banDuration === 'custom' && banCustomDate) {
        until = new Date(banCustomDate).toISOString();
      }
      // 'permanent' => no until

      const res = await fetch(`/api/forum/admin/users/${banModal.id}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: banReason.trim(), until }),
      });
      const data = await res.json();

      if (data.success || res.ok) {
        setBanModal(null);
        await fetchUsers(page, search, roleFilter);
      } else {
        setError(data.error || 'Failed to ban user');
      }
    } catch {
      setError('Failed to ban user.');
    } finally {
      setBanSubmitting(false);
    }
  };

  // Unban user
  const openUnbanConfirm = (user: ForumUser) => {
    setUnbanConfirm(user);
    setOpenDropdown(null);
  };

  const handleUnban = async () => {
    if (!unbanConfirm) return;
    setUnbanSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/forum/admin/users/${unbanConfirm.id}/ban`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success || res.ok) {
        setUnbanConfirm(null);
        await fetchUsers(page, search, roleFilter);
      } else {
        setError(data.error || 'Failed to unban user');
      }
    } catch {
      setError('Failed to unban user.');
    } finally {
      setUnbanSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <ForumLayout title="FORUM ADMIN" subtitle="User Management">
        <div className="rv4-loading" style={{ minHeight: '300px' }}>
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <span>LOADING</span>
        </div>
      </ForumLayout>
    );
  }

  if (!isAdmin) {
    return (
      <ForumLayout>
        <div className="rv4-page-header">
          <div className="rv4-page-header-left">
            <div className="rv4-page-title">ACCESS DENIED</div>
          </div>
        </div>
        <div className="rv4-body">
          <div className="rv4-error-banner">
            🔒 You don&apos;t have permission to access this page. Required role: admin or higher.
          </div>
        </div>
      </ForumLayout>
    );
  }

  return (
    <ForumLayout title="FORUM ADMIN" subtitle="User Management">
      <ForumAdminSidebar currentPath={pathname} />

      {error && <div className="rv4-error-banner" style={{ marginBottom: '14px' }}>{error}</div>}

      {/* Search & Filter Bar */}
      <div className="rv4-panel" style={{ marginBottom: '14px' }}>
        <div className="rv4-panel-body" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search by username, email, or name…"
            style={{
              flex: '1 1 250px',
              padding: '8px 10px',
              background: 'var(--terminal-black, #0a0a0a)',
              border: '1px solid rgba(192,192,192,0.3)',
              borderRadius: '2px',
              color: 'var(--phosphor-green)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              minWidth: '200px',
            }}
          />
          <button className="rv4-ctrl-btn primary" onClick={handleSearch} style={{ padding: '8px 16px' }}>
            🔍 Search
          </button>
          <select
            value={roleFilter}
            onChange={(e) => handleRoleFilterChange(e.target.value)}
            style={{
              padding: '8px 10px',
              background: 'var(--terminal-black, #0a0a0a)',
              border: '1px solid rgba(192,192,192,0.3)',
              borderRadius: '2px',
              color: 'var(--phosphor-green)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
            }}
          >
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
            <option value="banned">Banned</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="rv4-loading" style={{ minHeight: '200px' }}>
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <span>LOADING USERS</span>
        </div>
      )}

      {/* Desktop Table */}
      {!loading && users.length > 0 && (
        <>
          <div className="rv4-table-wrapper" style={{ marginBottom: '14px' }}>
            <table className="rv4-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Posts</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const displayName = user.forum_username || user.name || 'Unknown';
                  const isBanned = user.is_banned || user.role === 'banned';

                  return (
                    <tr key={user.id}>
                      {/* Avatar */}
                      <td style={{ width: '40px', textAlign: 'center' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: isBanned ? 'rgba(255,45,0,0.15)' : 'rgba(0,255,65,0.1)',
                            border: `1px solid ${isBanned ? 'rgba(255,45,0,0.4)' : 'rgba(0,255,65,0.3)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color: isBanned ? 'var(--red-alert)' : 'var(--phosphor-green)',
                          }}
                        >
                          {getInitials(displayName)}
                        </div>
                      </td>

                      {/* Username */}
                      <td>
                        {user.forum_username ? (
                          <span className="td-green">{user.forum_username}</span>
                        ) : (
                          <span className="td-dim" style={{ fontStyle: 'italic' }}>No username</span>
                        )}
                        {user.name && user.forum_username && user.name !== user.forum_username && (
                          <div className="td-dim" style={{ fontSize: '10px' }}>{user.name}</div>
                        )}
                      </td>

                      {/* Email */}
                      <td className="td-dim td-mono" style={{ fontSize: '11px' }}>
                        {user.email || '—'}
                      </td>

                      {/* Role */}
                      <td>
                        {getRoleBadgeClass(user.role) ? (
                          <span
                            className={getRoleBadgeClass(user.role)}
                            style={{ fontSize: '9px', padding: '2px 6px', display: 'inline-block' }}
                          >
                            {user.role.toUpperCase()}
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>{user.role}</span>
                        )}
                      </td>

                      {/* Posts */}
                      <td>{user.post_count || 0}</td>

                      {/* Joined */}
                      <td className="td-dim" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {formatDate(user.created_at)}
                      </td>

                      {/* Status */}
                      <td>
                        {isBanned ? (
                          <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--red-alert)' }}>
                            🚫 BANNED
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)' }}>
                            ● Active
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td>
                        <div style={{ position: 'relative' }}>
                          <button
                            className="rv4-ctrl-btn"
                            style={{ padding: '4px 10px', fontSize: '10px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdown(openDropdown === user.id ? null : user.id);
                            }}
                          >
                            ⋯ Actions
                          </button>

                          {openDropdown === user.id && (
                            <div
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                marginTop: '4px',
                                background: 'var(--terminal-dark, #0d0d0d)',
                                border: '1px solid rgba(192,192,192,0.3)',
                                borderRadius: '3px',
                                minWidth: '160px',
                                zIndex: 100,
                                boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => openRoleModal(user)}
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  padding: '8px 12px',
                                  background: 'none',
                                  border: 'none',
                                  borderBottom: '1px solid rgba(192,192,192,0.1)',
                                  color: 'var(--phosphor-green)',
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '11px',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,255,65,0.05)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                              >
                                🔧 Change Role
                              </button>

                              {!isBanned ? (
                                <button
                                  onClick={() => openBanModal(user)}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: '1px solid rgba(192,192,192,0.1)',
                                    color: 'var(--red-alert)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '11px',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,45,0,0.05)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                                >
                                  🚫 Ban User
                                </button>
                              ) : (
                                <button
                                  onClick={() => openUnbanConfirm(user)}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: '1px solid rgba(192,192,192,0.1)',
                                    color: 'var(--phosphor-green)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '11px',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,255,65,0.05)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                                >
                                  ✅ Unban User
                                </button>
                              )}

                              {user.forum_username && (
                                <button
                                  onClick={() => {
                                    setOpenDropdown(null);
                                    router.push(`/router/forum/profile/${user.forum_username}`);
                                  }}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--phosphor-dim)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '11px',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,255,65,0.05)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                                >
                                  👤 View Profile
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ForumPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}

      {!loading && users.length === 0 && (
        <div className="rv4-forum-empty">
          <div className="empty-icon">👥</div>
          <div className="empty-title">No Users Found</div>
          <div className="empty-text">
            {search || roleFilter
              ? 'No users match your search criteria. Try adjusting filters.'
              : 'No forum users registered yet.'}
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {roleModal && (
        <div className="rv4-modal-backdrop" onClick={() => setRoleModal(null)}>
          <div className="rv4-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="rv4-modal-header">
              <div className="rv4-modal-title">🔧 Change User Role</div>
              <button className="rv4-modal-close" onClick={() => setRoleModal(null)}>
                ✕ CLOSE
              </button>
            </div>
            <div className="rv4-modal-body">
              <div style={{ marginBottom: '12px', padding: '8px', background: 'rgba(0,255,65,0.04)', border: '1px solid rgba(0,255,65,0.15)', borderRadius: '2px' }}>
                <span style={{ fontSize: '11px', color: 'var(--phosphor-dim)' }}>User: </span>
                <strong style={{ color: 'var(--phosphor-green)' }}>
                  {roleModal.forum_username || roleModal.name || roleModal.email || `User #${roleModal.id}`}
                </strong>
                <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--phosphor-dim)' }}>
                  (current: {roleModal.role})
                </span>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  New Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'var(--terminal-black, #0a0a0a)',
                    border: '1px solid rgba(192,192,192,0.3)',
                    borderRadius: '2px',
                    color: 'var(--phosphor-green)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                  }}
                >
                  <option value="user">User</option>
                  <option value="moderator">Moderator</option>
                  {isSuperadmin && <option value="admin">Admin</option>}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  className="rv4-ctrl-btn"
                  onClick={() => setRoleModal(null)}
                  disabled={roleSubmitting}
                >
                  CANCEL
                </button>
                <button
                  className="rv4-ctrl-btn primary"
                  onClick={handleRoleChange}
                  disabled={roleSubmitting || newRole === roleModal.role}
                  style={{ opacity: roleSubmitting || newRole === roleModal.role ? 0.5 : 1 }}
                >
                  {roleSubmitting ? 'UPDATING…' : 'UPDATE ROLE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ban Modal */}
      {banModal && (
        <div className="rv4-modal-backdrop" onClick={() => setBanModal(null)}>
          <div className="rv4-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="rv4-modal-header">
              <div className="rv4-modal-title" style={{ color: 'var(--red-alert)' }}>
                🚫 Ban User
              </div>
              <button className="rv4-modal-close" onClick={() => setBanModal(null)}>
                ✕ CLOSE
              </button>
            </div>
            <div className="rv4-modal-body">
              <div style={{ marginBottom: '12px', padding: '8px', background: 'rgba(255,45,0,0.08)', border: '1px solid rgba(255,45,0,0.2)', borderRadius: '2px' }}>
                <span style={{ fontSize: '11px', color: 'var(--phosphor-dim)' }}>Banning: </span>
                <strong style={{ color: 'var(--red-alert)' }}>
                  {banModal.forum_username || banModal.name || banModal.email || `User #${banModal.id}`}
                </strong>
              </div>

              {/* Reason */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Reason *
                </label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Reason for banning this user…"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'var(--terminal-black, #0a0a0a)',
                    border: '1px solid rgba(192,192,192,0.3)',
                    borderRadius: '2px',
                    color: 'var(--phosphor-green)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Duration */}
              <div style={{ marginBottom: banDuration === 'custom' ? '8px' : '20px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Duration
                </label>
                <select
                  value={banDuration}
                  onChange={(e) => setBanDuration(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'var(--terminal-black, #0a0a0a)',
                    border: '1px solid rgba(192,192,192,0.3)',
                    borderRadius: '2px',
                    color: 'var(--phosphor-green)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                  }}
                >
                  <option value="permanent">Permanent</option>
                  <option value="1d">1 Day</option>
                  <option value="7d">7 Days</option>
                  <option value="30d">30 Days</option>
                  <option value="custom">Custom Date</option>
                </select>
              </div>

              {banDuration === 'custom' && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                    Ban Until
                  </label>
                  <input
                    type="datetime-local"
                    value={banCustomDate}
                    onChange={(e) => setBanCustomDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'var(--terminal-black, #0a0a0a)',
                      border: '1px solid rgba(192,192,192,0.3)',
                      borderRadius: '2px',
                      color: 'var(--phosphor-green)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  className="rv4-ctrl-btn"
                  onClick={() => setBanModal(null)}
                  disabled={banSubmitting}
                >
                  CANCEL
                </button>
                <button
                  className="rv4-ctrl-btn danger"
                  onClick={handleBan}
                  disabled={banSubmitting || !banReason.trim()}
                  style={{ opacity: banSubmitting || !banReason.trim() ? 0.5 : 1 }}
                >
                  {banSubmitting ? 'BANNING…' : 'BAN USER'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unban Confirmation Modal */}
      {unbanConfirm && (
        <div className="rv4-modal-backdrop" onClick={() => setUnbanConfirm(null)}>
          <div className="rv4-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="rv4-modal-header">
              <div className="rv4-modal-title">✅ Unban User</div>
              <button className="rv4-modal-close" onClick={() => setUnbanConfirm(null)}>
                ✕ CLOSE
              </button>
            </div>
            <div className="rv4-modal-body">
              <p style={{ color: 'var(--phosphor-dim)', fontSize: '12px', marginBottom: '8px' }}>
                Are you sure you want to unban{' '}
                <strong style={{ color: 'var(--phosphor-green)' }}>
                  {unbanConfirm.forum_username || unbanConfirm.name || `User #${unbanConfirm.id}`}
                </strong>?
              </p>
              {unbanConfirm.ban_reason && (
                <div style={{ marginBottom: '12px', padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(192,192,192,0.1)', borderRadius: '2px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)', textTransform: 'uppercase' }}>Original ban reason:</span>
                  <div style={{ fontSize: '11px', color: 'var(--amber-warning)', marginTop: '4px' }}>{unbanConfirm.ban_reason}</div>
                </div>
              )}
              <p style={{ color: 'var(--phosphor-dim)', fontSize: '11px', marginBottom: '20px' }}>
                This user will regain access to the forum.
              </p>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  className="rv4-ctrl-btn"
                  onClick={() => setUnbanConfirm(null)}
                  disabled={unbanSubmitting}
                >
                  CANCEL
                </button>
                <button
                  className="rv4-ctrl-btn primary"
                  onClick={handleUnban}
                  disabled={unbanSubmitting}
                  style={{ opacity: unbanSubmitting ? 0.5 : 1 }}
                >
                  {unbanSubmitting ? 'UNBANNING…' : 'UNBAN USER'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ForumLayout>
  );
}
