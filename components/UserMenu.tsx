import { auth, signOut } from '@/auth';
import Image from 'next/image';
import Link from 'next/link';

export async function UserMenu() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  return (
    <div className="flex items-center space-x-4">
      <Link href="/router/profile" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
        {session.user.image && (
          <Image
            src={session.user.image}
            alt={session.user.name || 'User'}
            width={32}
            height={32}
            className="rounded-full border-2 border-gray-200"
          />
        )}
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">
            {session.user.name}
          </span>
          <span className="text-xs text-gray-500">{session.user.email}</span>
        </div>
      </Link>
      
      <div className="flex items-center space-x-2">
        <Link
          href="/router/subscription"
          className="text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-1 rounded hover:bg-gray-100 transition-colors"
        >
          💳 Subscription
        </Link>
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/auth/signin' });
          }}
        >
          <button
            type="submit"
            className="text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-1 rounded hover:bg-gray-100 transition-colors"
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
