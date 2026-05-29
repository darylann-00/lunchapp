import { requireAuth } from './_auth.js';
import { checkRateLimit } from './_ratelimit.js';

// Cap the request body. The largest legitimate call (candidate-pool plan
// selection / grocery list) is well under ~50KB; this stops an authenticated
// user from running up input-token cost with pathological payloads. max_tokens
// only caps output, so without this the input side was unbounded.
const MAX_BODY_BYTES = 128 * 1024;
const MAX_MESSAGES = 50;

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const limited = await checkRateLimit(auth.userId, 20);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const bodyText = await request.text();
  if (Buffer.byteLength(bodyText, 'utf8') > MAX_BODY_BYTES) {
    return Response.json({ error: 'Request body too large' }, { status: 413 });
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(raw.messages) || raw.messages.length === 0 || raw.messages.length > MAX_MESSAGES) {
    return Response.json({ error: 'Invalid messages' }, { status: 400 });
  }
  if (raw.system !== undefined && typeof raw.system !== 'string' && !Array.isArray(raw.system)) {
    return Response.json({ error: 'Invalid system prompt' }, { status: 400 });
  }

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
