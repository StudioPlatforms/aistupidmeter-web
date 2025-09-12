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

  const scrollRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const positionRef = useRef(0);

  useEffect(() => {
    // Create extremely long content for truly continuous scrolling
    const longHtml = Array(100).fill(html).join(' • ');
    // Imperatively update to avoid React remounting nodes that carry the animation
    if (scrollRef.current) scrollRef.current.innerHTML = longHtml;
  }, [html]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    // Speed: pixels per second (adjust as needed)
    const speed = window.innerWidth < 768 ? 80 : 30; // Another 50% slower on desktop

    const animate = () => {
      positionRef.current -= speed * 0.016; // 60fps approximation

      // Reset position when we've scrolled through enough content
      const resetThreshold = -scrollElement.scrollWidth / 2;
      if (positionRef.current < resetThreshold) {
        positionRef.current = 0;
      }

      scrollElement.style.transform = `translateX(${positionRef.current}px)`;
      animationRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animationRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="ticker-tape-container">
      <div className="ticker-tape-scroll">
        <div className="ticker-tape-track" ref={scrollRef} aria-label="ticker lane" />
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return prevProps.items.length === nextProps.items.length &&
         prevProps.items.join(' • ') === nextProps.items.join(' • ');
});

export default TickerTape;
