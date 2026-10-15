'use client';

import { useState } from 'react';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to send reset email');
        setLoading(false);
        return;
      }
      setSuccess(true);
      setLoading(false);
    } catch {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell mode="account">
        <h1 className="au-title">Check your email</h1>
        <p className="au-sub">If an account exists with <b>{email}</b>, a password reset link is on its way.</p>
        <ul className="au-list">
          <li>The link works once and expires after an hour.</li>
          <li>Check your spam folder if you don’t see it in a few minutes.</li>
          <li>You can request a new link if you need to.</li>
        </ul>
        <div className="au-stack" style={{ marginTop: 24 }}>
          <Link href="/auth/signin" className="au-btn au-btn-primary au-btn-block">Back to sign in</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell mode="account">
      <h1 className="au-title">Reset your password</h1>
      <p className="au-sub">Enter your email address and we’ll send you a link to choose a new password.</p>
      {error && <div className="au-note au-note-bad" role="alert">{error}</div>}
      <form className="au-form" onSubmit={handleSubmit}>
        <div className="au-field">
          <label className="au-label" htmlFor="au-email">Email address</label>
          <input id="au-email" className="au-input" type="email" autoComplete="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required disabled={loading} />
        </div>
        <button type="submit" className="au-btn au-btn-primary au-btn-block" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button>
      </form>
      <p className="au-alt">Remembered it? <Link href="/auth/signin">Back to sign in</Link></p>
    </AuthShell>
  );
}
