import { NextResponse } from 'next/server';
import { SCIM_CONTENT_TYPE } from '@/lib/scim';

export const dynamic = 'force-dynamic';

/**
 * What this SCIM implementation actually supports.
 *
 * Every capability here is reported honestly. `patch` is true because
 * deactivation depends on it; `filter` is true for the one filter directories
 * send. Group management is reported as unsupported rather than quietly
 * accepted — an identity provider that believes it is syncing groups when
 * nothing happens is a worse failure than one that knows roles are managed here.
 */
export async function GET() {
  return new NextResponse(
    JSON.stringify({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      documentationUri: 'https://aistupidlevel.info/contact?topic=enterprise',
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [{
        type: 'oauthbearertoken',
        name: 'OAuth Bearer Token',
        description: 'A workspace-scoped bearer token issued from the security settings page.',
        primary: true,
      }],
      meta: { resourceType: 'ServiceProviderConfig', location: '/api/scim/v2/ServiceProviderConfig' },
    }),
    { headers: { 'Content-Type': SCIM_CONTENT_TYPE } }
  );
}
