'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent } from '@/lib/track';

export default function VisitorTracker() {
  const pathname = usePathname();
  const firstPath = useRef(true);

  useEffect(() => {
    const trackVisit = async () => {
      try {
        // Only what the server cannot see for itself. The visitor's IP, user agent and the time
        // are taken by the API from the request (and the IP geolocated there): until 2026-10-05
        // the browser looked its own IP up at api.ipify.org — a third party told about every
        // visit, blocked by most ad blockers — and the API stored whatever IP and clock it was
        // sent, so rows could be forged or dated days ahead.
        await fetch('/track-visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referer: document.referrer || null, path: pathname }),
          keepalive: true,
        });
      } catch (error) {
        // Silently fail - don't break the user experience
        console.log('Visitor tracking failed:', error);
      }
    };

    // Track visit after a short delay to avoid blocking page load
    const timer = setTimeout(trackVisit, 1000);

    return () => clearTimeout(timer);
  }, [pathname]);

  // Analytics page views for client-side navigations. The first path is the full page load,
  // which the gtag config in app/layout.tsx already reports; counting it here would double it.
  useEffect(() => {
    if (firstPath.current) { firstPath.current = false; return; }
    trackEvent('page_view', { page_path: pathname ?? '' });
  }, [pathname]);

  // One delegated listener for every call to action: any anchor or button with data-cta
  // (components/seo/Cta.tsx) reports which one was taken, where it led and from which page.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      try {
        const target = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-cta]') : null;
        if (!target) return;
        trackEvent('cta_click', {
          label: target.dataset.cta ?? '',
          target: target.getAttribute('href') ?? '',
          page: window.location.pathname,
        });
      } catch {
        // never interfere with the click
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // This component doesn't render anything
  return null;
}
