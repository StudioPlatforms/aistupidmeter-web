import NextAuth, { CredentialsSignin } from 'next-auth';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { 
  findUserByEmail, 
  findUserById,
  createUserWithPassword,
  createUserWithOAuth,
  updateUserLastLogin,
  hasActiveSubscription,
  verifyUserEmail
} from './lib/db-client';
import { sendWelcomeEmail } from './lib/email-service';
import { consumeTicket, ssoRequiredFor } from '@/lib/sso';
import { planFor, entitlementsFor } from '@/lib/entitlements';
import { withWorkspace } from './lib/workspace-plan';
import { verifyPassword } from './lib/password';

/**
 * Why a password sign-in failed, as a code the sign-in form turns into a sentence.
 *
 * NextAuth v5 passes only CredentialsSignin errors to the browser, and only their
 * `code`. A plain `throw new Error('Incorrect password…')` reached the form as
 * "Configuration", which is what every failed sign-in showed until 2026-10-04.
 */
class SignInFailure extends CredentialsSignin {
  constructor(code: 'missing' | 'no_account' | 'use_google' | 'use_github' | 'use_social' | 'use_sso' | 'wrong_password' | 'unverified') {
    super();
    this.code = code;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new SignInFailure('missing');
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Find user by email
        const user = findUserByEmail(email);

        if (!user) {
          throw new SignInFailure('no_account');
        }

        // An organisation that signs in through its own identity provider (lib/sso.ts).
        if (ssoRequiredFor(email, user.id)) {
          throw new SignInFailure('use_sso');
        }

        // Check if user has a password (not OAuth-only account)
        if (!user.password_hash) {
          if (user.oauth_provider === 'google') throw new SignInFailure('use_google');
          if (user.oauth_provider === 'github') throw new SignInFailure('use_github');
          throw new SignInFailure('use_social');
        }

        // Verify password
        const isValid = await verifyPassword(password, user.password_hash);

        if (!isValid) {
          throw new SignInFailure('wrong_password');
        }

        // Password sign-ups since 2026-10-04 confirm their email first. Older accounts
        // (verification_required = 0) are not locked out: they signed up when confirming
        // was optional, and some cannot receive our mail at all.
        if (user.verification_required && !user.email_verified) {
          throw new SignInFailure('unverified');
        }

        // Update last login
        updateUserLastLogin(user.id);

        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          image: user.avatar_url,
        };
      },
    }),

    /**
     * Enterprise SSO hand-off.
     *
     * This provider takes NO user-supplied identity — only an opaque ticket that
     * /api/sso/callback/* minted after it had already verified a signed OIDC id
     * token or SAML assertion. The ticket is single-use and expires in two
     * minutes, and `consumeTicket` marks it used in the same statement that
     * requires it to be unused, so two redemptions cannot race.
     *
     * It exists because NextAuth builds its provider list once at module load,
     * which makes a per-organisation identity provider impossible to express
     * there. Doing the IdP conversation in route handlers and redeeming the
     * result here keeps session issuance in exactly one place.
     */
    Credentials({
      id: 'sso-ticket',
      name: 'Single sign-on',
      credentials: { ticket: { label: 'Ticket', type: 'text' } },
      async authorize(credentials) {
        const ticket = String((credentials as any)?.ticket ?? '');
        if (!ticket) return null;

        const userId = consumeTicket(ticket);
        if (!userId) {
          throw new Error('That sign-in link has expired. Please start again.');
        }

        const user = findUserById(userId);
        if (!user) return null;

        updateUserLastLogin(user.id);
        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          image: user.avatar_url,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        console.log('[AUTH] signIn callback started', {
          provider: account?.provider,
          email: user.email,
          hasAccount: !!account
        });

        // Handle OAuth sign-in (Google/GitHub)
        if (account?.provider === 'google' || account?.provider === 'github') {
          const email = user.email!;
          const provider = account.provider;

          console.log('[AUTH] Processing OAuth sign-in', { email, provider });

          // Check if user exists with this email
          let dbUser = findUserByEmail(email);
          console.log('[AUTH] User lookup result:', { found: !!dbUser, email });

          // Addresses whose organisation requires single sign-on go through it (lib/sso.ts).
          if (ssoRequiredFor(email, dbUser?.id ?? null)) {
            return '/auth/signin?sso=required';
          }

          if (!dbUser) {
            console.log('[AUTH] Creating new user with OAuth');
            // Create new user with OAuth
            dbUser = createUserWithOAuth(
              email,
              provider,
              account.providerAccountId,
              user.name || undefined,
              user.image || undefined
            );
            console.log('[AUTH] User created successfully', { userId: dbUser.id });
            // Welcome mail for Google and GitHub sign-ups too. No confirmation link: the
            // provider has already verified the address. Fire-and-forget, like the
            // password sign-up's: a mail failure must never block a sign-in.
            void sendWelcomeEmail(email, user.name ?? null, null).catch(() => {});
          } else {
            console.log('[AUTH] Updating existing user last login', { userId: dbUser.id });
            // Update last login for existing user
            updateUserLastLogin(dbUser.id);
            // Google or GitHub just vouched for this address, so an unconfirmed password
            // account with the same email is confirmed now.
            if (!dbUser.email_verified) verifyUserEmail(dbUser.id);
            console.log('[AUTH] Last login updated');
          }

          // Store database user ID in the user object
          user.id = dbUser.id.toString();
          console.log('[AUTH] User ID stored in session', { userId: user.id });
        }

        console.log('[AUTH] signIn callback completed successfully');
        return true;
      } catch (error) {
        console.error('[AUTH] signIn callback ERROR:', error);
        console.error('[AUTH] Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        // Return false to prevent sign-in
        return false;
      }
    },
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
        
        // Fetch subscription status from database
        try {
          const user = findUserByEmail(session.user.email!);
          if (user) {
            // Resolve the plan once, here, and hand the whole entitlement object
            // to the client. Every downstream check should read `entitlements`
            // rather than re-deriving access from a tier string — that habit is
            // what let the FAQ and the dashboard disagree for months.
            // Own subscription, raised to the plan of any workspace this account
            // edits (lib/workspace-plan.ts) — a Teams editor gets Teams.
            const subject = withWorkspace(user.id, user) as any;
            const plan = planFor(subject);
            const entitlements = entitlementsFor(subject);

            // `subscriptionStatus` is kept for the call sites that still test
            // for 'active' | 'trialing'. It is a derived flag, NOT the dead
            // `subscription_status` column (which reads 'trial' for everyone,
            // including active payers).
            const hasProAccess = hasActiveSubscription(subject);
            (session.user as any).subscriptionStatus = hasProAccess ? 'active' : 'inactive';
            (session.user as any).subscriptionId = user.stripe_subscription_id;
            (session.user as any).subscriptionTier = user.subscription_tier;
            (session.user as any).plan = plan;
            (session.user as any).entitlements = entitlements;
            // Needed by settings: bulk mail (digest, alerts) is only sent to
            // verified addresses, so the UI has to be able to say so and offer
            // to re-send the verification.
            (session.user as any).emailVerified = user.email_verified === 1;
            (session.user as any).role = user.role || 'user';
            (session.user as any).forumUsername = user.forum_username || null;
          }
        } catch (error) {
          console.error('[AUTH] Error fetching subscription status:', error);
        }
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.sub = user.id;
        return token;
      }
      // A deleted account's session ends on its next request, not when the 30-day token
      // expires: returning null makes NextAuth clear the cookie. The email check covers an
      // account deleted and then re-registered with the same address — the old token names
      // the old id. (Ids are AUTOINCREMENT, so they are never reused.)
      if (token.sub) {
        const id = Number(token.sub);
        const current = Number.isInteger(id) ? findUserById(id) : null;
        if (!current) return null;
        if (token.email && current.email.toLowerCase() !== String(token.email).toLowerCase()) return null;
      }
      return token;
    },
  },
});
