import { NextRequest, NextResponse } from 'next/server';
import { checkSubscription } from '@/lib/db-client';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    const subscriptionStatus = checkSubscription(email);
    
    return NextResponse.json({
      success: true,
      data: subscriptionStatus
    });
  } catch (error) {
    console.error('[Subscription Check] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check subscription status' },
      { status: 500 }
    );
  }
}
