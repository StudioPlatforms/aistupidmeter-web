// Data validation utilities for API responses

/**
 * Validates that model scores data is actually useful (not empty)
 */
export function isValidModelData(data: any): boolean {
  if (!data) return false;
  
  // Check if modelScores exists and is a non-empty array
  if (data.modelScores && Array.isArray(data.modelScores) && data.modelScores.length > 0) {
    return true;
  }
  
  // For direct array responses
  if (Array.isArray(data) && data.length > 0) {
    return true;
  }
  
  return false;
}

/**
 * Retry helper with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;
      
      if (i < maxRetries) {
        const delay = baseDelay * Math.pow(2, i); // Exponential backoff
        console.log(`⚠️ Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Delay utility
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
