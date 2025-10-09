import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { 
  findUserByEmail, 
  createUserWithPassword,
  createUserWithOAuth,
  updateUserLastLogin,
  hasActiveSubscription
} from './lib/db-client';
import { verifyPassword } from './lib/password';

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
          throw new Error('Email and password are required');
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Find user by email
        const user = findUserByEmail(email);

        if (!user) {
          throw new Error('Invalid email or password');
        }

        // Check if user has a password (not OAuth-only account)
        if (!user.password_hash) {
          throw new Error('This account uses social login. Please sign in with Google or GitHub.');
        }

        // Verify password
        const isValid = await verifyPassword(password, user.password_hash);

        if (!isValid) {
          throw new Error('Invalid email or password');
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
          } else {
            console.log('[AUTH] Updating existing user last login', { userId: dbUser.id });
            // Update last login for existing user
            updateUserLastLogin(dbUser.id);
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
            // Use hasActiveSubscription to determine if user has pro access
            const hasProAccess = hasActiveSubscription(user);
            (session.user as any).subscriptionStatus = hasProAccess ? 'active' : 'inactive';
            (session.user as any).subscriptionId = user.stripe_subscription_id;
            (session.user as any).subscriptionTier = user.subscription_tier;
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
      }
      return token;
    },
  },
});
