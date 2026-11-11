export async function POST(request) {
  const body = await request.json().catch(() => null);
  const companyId = body?.company_id;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  if (!['robo', 'soft'].includes(companyId) || !name || name.length > 100) {
    return Response.json({ error: 'Select a company and enter your name.' }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return Response.json({ error: 'Queue service is not configured.' }, { status: 503 });
  }

  try {
    const response = await fetch(new URL('/rest/v1/entries?select=ticket', url), {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ company_id: companyId, name })
    });

    if (!response.ok) {
      console.error('Queue insert failed', response.status);
      throw new Error('Queue insert failed');
    }

    const [entry] = await response.json();
    if (entry?.ticket == null) throw new Error('Missing ticket');

    return Response.json({ ticket: entry.ticket }, { status: 201 });
  } catch {
    return Response.json({ error: 'Could not confirm your queue number.' }, { status: 502 });
  }
}
