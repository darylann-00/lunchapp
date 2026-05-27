import { requireAuth } from './_auth.js';
import { checkRateLimit } from './_ratelimit.js';

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const limited = await checkRateLimit(auth.userId, 20);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const raw = await request.json() as Record<string, unknown>;
  const sanitized = {
    ...raw,
    model: 'claude-sonnet-4-6',
    max_tokens: typeof raw.max_tokens === 'number' ? Math.min(raw.max_tokens, 16384) : 4096,
  };

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify(sanitized),
  });

  const data = await upstream.text();
  if (!upstream.ok) {
    console.error(`Anthropic API error ${upstream.status}:`, data);
  }
  return new Response(data, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
