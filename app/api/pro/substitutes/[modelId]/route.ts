import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { planMeets, isPlan, type Plan } from '@/lib/entitlements';
import { REQUIRED_PLAN } from '@/lib/capabilities';

/**
 * Paid proxy for a model's substitution analysis: which cheaper models can stand
 * in for it, and the measured share of requests that breaks if you switch.
 *
 * The panel in the browser only decides whether to *ask*; this route is the
 * control. It reads the real NextAuth session server-side, resolves the plan
 * through the one entitlement table, and only then presents PRO_API_TOKEN to the
 * benchmark API. The upstream endpoint refuses anything without that token, so
 * calling /api/models/:id/substitutes directly from the internet gets a 401
 * whatever the caller claims about themselves.
 *
 * The minimum plan is read from REQUIRED_PLAN rather than written here, so the
 * copy on the locked panel and the enforcement cannot drift apart.
 */

export const dynamic = 'force-dynamic';

const MINIMUM: Plan = REQUIRED_PLAN.substitutes;

export async function GET(
  _request: NextRequest,
  { params }: { params: { modelId: string } }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Sign in required' },
      { status: 401 }
    );
  }

  const raw = (session.user as any).plan;
  const plan: Plan = isPlan(raw) ? raw : 'free';

  if (!planMeets(plan, MINIMUM)) {
    return NextResponse.json(
      { success: false, error: 'An active subscription is required', requiredPlan: MINIMUM },
      { status: 403 }
    );
  }

  const modelId = parseInt(params.modelId, 10);
  if (!Number.isFinite(modelId) || modelId <= 0) {
    return NextResponse.json(
      { success: false, error: 'Invalid model ID' },
      { status: 400 }
    );
  }

  const token = process.env.PRO_API_TOKEN;
  if (!token) {
    console.error('[pro/substitutes] PRO_API_TOKEN is not configured');
    return NextResponse.json(
      { success: false, error: 'Server misconfiguration' },
      { status: 503 }
    );
  }

  // Server-to-server: straight to the API over loopback, bypassing the public proxy.
  const apiBase = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

  try {
    const upstream = await fetch(`${apiBase}/api/models/${modelId}/substitutes`, {
      headers: { 'x-pro-token': token },
      cache: 'no-store',
    });
    const body = await upstream.json();
    return NextResponse.json(body, { status: upstream.status });
  } catch (error) {
    console.error('[pro/substitutes] Upstream request failed:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load substitution data' },
      { status: 502 }
    );
  }
}
