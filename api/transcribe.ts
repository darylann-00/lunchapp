import { requireAuth } from './_auth';

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const formData = await request.formData();
  const audio = formData.get('audio');

  if (!audio || !(audio instanceof Blob)) {
    return Response.json({ error: 'Missing audio field' }, { status: 400 });
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
