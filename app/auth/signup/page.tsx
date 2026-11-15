import SignUpClient from './SignUpClient';

const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

/**
 * Whether provider accounts are open to new sign-ups, as the API says (GET
 * /marketplace/public/status over loopback; nginx has no /marketplace location, so only this
 * server can ask). Until they open to everyone the answer is false and the sign-up page has no
 * provider switch. Cached for a minute, so the page stays static between checks; any failure
 * (an older API without the route, a restart, a timeout) reads as false.
 */
async function providerSignupOpen(): Promise<boolean> {
  try {
    const r = await fetch(`${API_URL}/marketplace/public/status`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(3000) });
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    return j?.success === true && j?.data?.providerSignup === true;
  } catch {
    return false;
  }
}

export default async function SignUpPage() {
  return <SignUpClient providerSignup={await providerSignupOpen()} />;
}
