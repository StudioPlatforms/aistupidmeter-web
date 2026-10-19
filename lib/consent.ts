/**
 * The visitor's analytics choice. Stored in localStorage under 'gdpr-consent' ('accepted' or
 * 'declined') by the consent dialog, the landing page's consent bar and the footer's Cookie
 * settings; app/layout.tsx reads it before Google Analytics starts (default: denied).
 * See /privacy#cookies.
 */
export const CONSENT_KEY = 'gdpr-consent';

export type AnalyticsChoice = 'accepted' | 'declined' | null;

export function readAnalyticsChoice(): AnalyticsChoice {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'accepted' || v === 'declined' ? v : null;
  } catch {
    return null;
  }
}

/** Record the choice and apply it now. Withdrawing also deletes the Google Analytics cookies. */
export function setAnalyticsChoice(accepted: boolean) {
  try {
    localStorage.setItem(CONSENT_KEY, accepted ? 'accepted' : 'declined');
  } catch {
    /* private mode: the choice holds for this visit only */
  }
  const gtag = (window as any).gtag;
  if (typeof gtag === 'function') {
    gtag('consent', 'update', { analytics_storage: accepted ? 'granted' : 'denied', ad_storage: 'denied' });
  }
  if (!accepted) deleteAnalyticsCookies();
}

function deleteAnalyticsCookies() {
  const names = document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter((n) => n === '_ga' || n.startsWith('_ga_') || n === '_gid');
  const host = location.hostname;
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`];
  for (const name of names) {
    for (const d of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/${d ? `; Domain=${d}` : ''}`;
    }
  }
}
