'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface CountUpProps {
  value: number;
  /** How to print a number; default is a thousands-separated integer. */
  format?: (n: number) => string;
  /** Milliseconds. */
  duration?: number;
}

const plain = (n: number) => Math.round(n).toLocaleString('en-US');
// Layout effect on the client so the reset to zero lands before the first paint (no flash of the
// final value); plain effect on the server, where layout effects only produce a warning.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * A number that counts up from zero the first time it is on screen, as the landing's stats do.
 * Prints the final value straight away for reduced motion, and on any later change of `value`,
 * so a data refresh never replays the animation over real numbers.
 */
export default function CountUp({ value, format = plain, duration = 1200 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const played = useRef(false);
  const [shown, setShown] = useState<number>(value);

  useIsoLayoutEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (played.current || still || !Number.isFinite(value) || value === 0) {
      played.current = true;
      setShown(value);
      return;
    }
    const el = ref.current;
    if (!el) return;
    setShown(0);
    let raf = 0;
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      io.disconnect();
      played.current = true;
      const t0 = performance.now();
      const frame = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        setShown(p < 1 ? value * (1 - Math.pow(1 - p, 3)) : value);
        if (p < 1) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }, { threshold: 0.3 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      // Interrupted mid-count (value changed or unmount): never leave a partial number behind.
      if (!played.current) setShown(value);
    };
  }, [value, duration]);

  return <span ref={ref}>{format(shown)}</span>;
}
