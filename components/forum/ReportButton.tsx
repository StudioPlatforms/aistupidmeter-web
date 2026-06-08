'use client';

import { useState } from 'react';

interface ReportButtonProps {
  postId?: number;
  topicId?: number;
  onReport?: (reason: string, details: string) => void;
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate', label: 'Inappropriate Content' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'off-topic', label: 'Off-topic' },
  { value: 'other', label: 'Other' },
];

export default function ReportButton({ postId, topicId, onReport }: ReportButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/forum/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: postId || undefined,
          topic_id: topicId || undefined,
          reason,
          details: details.trim() || undefined,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        if (onReport) onReport(reason, details);
        setTimeout(() => {
          setShowModal(false);
          setSubmitted(false);
          setReason('spam');
          setDetails('');
        }, 1500);
      }
    } catch {
      // Silently handle error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowModal(true);
        }}
        className="danger"
        title="Report"
      >
        ⚑ Report
      </button>

      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: 'var(--terminal-dark, #0d0d0d)',
              border: '1px solid rgba(192,192,192,0.3)',
              borderRadius: '3px',
              padding: '20px',
              maxWidth: '420px',
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>✓</div>
                <div style={{ color: 'var(--phosphor-green)', fontSize: '12px', fontWeight: 'bold' }}>
                  REPORT SUBMITTED
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 'bold',
                    color: 'var(--phosphor-green)',
                    marginBottom: '16px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                  }}
                >
                  ⚑ Report Content
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      color: 'var(--phosphor-dim)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px',
                    }}
                  >
                    Reason
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
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
                    {REPORT_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      color: 'var(--phosphor-dim)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px',
                    }}
                  >
                    Details (optional)
                  </label>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Provide additional context…"
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

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowModal(false)}
                    className="btn-cancel"
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(192,192,192,0.25)',
                      color: 'var(--phosphor-dim)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{
                      background: 'var(--red-alert, #ff2d00)',
                      border: 'none',
                      color: '#fff',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      padding: '8px 20px',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      opacity: submitting ? 0.5 : 1,
                    }}
                  >
                    {submitting ? 'SUBMITTING…' : 'SUBMIT REPORT'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
