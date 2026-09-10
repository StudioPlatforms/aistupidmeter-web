import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateScim, getMember, setMemberActive, toScimUser, scimError, auditScim,
  SCIM_CONTENT_TYPE,
} from '@/lib/scim';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://aistupidlevel.info';

const scimJson = (body: unknown, status = 200) =>
  new NextResponse(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': SCIM_CONTENT_TYPE },
  });

function resolve(request: NextRequest, id: string) {
  const auth = authenticateScim(request.headers.get('authorization'));
  if (!auth) return { error: scimJson(scimError(401, 'Invalid or missing bearer token'), 401) };
  const memberId = Number(id);
  if (!Number.isInteger(memberId)) {
    return { error: scimJson(scimError(404, 'No such user'), 404) };
  }
  const member = getMember(auth.orgId, memberId);
  if (!member) return { error: scimJson(scimError(404, 'No such user'), 404) };
  return { auth, member, memberId };
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const r = resolve(request, params.id);
  if ('error' in r) return r.error;
  return scimJson(toScimUser(r.member, APP_URL));
}

/**
 * PATCH — the operation directories actually use for deactivation.
 *
 * Only `active` is honoured. Azure AD, Okta and Google all express an offboard
 * as `replace` on that attribute, in several shapes: a bare value, a value keyed
 * by attribute name, or a path. All three are accepted; anything else is
 * acknowledged without change rather than rejected, because a directory that
 * gets a 400 for an attribute it always sends will mark the whole sync failed.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const r = resolve(request, params.id);
  if ('error' in r) return r.error;

  const body = await request.json().catch(() => null) as any;
  const ops: any[] = Array.isArray(body?.Operations) ? body.Operations : [];

  let nextActive: boolean | null = null;
  for (const op of ops) {
    if (String(op?.op ?? '').toLowerCase() !== 'replace') continue;
    const path = String(op.path ?? '').toLowerCase();
    if (path === 'active') {
      nextActive = op.value === true || op.value === 'True' || op.value === 'true';
    } else if (!path && op.value && typeof op.value === 'object' && 'active' in op.value) {
      nextActive = op.value.active === true || op.value.active === 'True' || op.value.active === 'true';
    }
  }

  if (nextActive === null) {
    return scimJson(toScimUser(r.member, APP_URL));
  }

  const updated = setMemberActive(r.auth.orgId, r.memberId, nextActive);
  if (!updated) return scimJson(scimError(404, 'No such user'), 404);

  auditScim(
    r.auth.orgId,
    nextActive ? 'member.reactivated' : 'member.deactivated',
    updated.email ?? updated.invite_email ?? String(updated.id),
    { via: 'scim' },
  );
  return scimJson(toScimUser(updated, APP_URL));
}

/** PUT — full replace. Only `active` is meaningful to us. */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const r = resolve(request, params.id);
  if ('error' in r) return r.error;

  const body = await request.json().catch(() => null) as any;
  const active = body?.active !== false;
  const updated = setMemberActive(r.auth.orgId, r.memberId, active);
  if (!updated) return scimJson(scimError(404, 'No such user'), 404);

  auditScim(
    r.auth.orgId,
    active ? 'member.reactivated' : 'member.deactivated',
    updated.email ?? updated.invite_email ?? String(updated.id),
    { via: 'scim', method: 'PUT' },
  );
  return scimJson(toScimUser(updated, APP_URL));
}

/**
 * DELETE — deactivate rather than destroy.
 *
 * A directory sync misconfiguration should not be able to erase a workspace's
 * membership history, and a re-hire should be one flag away from working again.
 * The response is the 204 the specification asks for, so the directory is happy.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const r = resolve(request, params.id);
  if ('error' in r) return r.error;

  const updated = setMemberActive(r.auth.orgId, r.memberId, false);
  auditScim(
    r.auth.orgId, 'member.deactivated',
    updated?.email ?? updated?.invite_email ?? String(r.memberId),
    { via: 'scim', method: 'DELETE' },
  );
  return new NextResponse(null, { status: 204 });
}
