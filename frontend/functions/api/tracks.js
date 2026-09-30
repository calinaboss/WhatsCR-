export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim();
  const genre = (url.searchParams.get('genre') || '').trim();

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'DATABASE_URL not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    let sql = 'SELECT * FROM tracks';
    const params = [];
    const conditions = [];

    if (query) {
      const clean = query.slice(0, 100).toLowerCase();
      params.push(`%${clean}%`);
      conditions.push(`(LOWER(title) LIKE $${params.length} OR LOWER(artist) LIKE $${params.length} OR LOWER(genre) LIKE $${params.length})`);
    }

    if (genre && genre !== 'All' && genre !== 'Popular') {
      params.push(`%${genre.toLowerCase()}%`);
      conditions.push(`LOWER(genre) LIKE $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY id DESC LIMIT 50';

    const dbUrl = new URL(env.DATABASE_URL);
    const endpoint = `https://${dbUrl.host}/sql`;

    const neonRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Neon-Connection-String': env.DATABASE_URL
      },
      body: JSON.stringify({
        query: sql,
        params: params
      })
    });

    if (!neonRes.ok) {
      return new Response(JSON.stringify({ error: 'Database request failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await neonRes.json();
    let rows = [];
    if (data && Array.isArray(data.rows)) {
      rows = data.rows;
    } else if (Array.isArray(data) && data[0] && Array.isArray(data[0].rows)) {
      rows = data[0].rows;
    }

    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
