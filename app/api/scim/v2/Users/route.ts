import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateScim, listMembers, parseUserNameFilter, findMemberByEmail, createMember,
  toScimUser, scimError, auditScim, SCIM_LIST_SCHEMA, SCIM_CONTENT_TYPE,
} from '@/lib/scim';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://aistupidlevel.info';

const scimJson = (body: unknown, status = 200) =>
  new NextResponse(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': SCIM_CONTENT_TYPE },
  });

/** GET /api/scim/v2/Users — list or filter memberships. */
export async function GET(request: NextRequest) {
  const auth = authenticateScim(request.headers.get('authorization'));
  if (!auth) return scimJson(scimError(401, 'Invalid or missing bearer token'), 401);

  const params = new URL(request.url).searchParams;
  const filterEmail = parseUserNameFilter(params.get('filter'));
  const startIndex = Number(params.get('startIndex') ?? 1) || 1;
  const count = Number(params.get('count') ?? 100) || 100;

  const { rows, total } = listMembers(auth.orgId, { filterEmail, startIndex, count });

  return scimJson({
    schemas: [SCIM_LIST_SCHEMA],
    totalResults: total,
    startIndex,
    itemsPerPage: rows.length,
    Resources: rows.map(r => toScimUser(r, APP_URL)),
  });
}

/**
 * POST /api/scim/v2/Users — provision a member.
 *
 * A directory that re-sends someone it already provisioned gets 409 with the
 * existing resource's id, which is what RFC 7644 asks for and what stops a
 * retried sync from creating duplicates.
 */
export async function POST(request: NextRequest) {
  const auth = authenticateScim(request.headers.get('authorization'));
  if (!auth) return scimJson(scimError(401, 'Invalid or missing bearer token'), 401);

  const body = await request.json().catch(() => null) as any;
  if (!body) return scimJson(scimError(400, 'Body must be JSON'), 400);

  const email = String(
    body.userName ?? body.emails?.find((e: any) => e.primary)?.value ?? body.emails?.[0]?.value ?? ''
  ).trim().toLowerCase();

  if (!email.includes('@')) {
    return scimJson(scimError(400, 'userName must be an email address', 'invalidValue'), 400);
  }

  const existing = findMemberByEmail(auth.orgId, email);
  if (existing) {
    return scimJson(scimError(409, `User ${email} already exists as id ${existing.id}`, 'uniqueness'), 409);
  }

  const name: string | null =
    body.displayName ??
    body.name?.formatted ??
    ([body.name?.givenName, body.name?.familyName].filter(Boolean).join(' ') || null);
  const active = body.active !== false;

  const created = createMember(auth.orgId, email, name, body.externalId ?? null, active);
  auditScim(auth.orgId, 'member.provisioned', email, { active, externalId: body.externalId ?? null });

  return scimJson(toScimUser(created, APP_URL), 201);
}
