'use client';

import { useState, useEffect } from 'react';

interface V4FooterProps {
  visitorCount: number | null;
}

export default function V4Footer({ visitorCount }: V4FooterProps) {
  const [nextBenchTime, setNextBenchTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();

      // The code sweep is cron '0 */4 * * *' in EUROPE/BERLIN. This used to read the
      // VIEWER's clock (now.getHours()) and claim the next run was at their 00/04/08...,
      // so everyone outside Berlin's offset saw a countdown that was wrong by their offset
      // — six hours out in New York. Intl gives Berlin's real wall clock, DST included,
      // without shipping a timezone library.
      const berlin = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Berlin',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }).formatToParts(now).reduce((acc: Record<string, string>, p) => {
        acc[p.type] = p.value;
        return acc;
      }, {});

      const bh = Number(berlin.hour) % 24;   // '24' is a legal formatting of midnight
      const bm = Number(berlin.minute);
      const bs = Number(berlin.second);

      // Seconds remaining in the current 4-hour block, on Berlin's clock.
      let secsLeft = (4 * 3600) - (((bh % 4) * 3600) + bm * 60 + bs);
      if (secsLeft <= 0) secsLeft += 4 * 3600;

      const nextRun = new Date(now.getTime() + secsLeft * 1000);
      const diffH = Math.floor(secsLeft / 3600);
      const diffM = Math.floor((secsLeft % 3600) / 60);

      // Show the run in the VIEWER's local time: the countdown is the useful part, and a
      // Berlin timestamp means nothing to someone reading this in another timezone.
      const localTime = nextRun.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

      setNextBenchTime(`${diffH}h ${diffM}m (${localTime})`);
    };
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="v4-footer">
      <div>
        A product of <a href="https://studioplatforms.eu" target="_blank" rel="noopener noreferrer">Studio Platforms</a> — © {new Date().getFullYear()}
      </div>
      <div className="v4-footer-center">
        <a href="https://www.reddit.com/r/aistupidlevel/" target="_blank" rel="noopener noreferrer">r/AIStupidLevel</a>
        <a href="https://x.com/AIStupidlevel" target="_blank" rel="noopener noreferrer">Follow on X</a>
        <a href="https://github.com/StudioPlatforms/aistupidmeter-web" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="https://www.producthunt.com/products/aistupidlevel?launch=aistupidlevel" target="_blank" rel="noopener noreferrer">Product Hunt</a>
        <a href="/status">Provider status</a>
        <a href="/contact">Contact</a>
        <span>Next bench: <b style={{ color: 'var(--phosphor-green)' }}>{nextBenchTime}</b></span>
      </div>
      <div>
        {visitorCount ? `${Math.round(visitorCount / 1000)}K visitors` : 'Monitoring AI since 2025'}
      </div>
    </div>
  );
}
