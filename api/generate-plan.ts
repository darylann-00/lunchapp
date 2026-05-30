// Server-side plan generation endpoint.
// Runs the full 3-stage orchestration (candidate retrieval → AI selection →
// gap filling) on the server so the browser makes ONE request instead of
// ~5-15 sequential proxy round-trips.

import { createClient } from '@supabase/supabase-js';
import { requireAuth } from './_auth.js';
import { checkRateLimit } from './_ratelimit.js';
import { orchestrateWeeklyPlan } from '../src/lib/planEngine.js';
import type { CallModel } from '../src/lib/planEngine.js';
import type { Kid, ParentPrefs, ParsedSession } from '../src/types.js';

// Plan generation makes 5-15 Anthropic calls internally, so each invocation
// is expensive. Limit to 3 per minute per user (vs 20/min for the raw proxy).
const MAX_GENERATE_PER_MINUTE = 3;

// Cap the request body. Kid profile + parent prefs + session is well under 10KB.
const MAX_BODY_BYTES = 32 * 1024;

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const limited = await checkRateLimit(`generate-plan:${auth.userId}`, MAX_GENERATE_PER_MINUTE);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!apiKey || !supabaseUrl || !supabaseAnonKey) {
    return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  // ── Parse & validate request body ──────────────────────────────────────────

  const bodyText = await request.text();
  if (Buffer.byteLength(bodyText, 'utf8') > MAX_BODY_BYTES) {
    return Response.json({ error: 'Request body too large' }, { status: 413 });
  }

  let body: { session: ParsedSession; kid: Kid; parentPrefs: ParentPrefs };
  try {
    body = JSON.parse(bodyText) as typeof body;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (
    !body.session || !Array.isArray(body.session.daysNeeded) || body.session.daysNeeded.length === 0 ||
    !body.kid || typeof body.kid.id !== 'string' ||
    !body.parentPrefs
  ) {
    return Response.json({ error: 'Missing or invalid required fields: session, kid, parentPrefs' }, { status: 400 });
  }

  // ── Build server-side dependencies ─────────────────────────────────────────

  // User-scoped Supabase client — RLS uses the caller's JWT.
  const db = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${auth.token}` } },
  });

  // Direct Anthropic transport — calls the API without a proxy hop.
  const callModel: CallModel = async (reqBody: object): Promise<string> => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(reqBody),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Anthropic API error ${res.status}:`, errText);
      throw new Error(`Anthropic API error ${res.status}`);
    }
    const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
    return data.content.find((c) => c.type === 'text')?.text ?? '';
  };

  // ── Run orchestration ──────────────────────────────────────────────────────

  try {
    const result = await orchestrateWeeklyPlan(
      callModel,
      db,
      auth.userId,
      body.session,
      body.kid,
      body.parentPrefs,
    );
    return Response.json(result);
  } catch (err) {
    console.error('Plan generation failed:', err);
    const message = err instanceof Error ? err.message : 'Generation failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
