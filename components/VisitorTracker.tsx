'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const trackVisit = async () => {
      try {
        // Get client IP and user agent
        const userAgent = navigator.userAgent;
        const referer = document.referrer || null;
        const timestamp = new Date().toISOString();
        
        // Get client IP from a service (fallback to unknown)
        let clientIP = 'unknown';
        try {
          const ipResponse = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipResponse.json();
          clientIP = ipData.ip;
        } catch (error) {
          console.log('Could not get IP address:', error);
        }

        // Track the visit
        await fetch('https://aistupidlevel.info/track-visit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ip: clientIP,
            userAgent,
            referer,
            path: pathname,
            timestamp,
          }),
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
