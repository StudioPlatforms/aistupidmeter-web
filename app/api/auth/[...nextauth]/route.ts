import { handlers } from '../../../../auth';

export const { GET, POST } = handlers;

// Ensure the auth route runs server-side and avoids static optimization/caching
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
