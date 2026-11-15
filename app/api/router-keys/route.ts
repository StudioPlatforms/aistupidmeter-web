import { NextResponse } from 'next/server';

const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
const KID = /^20[2-9][0-9]-(0[1-9]|1[0-2])$/;
const B64URL_32 = /^[A-Za-z0-9_-]{43}$/;

/**
 * GET /.well-known/asl-router-keys.json (rewritten here by next.config.js) — the Smart Router's public signing keys
 * (Phase 3 plan §8.6; M8): `{ keys: [{ kid, alg: 'Ed25519', x, not_before, not_after }] }`, from the API's
 * GET /marketplace/public/router-keys over loopback, which derives them from the signing keys in its environment
 * (the private halves never leave it). The same for every visitor, so no identity is sent and the answer is kept for
 * up to 5 minutes. Only well-formed keys pass; a failure is a 503 that is never cached, so a host's verifier retries
 * instead of trusting an empty list.
 */
export const dynamic = 'force-dynamic';

type Key = { kid: string; alg: 'Ed25519'; x: string; not_before: number; not_after: number };

function wellFormed(k: unknown): k is Key {
  if (!k || typeof k !== 'object') return false;
  const o = k as Record<string, unknown>;
  return typeof o.kid === 'string' && KID.test(o.kid) && o.alg === 'Ed25519' && typeof o.x === 'string' && B64URL_32.test(o.x)
    && Number.isInteger(o.not_before) && Number.isInteger(o.not_after) && (o.not_before as number) < (o.not_after as number);
}

const unavailable = () => NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } });

export async function GET() {
  try {
    const r = await fetch(`${API_URL}/marketplace/public/router-keys`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(4_000) });
    if (!r.ok) return unavailable();
    const j = await r.json().catch(() => null) as { keys?: unknown } | null;
    if (!j || !Array.isArray(j.keys)) return unavailable();
    const keys = j.keys.filter(wellFormed).slice(0, 4).map(k => ({ kid: k.kid, alg: k.alg, x: k.x, not_before: k.not_before, not_after: k.not_after }));
    return NextResponse.json({ keys }, {
      headers: { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return unavailable();
  }
}
