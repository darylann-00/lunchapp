import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? '',
  token: process.env.KV_REST_API_TOKEN ?? '',
});

const cache = new Map<number, Ratelimit>();

function getRatelimit(maxPerMinute: number): Ratelimit {
  let rl = cache.get(maxPerMinute);
  if (!rl) {
    rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxPerMinute, '1 m'),
    });
    cache.set(maxPerMinute, rl);
  }
  return rl;
}

export async function checkRateLimit(
  userId: string,
  maxPerMinute: number,
): Promise<Response | null> {
  const { success, reset } = await getRatelimit(maxPerMinute).limit(userId);
  if (success) return null;
  const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
  return new Response('Too Many Requests', {
    status: 429,
    headers: { 'Retry-After': String(retryAfter) },
  });
}
