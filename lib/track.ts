/**
 * Analytics events, safe anywhere: a no-op on the server and wherever gtag has not loaded, and it
 * never throws. Events reach Google Analytics only once the visitor has accepted analytics (the
 * consent default in app/layout.tsx is denied; lib/consent.ts updates it).
 */
export type TrackEvent = 'page_view' | 'cta_click' | 'signup_start' | 'signup_submitted' | 'checkout_start' | 'paywall_view';

export type TrackParams = Record<string, string | number | boolean>;

export function trackEvent(name: TrackEvent, params: TrackParams = {}): void {
  try {
    if (typeof window === 'undefined') return;
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag === 'function') gtag('event', name, params);
  } catch {
    // Analytics must never break the page.
  }
}
