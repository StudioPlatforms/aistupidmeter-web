import { auth } from '@/auth';

export interface SubscriptionStatus {
  authenticated: boolean;
  subscribed: boolean;
  userId?: string;
}

/**
 * Check subscription status without forcing authentication
 * Returns subscription info for authenticated users, or indicates anonymous status
 */
export async function checkSubscriptionStatus(): Promise<SubscriptionStatus> {
  try {
    const session = await auth();
    
    if (!session || !session.user) {
      return {
        authenticated: false,
        subscribed: false
      };
    }

    // Check if user has active subscription
    const hasSubscription = (session.user as any).subscriptionStatus === 'active' || 
                           (session.user as any).subscriptionStatus === 'trialing';

    return {
      authenticated: true,
      subscribed: hasSubscription,
      userId: session.user.id
    };
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return {
      authenticated: false,
      subscribed: false
    };
  }
}

/**
 * Client-side hook to check if user has pro access
 * Uses session data without making additional API calls
 */
export function useProAccess() {
  // This will be used on client side with useSession hook
  return {
    checkAccess: (session: any) => {
      if (!session || !session.user) {
        return false;
      }
      return (session.user as any).subscriptionStatus === 'active' || 
             (session.user as any).subscriptionStatus === 'trialing';
    }
  };
}
