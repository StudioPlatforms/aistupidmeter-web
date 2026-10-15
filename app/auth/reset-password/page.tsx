'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link');
      setValidating(false);
      return;
    }
    // Validate the token on mount
    fetch(`/api/auth/reset-password?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.valid) {
          setTokenValid(true);
          setEmail(data.email);
        } else {
          setError(data.error || 'Invalid or expired reset link');
        }
        setValidating(false);
      })
      .catch(() => {
        setError('Failed to validate reset link');
        setValidating(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to reset password');
        setLoading(false);
        return;
      }
      setSuccess(true);
      setLoading(false);
      // Back to sign in after 3 seconds
      setTimeout(() => router.push('/auth/signin'), 3000);
    } catch {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <AuthShell mode="account">
        <p className="au-busy" role="status">Checking your reset link…</p>
      </AuthShell>
    );
  }

  if (!tokenValid) {
    return (
      <AuthShell mode="account">
        <h1 className="au-title">This link is no longer valid</h1>
        <div className="au-note au-note-bad" role="alert">{error}</div>
        <p className="au-sub" style={{ marginTop: 14 }}>Reset links work once and expire after an hour.</p>
        <div className="au-stack" style={{ marginTop: 24 }}>
          <Link href="/auth/forgot-password" className="au-btn au-btn-primary au-btn-block">Request a new link</Link>
          <Link href="/auth/signin" className="au-btn au-btn-ghost au-btn-block">Back to sign in</Link>
        </div>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell mode="account">
        <h1 className="au-title">Password updated</h1>
        <div className="au-note au-note-good" role="status">Your new password is saved. Taking you to sign in…</div>
        <div className="au-stack" style={{ marginTop: 24 }}>
          <Link href="/auth/signin" className="au-btn au-btn-primary au-btn-block">Sign in now</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell mode="account">
      <h1 className="au-title">Choose a new password</h1>
      <p className="au-sub">For <b>{email}</b>.</p>
      {error && <div className="au-note au-note-bad" role="alert">{error}</div>}
      <form className="au-form" onSubmit={handleSubmit}>
        <div className="au-field">
          <label className="au-label" htmlFor="au-new">New password</label>
          <input id="au-new" className="au-input" type="password" autoComplete="new-password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required disabled={loading} minLength={8} />
        </div>
        <div className="au-field">
          <label className="au-label" htmlFor="au-confirm">Confirm password</label>
          <input id="au-confirm" className="au-input" type="password" autoComplete="new-password" value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)} placeholder="Type it again" required disabled={loading} minLength={8} />
          <span className="au-hint">At least 8 characters; a mix of letters, numbers and symbols is stronger.</span>
        </div>
        <button type="submit" className="au-btn au-btn-primary au-btn-block" disabled={loading}>{loading ? 'Saving…' : 'Save new password'}</button>
      </form>
      <p className="au-alt"><Link href="/auth/signin">Back to sign in</Link></p>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthShell mode="account"><p className="au-busy" role="status">Loading…</p></AuthShell>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
