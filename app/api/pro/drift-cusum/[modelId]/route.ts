import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

/**
 * Pro-gated proxy for the CUSUM drift series.
 *
 * The paywall has to be enforced somewhere the client cannot reach. The browser
 * gate in ModelDetailCusum only decides whether to *ask* — it is a UX
 * affordance, not a control. This route is the control: it reads the real
 * NextAuth session server-side, confirms an active subscription, and only then
 * presents PRO_API_TOKEN to the benchmark API.
 *
 * The upstream endpoint refuses any request without that token, so hitting
 * /api/drift/cusum directly gets a 401 regardless of what the caller claims
 * about themselves.
 */

export const dynamic = 'force-dynamic';

const VALID_PERIODS = new Set(['24h', '7d', '1m', 'all']);

export async function GET(
  request: NextRequest,
  { params }: { params: { modelId: string } }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Sign in required' },
      { status: 401 }
    );
  }

  const status = (session.user as any).subscriptionStatus;
  const isPro = status === 'active' || status === 'trialing';

  if (!isPro) {
    return NextResponse.json(
      { success: false, error: 'An active Pro subscription is required' },
      { status: 403 }
    );
  }

  const modelId = parseInt(params.modelId, 10);
  if (isNaN(modelId) || modelId <= 0) {
    return NextResponse.json(
      { success: false, error: 'Invalid model ID' },
      { status: 400 }
    );
  }

  const period = request.nextUrl.searchParams.get('period') || '7d';
  if (!VALID_PERIODS.has(period)) {
    return NextResponse.json(
      { success: false, error: 'Invalid period' },
      { status: 400 }
    );
  }

  const token = process.env.PRO_API_TOKEN;
  if (!token) {
    console.error('[pro/drift-cusum] PRO_API_TOKEN is not configured');
    return NextResponse.json(
      { success: false, error: 'Server misconfiguration' },
      { status: 503 }
    );
  }

  // Server-to-server: go straight to the API, bypassing the public proxy.
  const apiBase = process.env.API_INTERNAL_URL || 'http://localhost:4000';

  try {
    const upstream = await fetch(
      `${apiBase}/api/drift/cusum/${modelId}?period=${encodeURIComponent(period)}`,
      {
        headers: { 'x-pro-token': token },
        cache: 'no-store',
      }
    );

    const body = await upstream.json();
    return NextResponse.json(body, { status: upstream.status });
  } catch (error) {
    console.error('[pro/drift-cusum] Upstream request failed:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load drift history' },
      { status: 502 }
    );
  }
}
