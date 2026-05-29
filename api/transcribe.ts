import { requireAuth } from './_auth.js';
import { checkRateLimit } from './_ratelimit.js';

// A weekly voice note is a few seconds; 15MB is generous headroom while still
// blocking large uploads that would balloon input-token cost (audio is sent to
// the model as a base64 document).
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const limited = await checkRateLimit(auth.userId, 10);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const formData = await request.formData();
  const audio = formData.get('audio');

  if (!audio || !(audio instanceof Blob)) {
    return Response.json({ error: 'Missing audio field' }, { status: 400 });
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: 'Audio too large' }, { status: 413 });
  }

  const arrayBuffer = await audio.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  const ALLOWED_MEDIA_TYPES = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'] as const;
  type AllowedMediaType = typeof ALLOWED_MEDIA_TYPES[number];
  const rawType = audio.type || 'audio/webm';
  if (!(ALLOWED_MEDIA_TYPES as readonly string[]).includes(rawType)) {
    return Response.json({ error: `Unsupported audio type: ${rawType}` }, { status: 400 });
  }
  const mediaType = rawType as AllowedMediaType;

  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: 'text',
            text: 'Transcribe this audio verbatim. Output only the transcript, no preamble.',
          },
        ],
      },
    ],
  });

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body,
  });

  if (!upstream.ok) {
    return Response.json({ error: `Upstream error ${upstream.status}` }, { status: 502 });
  }

  const data = await upstream.json() as { content: { type: string; text: string }[] };
  const transcript = data.content.find((c) => c.type === 'text')?.text ?? '';
  return Response.json({ transcript });
}
