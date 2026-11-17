/**
 * M12 (the code and security review SHOULD-1): the provider console's POSTs that make ASL email an address someone typed
 * (an invitation, its resend, the notice-address link) and the creation of a provider account, which starts that path,
 * pass the site's mail-form guard first (Tor exits and scripted user agents refused), as sign-up and the contact form do.
 * The API caps them per user, per client address and per recipient (routes/marketplace-provider.ts).
 */
export function providerMailForm(path: string[], method: string): string | null {
  if (method !== 'POST' || path[0] !== 'provider') return null;
  const p = path.slice(1).join('/');
  if (p === '') return 'provider-create';
  if (p === 'members') return 'provider-invite';
  if (/^members\/[1-9][0-9]{0,15}\/resend$/.test(p)) return 'provider-invite-resend';
  if (p === 'notice-email/send') return 'provider-notice-link';
  return null;
}
