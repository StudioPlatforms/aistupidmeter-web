import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { startAssessmentCheckout } from '@/lib/assessment';

/**
 * Booking for the workload assessment ($1,290, lib/assessment.ts).
 *
 * Records what the customer arrives with, then hands them to Stripe Checkout. Payment is taken
 * at booking; the scoping guarantee (scope confirmed within two business days, or a full refund
 * before any work starts) is what makes that fair. The request row is kept even if the customer
 * abandons checkout, as status 'awaiting_payment'.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json().catch(() => ({}));

    const contactEmail = String(body.email ?? session?.user?.email ?? '').trim().toLowerCase();
    const workload = String(body.workload ?? '').trim();
    const company = String(body.company ?? '').trim().slice(0, 200) || null;
    const candidateModels = String(body.models ?? '').trim().slice(0, 500) || null;
    const n = Number(body.taskCount);
    const taskCount = Number.isInteger(n) && n >= 1 && n <= 20 ? n : null;

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) {
      return NextResponse.json({ success: false, error: 'A valid contact email is required' }, { status: 400 });
    }
    if (workload.length < 20) {
      return NextResponse.json(
        { success: false, error: 'Tell us a little about the decision — a sentence or two is enough.' },
        { status: 400 }
      );
    }
    if (workload.length > 4000) {
      return NextResponse.json({ success: false, error: 'That is longer than we can accept here.' }, { status: 400 });
    }

    const { id, url } = await startAssessmentCheckout({
      userId: session?.user?.id ? Number(session.user.id) : null,
      contactEmail, company, workload, candidateModels, taskCount,
    });
    console.log(`[assessment] #${id} checkout opened for ${contactEmail}`);
    return NextResponse.json({ success: true, data: { id, url } });
  } catch (error: any) {
    if (error?.code === 'unconfigured') {
      console.error('[assessment] checkout unavailable: STRIPE_PRICE_ASSESSMENT not set');
      return NextResponse.json(
        { success: false, error: 'Online booking is unavailable right now. Please email us and we will set it up by invoice.' },
        { status: 503 }
      );
    }
    console.error('[assessment] booking failed:', error?.message || error);
    return NextResponse.json({ success: false, error: 'Could not start checkout. Please try again.' }, { status: 500 });
  }
}
