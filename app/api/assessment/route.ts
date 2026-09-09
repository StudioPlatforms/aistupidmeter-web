import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { openIdentityDb } from '@/lib/identity-db';

/**
 * Intake for the $490 workload assessment.
 *
 * Payment does not come first. The scope is agreed with a human before anyone is
 * charged, because the offer includes a refund if we cannot deliver the agreed
 * report — taking money before knowing the workload is supportable would make
 * that promise expensive and unkeepable. So this records the request and starts
 * a conversation; checkout happens after scoping.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json().catch(() => ({}));

    const contactEmail = String(body.email ?? session?.user?.email ?? '').trim().toLowerCase();
    const workload = String(body.workload ?? '').trim();
    const company = String(body.company ?? '').trim() || null;
    const candidateModels = String(body.models ?? '').trim() || null;
    const taskCount = Number.isFinite(Number(body.taskCount)) ? Number(body.taskCount) : null;

    if (!contactEmail.includes('@')) {
      return NextResponse.json({ success: false, error: 'A contact email is required' }, { status: 400 });
    }
    if (workload.length < 20) {
      return NextResponse.json(
        { success: false, error: 'Tell us a little about the workload — a sentence or two is enough.' },
        { status: 400 }
      );
    }
    if (workload.length > 4000) {
      return NextResponse.json({ success: false, error: 'That is longer than we can accept here.' }, { status: 400 });
    }

    const db = openIdentityDb();
    const info = db.prepare(`
      INSERT INTO assessment_requests
        (user_id, contact_email, company, workload, candidate_models, task_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      session?.user?.id ? Number(session.user.id) : null,
      contactEmail, company, workload, candidateModels, taskCount
    );

    console.log(`[assessment] request #${info.lastInsertRowid} from ${contactEmail}`);
    return NextResponse.json({ success: true, data: { id: Number(info.lastInsertRowid) } });
  } catch (error) {
    console.error('[assessment] intake failed:', error);
    return NextResponse.json({ success: false, error: 'Could not record your request' }, { status: 500 });
  }
}
