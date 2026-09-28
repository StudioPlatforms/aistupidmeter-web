import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { planMeets, isPlan, type Plan } from '@/lib/entitlements';
import { REQUIRED_PLAN } from '@/lib/capabilities';

/**
 * Paid proxy for the context-rot pilot results (Pro Intelligence and above).
 *
 * The page only decides whether to ask; this route is the control. It reads the real
 * session server-side, checks the plan against REQUIRED_PLAN, and only then presents
 * PRO_API_TOKEN to the benchmark API over loopback. /api/context-rot has no nginx
 * location, so the upstream is not reachable from outside at all.
 */
export const dynamic = 'force-dynamic';

const MINIMUM: Plan = REQUIRED_PLAN['context-rot'];

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Sign in required', requiredPlan: MINIMUM }, { status: 401 });
  }
  const raw = (session.user as any).plan;
  const plan: Plan = isPlan(raw) ? raw : 'free';
  if (!planMeets(plan, MINIMUM)) {
    return NextResponse.json({ success: false, error: 'An active subscription is required', requiredPlan: MINIMUM }, { status: 403 });
  }
  const token = process.env.PRO_API_TOKEN;
  if (!token) {
    console.error('[pro/context-rot] PRO_API_TOKEN is not configured');
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 503 });
  }
  const apiBase = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  try {
    const upstream = await fetch(`${apiBase}/api/context-rot`, { headers: { 'x-pro-token': token }, cache: 'no-store' });
    const body = await upstream.json();
    return NextResponse.json(body, { status: upstream.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[pro/context-rot] upstream failed:', err);
    return NextResponse.json({ success: false, error: 'Could not load results' }, { status: 502 });
  }
}
