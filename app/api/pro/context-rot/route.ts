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
 *
 * ?model=<name> (model detail page): one model's results plus the other pilot models'
 * overall accuracy, for context. Below the plan it answers only whether the model is in
 * the pilot at all — which the public page already says — so a model page can tell
 * "not measured yet" apart from "measured, upgrade to see it". Never a figure.
 */
export const dynamic = 'force-dynamic';

const MINIMUM: Plan = REQUIRED_PLAN['context-rot'];
const apiBase = () => process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

/** Pilot membership changes when the code does, not between requests: hold it ten minutes. */
let members: { at: number; names: string[]; displayNames: string[] } | null = null;
const MEMBERS_TTL_MS = 10 * 60_000;

async function loadAll(token: string) {
  const upstream = await fetch(`${apiBase()}/api/context-rot`, { headers: { 'x-pro-token': token }, cache: 'no-store' });
  const body = await upstream.json();
  if (upstream.ok && body?.success) {
    const models = body.data.models as Array<{ name: string; displayName: string }>;
    members = { at: Date.now(), names: models.map(m => m.name), displayNames: models.map(m => m.displayName) };
  }
  return { upstream, body };
}

async function pilotMembers(token: string) {
  if (!members || Date.now() - members.at > MEMBERS_TTL_MS) await loadAll(token);
  return members;
}

export async function GET(req: Request) {
  const model = new URL(req.url).searchParams.get('model');
  const token = process.env.PRO_API_TOKEN;
  if (!token) {
    console.error('[pro/context-rot] PRO_API_TOKEN is not configured');
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 503 });
  }

  try {
    const session = await auth();
    const raw = (session?.user as any)?.plan;
    const plan: Plan = isPlan(raw) ? raw : 'free';
    const allowed = !!session?.user && planMeets(plan, MINIMUM);

    if (!allowed) {
      const status = session?.user ? 403 : 401;
      const error = session?.user ? 'An active subscription is required' : 'Sign in required';
      if (!model) return NextResponse.json({ success: false, error, requiredPlan: MINIMUM }, { status });
      const m = await pilotMembers(token);
      return NextResponse.json(
        { success: false, error, requiredPlan: MINIMUM, inPilot: !!m?.names.includes(model), pilotModels: m?.displayNames ?? [] },
        { status, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    const { upstream, body } = await loadAll(token);
    if (!model || !upstream.ok || !body?.success) {
      return NextResponse.json(body, { status: upstream.status, headers: { 'Cache-Control': 'private, no-store' } });
    }

    const all = body.data.models as Array<{ name: string; displayName: string; buckets: Array<{ bucket: number; runnable: boolean; accuracy: number | null }> }>;
    const mine = all.find(m => m.name === model) ?? null;
    return NextResponse.json({
      success: true,
      inPilot: !!mine,
      pilotModels: all.map(m => m.displayName),
      data: mine && {
        buckets: body.data.buckets,
        depths: body.data.depths,
        model: mine,
        others: all.filter(m => m.name !== model).map(m => ({
          name: m.name, displayName: m.displayName,
          buckets: m.buckets.map(b => ({ bucket: b.bucket, runnable: b.runnable, accuracy: b.accuracy })),
        })),
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[pro/context-rot] upstream failed:', err);
    return NextResponse.json({ success: false, error: 'Could not load results' }, { status: 502 });
  }
}
