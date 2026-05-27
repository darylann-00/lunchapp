type AuthOk = { ok: true; userId: string; token: string };
type AuthErr = { ok: false; response: Response };

export async function requireAuth(request: Request): Promise<AuthOk | AuthErr> {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^bearer\s+/i, '');

  if (!token) {
    return { ok: false, response: new Response('Unauthorized', { status: 401 }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, response: new Response('Server misconfigured', { status: 500 }) };
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return { ok: false, response: new Response('Unauthorized', { status: 401 }) };
    }

    const data = await res.json() as { id: string };
    return { ok: true, userId: data.id, token };
  } catch {
    return { ok: false, response: new Response('Unauthorized', { status: 401 }) };
  }
}
