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
      const hours = now.getHours();
      const slots = [0, 4, 8, 12, 16, 20];
      let next = slots.find(s => s > hours);
      if (!next) next = slots[0];
      
      const nextRun = new Date(now);
      if (next <= hours) nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(next, 0, 0, 0);
      
      const diffMs = nextRun.getTime() - now.getTime();
      const diffH = Math.floor(diffMs / 3600000);
      const diffM = Math.floor((diffMs % 3600000) / 60000);
      
      setNextBenchTime(`${diffH}h ${diffM}m (${String(next).padStart(2, '0')}:00)`);
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
        <span>Next bench: <b style={{ color: 'var(--phosphor-green)' }}>{nextBenchTime}</b></span>
      </div>
      <div>
        {visitorCount ? `${Math.round(visitorCount / 1000)}K visitors` : 'Monitoring AI since 2025'}
      </div>
    </div>
  );
}
