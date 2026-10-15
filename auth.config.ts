import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
    newUser: '/router', // Redirect new OAuth users here
  },
  trustHost: true,
  experimental: {
    enableWebAuthn: false,
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Where the person was going, when that is on this site (a path, or a URL on this origin):
      // "See the leaderboard" → sign in → the leaderboard. Anything else goes to the router, as
      // before; another origin is never followed.
      let result = `${baseUrl}/router`;
      if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) {
        result = `${baseUrl}${url}`;
      } else {
        try {
          if (new URL(url).origin === new URL(baseUrl).origin) result = url;
        } catch {
          /* not a URL: keep the default */
        }
      }
      console.log('[AUTH CONFIG] redirect callback', { url, baseUrl, result });
      return result;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
