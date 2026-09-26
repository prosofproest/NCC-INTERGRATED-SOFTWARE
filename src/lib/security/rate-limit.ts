interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory sliding window cache
const memoryStore = new Map<string, RateLimitRecord>();

// Periodic cleanup of stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryStore.entries()) {
      if (record.resetAt <= now) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref();
}

export interface RateLimitOptions {
  maxRequests: number; // Maximum allowed requests in window
  windowMs: number; // Time window in milliseconds
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
}

/**
 * Standard security rate-limit profiles
 */
export const RateLimitProfiles = {
  LOGIN: { maxRequests: 5, windowMs: 60 * 1000 }, // 5 attempts per minute
  OTP_SEND: { maxRequests: 1, windowMs: 60 * 1000 }, // 1 request per 60s
  OTP_VERIFY: { maxRequests: 5, windowMs: 10 * 60 * 1000 }, // 5 attempts per 10m
  FORGOT_PASSWORD: { maxRequests: 3, windowMs: 15 * 60 * 1000 }, // 3 requests per 15m
  GENERAL_API: { maxRequests: 60, windowMs: 60 * 1000 }, // 60 requests per minute
} as const;

/**
 * Extracts client IP address from standard proxy and forwarded headers.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

/**
 * Evaluates rate limiting for an identifier (e.g., "ip:action" or "email:action").
 */
export async function checkRateLimit(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const now = Date.now();
  let record = memoryStore.get(identifier);

  if (!record || record.resetAt <= now) {
    // New window
    record = {
      count: 1,
      resetAt: now + options.windowMs,
    };
    memoryStore.set(identifier, record);

    return {
      success: true,
      limit: options.maxRequests,
      remaining: options.maxRequests - 1,
      resetAt: record.resetAt,
    };
  }

  // Existing active window
  record.count += 1;

  if (record.count > options.maxRequests) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return {
      success: false,
      limit: options.maxRequests,
      remaining: 0,
      resetAt: record.resetAt,
      retryAfterSeconds,
    };
  }

  return {
    success: true,
    limit: options.maxRequests,
    remaining: options.maxRequests - record.count,
    resetAt: record.resetAt,
  };
}
