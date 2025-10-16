/**
 * Retry utility with exponential backoff
 * Provides professional error handling for API calls
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: any) => void;
}

/**
 * Executes a function with automatic retry and exponential backoff
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns Promise with the function result
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 5,
    initialDelay = 2000,
    maxDelay = 32000,
    onRetry
  } = options;

  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
      
      // Notify about retry
      if (onRetry) {
        onRetry(attempt, error);
      }
      
      console.log(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms...`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Check if data is valid and not empty
 */
export function isValidData(data: any): boolean {
  if (!data) return false;
  if (Array.isArray(data) && data.length === 0) return false;
  if (typeof data === 'object' && Object.keys(data).length === 0) return false;
  return true;
}
