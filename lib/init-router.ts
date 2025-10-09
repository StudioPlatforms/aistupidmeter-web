/**
 * Router Initialization
 * Sets up the API client with user context
 */

import { apiClient } from './api-client';
import { auth } from '@/auth';

/**
 * Initialize the router API client with authenticated user
 * This should be called in server components or API routes
 */
export async function initializeRouter() {
  const session = await auth();
  
  if (session?.user?.id) {
    apiClient.setUserId(session.user.id);
    console.log('🔧 Router initialized with authenticated user ID:', session.user.id);
  } else {
    // Fallback for unauthenticated requests (shouldn't happen due to middleware)
    console.warn('⚠️ Router initialized without authentication');
  }
}

/**
 * Initialize router with explicit user ID (for client-side)
 * Use this in client components where session is already available
 */
export function initializeRouterWithUserId(userId: string) {
  apiClient.setUserId(userId);
  console.log('🔧 Router initialized with user ID:', userId);
}

/**
 * Check if the router is properly configured
 */
export function isRouterConfigured(): boolean {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  
  if (!apiUrl) {
    console.warn('⚠️ NEXT_PUBLIC_API_URL is not set. Using default: http://localhost:4000');
    return false;
  }
  
  return true;
}

/**
 * Get router configuration status
 */
export function getRouterConfig() {
  return {
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    environment: process.env.NODE_ENV || 'development',
    configured: isRouterConfigured(),
  };
}
