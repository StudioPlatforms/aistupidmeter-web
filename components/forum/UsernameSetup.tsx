'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UsernameSetupProps {
  onComplete: (username: string) => void;
}

export default function UsernameSetup({ onComplete }: UsernameSetupProps) {
  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

  const checkAvailability = useCallback(async (name: string) => {
    if (name.length < 3) {
      setAvailable(null);
      return;
    }
    setChecking(true);
    try {
      const res = await fetch(`/api/forum/username/check?username=${encodeURIComponent(name)}`);
      const data = await res.json();
      setAvailable(data.available === true);
    } catch {
      setAvailable(null);
    } finally {
      setChecking(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setUsername(value);
    setError('');
    setAvailable(null);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Validate locally first
    if (value.length > 0 && value.length < 3) {
      setError('Must be at least 3 characters');
      return;
    }
    if (value.length > 20) {
      setError('Must be 20 characters or less');
      return;
    }
    if (value && !USERNAME_REGEX.test(value)) {
      setError('Only letters, numbers, underscores, and hyphens');
      return;
    }

    if (value.length >= 3) {
      debounceRef.current = setTimeout(() => {
        checkAvailability(value);
      }, 500);
    }
  };

  const handleSubmit = async () => {
    if (!username || username.length < 3 || !available || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/forum/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        onComplete(username);
      } else {
        setError(data.error || 'Failed to set username');
        setAvailable(false);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="rv4-forum-username-setup">
      <div className="rv4-forum-username-card">
        <h2>Choose Your Username</h2>
        <p>
          Pick a unique username for the forum. This is how other members will see you.
          Choose wisely — it cannot be changed later.
        </p>

        <div className="rv4-forum-username-input-wrap">
          <input
            type="text"
            value={username}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Enter username…"
            maxLength={20}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
          />
          {checking && (
            <span
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '11px',
                color: 'var(--phosphor-dim)',
              }}
            >
              …
            </span>
          )}
          {!checking && available === true && (
            <span className="rv4-forum-username-available">✓</span>
          )}
          {!checking && available === false && (
            <span className="rv4-forum-username-taken">✗</span>
          )}
        </div>

        {error && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--red-alert, #ff2d00)',
              marginBottom: '8px',
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!username || username.length < 3 || !available || submitting}
          style={{
            width: '100%',
            padding: '12px',
            background: available ? 'var(--phosphor-green, #00ff41)' : 'rgba(192,192,192,0.2)',
            border: 'none',
            borderRadius: '2px',
            color: available ? 'var(--terminal-black, #0a0a0a)' : 'var(--phosphor-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            cursor: available ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
            boxShadow: available ? '0 0 12px rgba(0,255,65,0.3)' : 'none',
            marginBottom: '12px',
          }}
        >
          {submitting ? 'SETTING USERNAME…' : 'SET USERNAME'}
        </button>

        <ul className="rv4-forum-username-rules">
          <li>3–20 characters long</li>
          <li>Letters, numbers, underscores (_), and hyphens (-) only</li>
          <li>Must be unique</li>
          <li>Cannot be changed after setting</li>
        </ul>
      </div>
    </div>
  );
}
