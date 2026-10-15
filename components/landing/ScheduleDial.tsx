'use client';

import { useEffect, useRef, useState } from 'react';
import { onView, pad2 } from './util';

/**
 * The benchmark day on a 24-hour dial, in the visitor's own time zone. Times are the scheduler's
 * (apps/api/src/scheduler.ts), which runs on Europe/Berlin time: health every 10 minutes, canary
 * hourly, coding every 4 hours, calibration at :20 past 03/09/15/21, reasoning 03:00, tool use 04:00,
 * robustness 06:00 and bias 06:40.
 */
const C = 300;
const DAILY: Array<[number, string]> = [[180, 'Reasoning'], [240, 'Tool use'], [360, 'Robustness'], [400, 'Bias']];

function tzOffset(tz: string, d: Date): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(d).map(x => [x.type, x.value]));
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - d.getTime()) / 60000);
}
const ang = (m: number) => (m / 1440) * Math.PI * 2 - Math.PI / 2;
const at = (m: number, r: number): [number, number] => [C + r * Math.cos(ang(m)), C + r * Math.sin(ang(m))];

export default function ScheduleDial() {
  const ref = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState<number | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [zone, setZone] = useState('Your time');
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const d = new Date();
    try {
      setShift(-d.getTimezoneOffset() - tzOffset('Europe/Berlin', d));
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      setZone(`Your time · ${tz.split('/').pop()?.replace(/_/g, ' ') || 'local'}`);
    } catch {
      setShift(0);
    }
    setNow(d);
    const t = setInterval(() => setNow(new Date()), 1000);
    const stop = onView(ref.current, () => setInView(true), 0.3);
    return () => { clearInterval(t); stop(); };
  }, []);

  const loc = (m: number) => (((m + (shift ?? 0)) % 1440) + 1440) % 1440;
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 : 0;
  const todo = (lm: number) => (lm > nowMin ? 'lp-dk-todo' : undefined);
  // Health checks run on Berlin's 10-minute marks, which are UTC's (Berlin's offset is whole hours).
  const left = now ? 600 - ((now.getUTCMinutes() % 10) * 60 + now.getUTCSeconds()) : 0;
  const ready = shift !== null && now !== null;

  const big = nowMin > 720 ? 1 : 0;
  const [ox, oy] = at(0, 246), [ox2, oy2] = at(nowMin, 246), [ix, iy] = at(0, 158), [ix2, iy2] = at(nowMin, 158);
  const [h1x, h1y] = at(nowMin, 156), [h2x, h2y] = at(nowMin, 270);

  return (
    <div className={`lp-dial${inView ? ' is-in' : ''}`} ref={ref}>
      <svg viewBox="0 0 600 600" role="img" aria-label="24-hour benchmark schedule in your time zone">
        <circle cx={C} cy={C} r={262} className="lp-dial-ring" />
        <circle cx={C} cy={C} r={150} className="lp-dial-ring" />
        {[234, 212, 192, 172].map(r => <circle key={r} cx={C} cy={C} r={r} className="lp-dial-track" />)}
        {ready && <path className="lp-dial-day" d={`M${ox},${oy} A246,246 0 ${big} 1 ${ox2},${oy2} L${ix2},${iy2} A158,158 0 ${big} 0 ${ix},${iy} Z`} />}
        {ready && (
          <>
            <g className="lp-grp">
              {Array.from({ length: 144 }, (_, k) => {
                const lm = loc(k * 10), [x1, y1] = at(lm, 250), [x2, y2] = at(lm, k % 6 ? 258 : 262);
                return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} className={`lp-dk-h ${todo(lm) ?? ''}`} />;
              })}
            </g>
            <g className="lp-grp">
              {Array.from({ length: 24 }, (_, k) => {
                const lm = loc(k * 60), [x, y] = at(lm, 234);
                return <circle key={k} cx={x} cy={y} r={3.8} className={`lp-dk-c ${todo(lm) ?? ''}`} />;
              })}
            </g>
            <g className="lp-grp">
              {Array.from({ length: 6 }, (_, k) => {
                const lm = loc(k * 240), [x, y] = at(lm, 212), deg = (lm / 1440) * 360;
                return <rect key={k} x={x - 9} y={y - 3.5} width={18} height={7} rx={2} className={`lp-dk-cd ${todo(lm) ?? ''}`} transform={`rotate(${deg} ${x} ${y}) skewX(-16)`} />;
              })}
            </g>
            <g className="lp-grp">
              {[200, 560, 920, 1280].map(m => {
                const lm = loc(m), [x, y] = at(lm, 192);
                return <circle key={m} cx={x} cy={y} r={5} className={`lp-dk-cal ${todo(lm) ?? ''}`} />;
              })}
            </g>
            <g className="lp-grp">
              {DAILY.map(([m, t]) => {
                const lm = loc(m), [x, y] = at(lm, 172);
                return <circle key={m} cx={x} cy={y} r={5.5} className={`lp-dk-d ${todo(lm) ?? ''}`}><title>{t}</title></circle>;
              })}
            </g>
            <line className="lp-dial-hand" x1={h1x} y1={h1y} x2={h2x} y2={h2y} />
            <circle className="lp-dial-tip" cx={h2x} cy={h2y} r={5} />
          </>
        )}
        {Array.from({ length: 8 }, (_, k) => {
          const [x, y] = at(k * 180, 286);
          return <text key={k} x={x} y={y} className="lp-dial-hour">{pad2(k * 3)}</text>;
        })}
      </svg>
      <div className="lp-dial-c">
        <span className="lp-dial-tz">{zone}</span>
        <span className="lp-dial-time">{now ? `${pad2(now.getHours())}:${pad2(now.getMinutes())}` : '--:--'}</span>
        <span className="lp-dial-next">Next health check in <b>{now ? `${Math.floor(left / 60)}:${pad2(left % 60)}` : '--:--'}</b></span>
      </div>
    </div>
  );
}
