export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const genre = url.searchParams.get('genre');

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'DATABASE_URL not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    let sql = 'SELECT * FROM tracks';
    const params = [];

    if (query) {
      const cleanQuery = query.slice(0, 100);
      params.push(`%${cleanQuery}%`);
      sql += ` WHERE (title ILIKE $${params.length} OR artist ILIKE $${params.length} OR genre ILIKE $${params.length})`;
    } else if (genre && genre !== 'All' && genre !== 'Popular') {
      params.push(`%${genre}%`);
      sql += ` WHERE genre ILIKE $${params.length}`;
    }

    sql += ' ORDER BY id DESC LIMIT 50';

    const dbUrl = new URL(env.DATABASE_URL);
    const host = dbUrl.host;
    const endpoint = `https://${host}/sql`;

    const neonRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dbUrl.password}`
      },
      body: JSON.stringify({
        query: sql,
        params: params
      })
    });

    if (!neonRes.ok) {
      const errText = await neonRes.text();
      return new Response(JSON.stringify({ error: errText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await neonRes.json();
    const rows = (data && data.rows) ? data.rows : (Array.isArray(data) && data[0] && data[0].rows ? data[0].rows : []);

    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
