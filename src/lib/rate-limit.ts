import { kv } from "@vercel/kv";

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

const MINUTE_LIMIT = 1000;
const HOUR_LIMIT = 10000;

/**
 * Check rate limit for a given key using fixed-window counters on Vercel KV.
 * Fails open: if KV is unavailable, the request is allowed through.
 */
export async function checkRateLimit(
  key: string
): Promise<RateLimitResult> {
  try {
    const now = Date.now();
    const minuteWindow = Math.floor(now / 60000);
    const hourWindow = Math.floor(now / 3600000);

    const minuteKey = `rl:${key}:m:${minuteWindow}`;
    const hourKey = `rl:${key}:h:${hourWindow}`;

    const pipe = kv.pipeline();
    pipe.incr(minuteKey);
    pipe.expire(minuteKey, 120);
    pipe.incr(hourKey);
    pipe.expire(hourKey, 7200);
    const results = await pipe.exec();

    const minuteCount = results[0] as number;
    const hourCount = results[2] as number;

    if (minuteCount > MINUTE_LIMIT) {
      const retryAfter = 60 - Math.floor((now % 60000) / 1000);
      return { allowed: false, retryAfter };
    }

    if (hourCount > HOUR_LIMIT) {
      const retryAfter = 3600 - Math.floor((now % 3600000) / 1000);
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  } catch {
    console.warn(
      `[rate-limit] KV unavailable for key="${key}", allowing request`
    );
    return { allowed: true };
  }
}
