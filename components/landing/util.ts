'use client';

import { useEffect, useState } from 'react';
import { METRIC_LABEL, type MetricKind } from './types';

/** True when the visitor asked the OS for less motion. False on the server and first render. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Column heading for a ranking: the suite for score strategies, the ordering metric otherwise. */
export function scoreLabel(effectiveStrategy: string, kind: MetricKind): string {
  switch (effectiveStrategy) {
    case 'best_coding': return 'Coding score';
    case 'best_reasoning': return 'Reasoning score';
    case 'best_tooling': return 'Tool-use score';
    case 'best_overall': return 'Combined score';
    default: return METRIC_LABEL[kind];
  }
}

/** Run once the element is on screen. */
export function onView(el: Element | null, fn: () => void, threshold = 0.2): () => void {
  if (!el) return () => {};
  const io = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); }
  }, { threshold });
  io.observe(el);
  return () => io.disconnect();
}

export const pad2 = (n: number) => String(n).padStart(2, '0');
