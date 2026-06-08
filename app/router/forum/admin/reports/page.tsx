'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import ForumLayout from '@/components/forum/ForumLayout';
import ForumAdminSidebar from '@/components/forum/ForumAdminSidebar';
import ForumPagination from '@/components/forum/ForumPagination';
import { isAdmin as isAdminRole, formatDate } from '@/components/forum/forum-utils';

interface Report {
  id: number;
  reporter_username?: string;
  reporter_name?: string;
  reported_username?: string;
  reported_user_id?: number;
  post_id?: number;
  topic_id?: number;
  topic_title?: string;
  post_content?: string;
  reason: string;
  details?: string;
  status: string;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

export default function ForumAdminReports() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [banModal, setBanModal] = useState<Report | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState('permanent');
  const [banSubmitting, setBanSubmitting] = useState(false);

  const role = (session?.user as any)?.role || 'user';

  const fetchReports = useCallback(async (pageNum: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/forum/admin/reports?page=${pageNum}&limit=20`);
      const data = await res.json();

      if (data.success) {
        setReports(data.reports || []);
        setTotalPages(data.totalPages || 1);
      } else {
        setError(data.error || 'Failed to load reports');
      }
    } catch {
      setError('Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (!isAdminRole(role)) return;
    fetchReports(page);
  }, [status, role, page, fetchReports]);

  const handleAction = async (reportId: number, action: string) => {
    setActionLoading(reportId);
    setError('');

    try {
      const res = await fetch(`/api/forum/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (data.success || res.ok) {
        await fetchReports(page);
      } else {
        setError(data.error || 'Failed to process report');
      }
    } catch {
      setError('Failed to process report.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBanFromReport = async () => {
    if (!banModal || !banReason.trim()) return;
    setBanSubmitting(true);
    setError('');

    try {
      // First ban the user
      if (banModal.reported_user_id) {
        let until: string | undefined;
        if (banDuration !== 'permanent') {
          const now = new Date();
          const days = banDuration === '1d' ? 1 : banDuration === '7d' ? 7 : banDuration === '30d' ? 30 : 0;
          if (days > 0) {
            now.setDate(now.getDate() + days);
            until = now.toISOString();
          }
        }

        const banRes = await fetch(`/api/forum/admin/users/${banModal.reported_user_id}/ban`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: banReason.trim(), until }),
        });

        if (!banRes.ok) {
          const banData = await banRes.json();
          setError(banData.error || 'Failed to ban user');
          setBanSubmitting(false);
          return;
        }
      }

      // Then action the report
      await handleAction(banModal.id, 'banned');
      setBanModal(null);
      setBanReason('');
      setBanDuration('permanent');
    } catch {
      setError('Failed to ban user.');
    } finally {
      setBanSubmitting(false);
    }
  };

  const getStatusBadge = (reportStatus: string) => {
    switch (reportStatus) {
      case 'pending':
        return { text: 'PENDING', color: 'var(--amber-warning)', bg: 'rgba(255,176,0,0.1)', border: 'rgba(255,176,0,0.4)' };
      case 'dismissed':
        return { text: 'DISMISSED', color: 'var(--phosphor-dim)', bg: 'rgba(128,128,128,0.08)', border: 'rgba(128,128,128,0.3)' };
      case 'actioned':
        return { text: 'ACTIONED', color: 'var(--phosphor-green)', bg: 'rgba(0,255,65,0.1)', border: 'rgba(0,255,65,0.4)' };
      default:
        return { text: reportStatus.toUpperCase(), color: 'var(--phosphor-dim)', bg: 'transparent', border: 'rgba(128,128,128,0.3)' };
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  if (status === 'loading') {
    return (
      <ForumLayout title="FORUM ADMIN" subtitle="Report Queue">
        <div className="rv4-loading" style={{ minHeight: '300px' }}>
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <span>LOADING</span>
        </div>
      </ForumLayout>
    );
  }

  if (!isAdminRole(role)) {
    return (
      <ForumLayout>
        <div className="rv4-page-header">
          <div className="rv4-page-header-left">
            <div className="rv4-page-title">ACCESS DENIED</div>
          </div>
        </div>
        <div className="rv4-body">
          <div className="rv4-error-banner">
            🔒 You don&apos;t have permission to access this page. Admin access required.
          </div>
        </div>
      </ForumLayout>
    );
  }

  return (
    <ForumLayout title="FORUM ADMIN" subtitle="Report Queue">
      <ForumAdminSidebar currentPath={pathname} />

      {error && <div className="rv4-error-banner" style={{ marginBottom: '14px' }}>{error}</div>}

      {loading && (
        <div className="rv4-loading" style={{ minHeight: '200px' }}>
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <span>LOADING REPORTS</span>
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div className="rv4-forum-empty">
          <div className="empty-icon">✅</div>
          <div className="empty-title">No Pending Reports</div>
          <div className="empty-text">The report queue is clear. Nice work!</div>
        </div>
      )}

      {!loading && reports.length > 0 && (
        <>
          <div style={{ fontSize: '11px', color: 'var(--phosphor-dim)', marginBottom: '12px' }}>
            Showing {reports.length} report{reports.length !== 1 ? 's' : ''}
          </div>

          {reports.map((report) => {
            const badge = getStatusBadge(report.status);
            const isProcessing = actionLoading === report.id;
            const isPending = report.status === 'pending';

            return (
              <div
                key={report.id}
                className="rv4-panel"
                style={{ marginBottom: '10px', opacity: isProcessing ? 0.5 : 1 }}
              >
                <div className="rv4-panel-header" style={{ flexWrap: 'wrap', gap: '8px' }}>
                  <span className="rv4-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ⚑ Report #{report.id}
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 'bold',
                        padding: '2px 8px',
                        border: `1px solid ${badge.border}`,
                        color: badge.color,
                        background: badge.bg,
                        borderRadius: '2px',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {badge.text}
                    </span>
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>
                    {formatDate(report.created_at)}
                  </span>
                </div>
                <div className="rv4-panel-body">
                  {/* Reporter Info */}
                  <div style={{ marginBottom: '10px', display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '11px' }}>
                    <div>
                      <span style={{ color: 'var(--phosphor-dim)' }}>Reporter: </span>
                      <span style={{ color: 'var(--phosphor-green)', fontWeight: 'bold' }}>
                        {report.reporter_username || report.reporter_name || 'Unknown'}
                      </span>
                    </div>
                    {report.reported_username && (
                      <div>
                        <span style={{ color: 'var(--phosphor-dim)' }}>Reported User: </span>
                        <span style={{ color: 'var(--amber-warning)', fontWeight: 'bold' }}>
                          {report.reported_username}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Reason */}
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Reason:
                    </span>
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--phosphor-green)' }}>
                      {report.reason}
                    </span>
                  </div>

                  {/* Details */}
                  {report.details && (
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Details:
                      </span>
                      <div style={{ marginTop: '4px', padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(192,192,192,0.1)', borderRadius: '2px', fontSize: '11px', color: 'var(--phosphor-dim)' }}>
                        {report.details}
                      </div>
                    </div>
                  )}

                  {/* Reported Content */}
                  {(report.topic_title || report.post_content) && (
                    <div style={{ marginBottom: '10px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Reported Content:
                      </span>
                      <div style={{ marginTop: '4px', padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,176,0,0.15)', borderRadius: '2px', fontSize: '11px', color: 'var(--phosphor-dim)' }}>
                        {report.topic_title && (
                          <div style={{ color: 'var(--phosphor-green)', fontWeight: 'bold', marginBottom: report.post_content ? '4px' : 0 }}>
                            📌 {report.topic_title}
                          </div>
                        )}
                        {report.post_content && (
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxHeight: '60px' }}>
                            {report.post_content.substring(0, 300)}
                            {report.post_content.length > 300 ? '…' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {isPending && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(192,192,192,0.1)' }}>
                      <button
                        className="rv4-ctrl-btn"
                        onClick={() => handleAction(report.id, 'dismissed')}
                        disabled={isProcessing}
                        style={{ padding: '5px 12px', fontSize: '10px' }}
                      >
                        ✗ Dismiss
                      </button>
                      <button
                        className="rv4-ctrl-btn danger"
                        onClick={() => handleAction(report.id, 'deleted')}
                        disabled={isProcessing}
                        style={{ padding: '5px 12px', fontSize: '10px' }}
                      >
                        🗑 Delete Content
                      </button>
                      <button
                        className="rv4-ctrl-btn"
                        onClick={() => handleAction(report.id, 'warned')}
                        disabled={isProcessing}
                        style={{ padding: '5px 12px', fontSize: '10px', borderColor: 'var(--amber-warning)', color: 'var(--amber-warning)' }}
                      >
                        ⚠️ Warn User
                      </button>
                      <button
                        className="rv4-ctrl-btn danger"
                        onClick={() => {
                          setBanModal(report);
                          setBanReason(`Banned for report #${report.id}: ${report.reason}`);
                        }}
                        disabled={isProcessing}
                        style={{ padding: '5px 12px', fontSize: '10px' }}
                      >
                        🚫 Ban User
                      </button>
                    </div>
                  )}

                  {/* Reviewed info */}
                  {report.reviewed_at && (
                    <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--phosphor-dim)' }}>
                      Reviewed {formatDate(report.reviewed_at)}
                      {report.reviewed_by && ` by ${report.reviewed_by}`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <ForumPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
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
              {banModal.reported_username && (
                <div style={{ marginBottom: '12px', padding: '8px', background: 'rgba(255,45,0,0.08)', border: '1px solid rgba(255,45,0,0.2)', borderRadius: '2px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--phosphor-dim)' }}>Banning user: </span>
                  <strong style={{ color: 'var(--red-alert)' }}>{banModal.reported_username}</strong>
                </div>
              )}

              {/* Reason */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Reason *
                </label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
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
              <div style={{ marginBottom: '20px' }}>
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
                </select>
              </div>

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
                  onClick={handleBanFromReport}
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
    </ForumLayout>
  );
}
