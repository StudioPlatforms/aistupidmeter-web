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
      console.log('[AUTH CONFIG] redirect callback', { url, baseUrl });
      const result = `${baseUrl}/router`;
      console.log('[AUTH CONFIG] redirecting to', result);
      return result;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
