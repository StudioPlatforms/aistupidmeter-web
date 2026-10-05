'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function VisitorTracker() {
  const pathname = usePathname();

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

  // This component doesn't render anything
  return null;
}
