export async function POST(request) {
  const body = await request.json().catch(() => null);
  const companyId = body?.company_id;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim() : '';

  if (!['robo', 'soft'].includes(companyId) || !name || name.length > 100) {
    return Response.json(
      { error: 'Select a company and enter your name.' },
      { status: 400 }
    );
  }

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json(
      { error: 'Enter a valid email address.' },
      { status: 400 }
    );
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return Response.json(
      { error: 'Queue service is not configured.' },
      { status: 503 }
    );
  }

  try {
    const headers = {
      apikey: key,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    };

    if (key.startsWith('eyJ')) {
      headers.Authorization = `Bearer ${key}`;
    }

    const response = await fetch(new URL('/rest/v1/entries?select=ticket', url), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        company_id: companyId,
        name,
        email
      })
    });

    if (!response.ok) {
      console.error('Queue insert failed', response.status);
      throw new Error('Queue insert failed');
    }

    const [entry] = await response.json();

    if (entry?.ticket == null) {
      throw new Error('Missing ticket');
    }

    return Response.json({ ticket: entry.ticket }, { status: 201 });
  } catch (error) {
    console.error('Queue registration failed', error.message);
    return Response.json(
      { error: 'Could not confirm your queue number.' },
      { status: 502 }
    );
  }
}
