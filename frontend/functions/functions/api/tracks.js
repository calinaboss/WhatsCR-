import { Client } from '@neondatabase/serverless';

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

  const client = new Client(env.DATABASE_URL);

  try {
    await client.connect();

    let sql = 'SELECT * FROM tracks';
    const params = [];

    if (query) {
      params.push(`%${query}%`);
      sql += ` WHERE (title ILIKE $${params.length} OR artist ILIKE $${params.length} OR genre ILIKE $${params.length})`;
    } else if (genre && genre !== 'All' && genre !== 'Popular') {
      params.push(`%${genre}%`);
      sql += ` WHERE genre ILIKE $${params.length}`;
    }

    sql += ' ORDER BY id DESC LIMIT 50';

    const result = await client.query(sql, params);

    return new Response(JSON.stringify(result.rows), {
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
  } finally {
    context.waitUntil(client.end());
  }
}
