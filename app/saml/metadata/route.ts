import { samlAcsUrl, samlEntityId } from '@/lib/sso';

export const dynamic = 'force-dynamic';

/**
 * Our SAML service-provider metadata, at the URL we give as our entity ID.
 *
 * The security page tells administrators to use this URL as the entity ID, and identity
 * providers that import metadata (Microsoft Entra ID, ADFS) fetch it. Until 2026-10-06 nothing
 * answered here. It states what we actually do: unsigned AuthnRequests, signed assertions
 * required, the email address as the NameID, and HTTP-POST to our assertion consumer service.
 */
export function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${samlEntityId()}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true"
      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
        Location="${samlAcsUrl()}" index="1" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>
`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/samlmetadata+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
