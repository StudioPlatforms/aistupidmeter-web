import React, { useMemo, useRef, useEffect } from 'react';

const TickerTape = React.memo(function TickerTape({ items }: { items: string[] }) {
  // Build the string once; only changes when items change
  const html = useMemo(() => {
    const spans = items.map((item) => {
      let colorClass = 'terminal-text--green';
      if (item.includes('🚨') || item.includes('💀') || item.includes('CRITICAL')) {
        colorClass = 'terminal-text--red';
      } else if (item.includes('⚠️') || item.includes('WARNING') || item.includes('ALERT')) {
        colorClass = 'terminal-text--amber';
      } else if (item.includes('🥇') || item.includes('🥈') || item.includes('🥉')) {
        colorClass = 'terminal-text--amber ticker-pulsing';
      }
      return `<span class="${colorClass}">${item}</span>`;
    });
    return spans.join(' • ');
  }, [items]);

  const trackARef = useRef<HTMLDivElement>(null);
  const trackBRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Imperatively update to avoid React remounting nodes that carry the animation
    if (trackARef.current) trackARef.current.innerHTML = html;
    if (trackBRef.current) trackBRef.current.innerHTML = html;
  }, [html]);

  return (
    <div className="ticker-tape-container">
      <div className="ticker-tape-scroll">
        <div className="ticker-tape-track" ref={trackARef} aria-label="ticker lane A" />
        <div className="ticker-tape-track" ref={trackBRef} aria-label="ticker lane B" />
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return prevProps.items.length === nextProps.items.length && 
         prevProps.items.join(' • ') === nextProps.items.join(' • ');
});

export default TickerTape;
