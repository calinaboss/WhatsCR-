const rateLimitCache = new Map();

function isValidAudioUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) {
    return false;
  }
  return trimmed.startsWith('/api/audio/') || trimmed.startsWith('audio/') || trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const ip = request.headers.get('CF-Connecting-IP') || 'anonymous';
  const now = Date.now();
  const windowMs = 60000;
  const maxRequests = 60;

  const current = rateLimitCache.get(ip) || { count: 0, resetTime: now + windowMs };
  if (now > current.resetTime) {
    current.count = 1;
    current.resetTime = now + windowMs;
  } else {
    current.count++;
  }
  rateLimitCache.set(ip, current);

  if (rateLimitCache.size > 2000) {
    for (const [key, val] of rateLimitCache.entries()) {
      if (now > val.resetTime) rateLimitCache.delete(key);
    }
  }

  if (current.count > maxRequests) {
    return new Response(JSON.stringify({ error: 'Too many requests, please slow down' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60'
      }
    });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim();
  const genre = (url.searchParams.get('genre') || '').trim();
  const artist = (url.searchParams.get('artist') || '').trim();

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

    conditions.push("(status = 'approved' OR status IS NULL)");

    if (query) {
      const clean = query.slice(0, 100).toLowerCase();
      params.push(`%${clean}%`);
      conditions.push(`(LOWER(title) LIKE $${params.length} OR LOWER(artist) LIKE $${params.length} OR LOWER(genre) LIKE $${params.length})`);
    }

    if (artist) {
      const cleanArtist = artist.slice(0, 100).toLowerCase();
      params.push(`%${cleanArtist}%`);
      conditions.push(`LOWER(artist) LIKE $${params.length}`);
    }

    if (genre && genre !== 'All' && genre !== 'Popular') {
      const cleanGenre = genre.slice(0, 50).toLowerCase();
      if (cleanGenre.includes('sound') || cleanGenre.includes('sfx') || cleanGenre.includes('effect')) {
        params.push('%sound%', '%sfx%', '%effect%');
        const p1 = params.length - 2;
        const p2 = params.length - 1;
        const p3 = params.length;
        conditions.push(`(LOWER(genre) LIKE $${p1} OR LOWER(genre) LIKE $${p2} OR LOWER(genre) LIKE $${p3})`);
      } else if (cleanGenre.includes('chip') || cleanGenre.includes('8-bit') || cleanGenre.includes('8bit')) {
        params.push('%chip%', '%8-bit%', '%8bit%');
        const p1 = params.length - 2;
        const p2 = params.length - 1;
        const p3 = params.length;
        conditions.push(`(LOWER(genre) LIKE $${p1} OR LOWER(genre) LIKE $${p2} OR LOWER(genre) LIKE $${p3})`);
      } else if (cleanGenre.includes('game') || cleanGenre.includes('gaming') || cleanGenre.includes('combat')) {
        params.push('%game%', '%gaming%', '%combat%');
        const p1 = params.length - 2;
        const p2 = params.length - 1;
        const p3 = params.length;
        conditions.push(`(LOWER(genre) LIKE $${p1} OR LOWER(genre) LIKE $${p2} OR LOWER(genre) LIKE $${p3})`);
      } else if (cleanGenre.includes('lo-fi') || cleanGenre.includes('lofi') || cleanGenre.includes('chill')) {
        params.push('%lo-fi%', '%lofi%', '%chill%');
        const p1 = params.length - 2;
        const p2 = params.length - 1;
        const p3 = params.length;
        conditions.push(`(LOWER(genre) LIKE $${p1} OR LOWER(genre) LIKE $${p2} OR LOWER(genre) LIKE $${p3})`);
      } else if (cleanGenre.includes('cine') || cleanGenre.includes('epic') || cleanGenre.includes('orchestral')) {
        params.push('%cine%', '%epic%', '%orchestral%');
        const p1 = params.length - 2;
        const p2 = params.length - 1;
        const p3 = params.length;
        conditions.push(`(LOWER(genre) LIKE $${p1} OR LOWER(genre) LIKE $${p2} OR LOWER(genre) LIKE $${p3})`);
      } else if (cleanGenre.includes('synth') || cleanGenre.includes('sci-fi') || cleanGenre.includes('scifi')) {
        params.push('%synth%', '%sci-fi%', '%scifi%');
        const p1 = params.length - 2;
        const p2 = params.length - 1;
        const p3 = params.length;
        conditions.push(`(LOWER(genre) LIKE $${p1} OR LOWER(genre) LIKE $${p2} OR LOWER(genre) LIKE $${p3})`);
      } else {
        params.push(`%${cleanGenre}%`);
        conditions.push(`LOWER(genre) LIKE $${params.length}`);
      }
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY id DESC LIMIT 50';

    const dbUrl = new URL(env.DATABASE_URL);
    const endpoint = `https://${dbUrl.host}/sql`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const neonRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Neon-Connection-String': env.DATABASE_URL
      },
      body: JSON.stringify({
        query: sql,
        params: params
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

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

    const sanitizedRows = rows.map(r => {
      const audioUrl = isValidAudioUrl(r.audio_url) ? r.audio_url : '#';
      return {
        ...r,
        audio_url: audioUrl
      };
    });

    return new Response(JSON.stringify(sanitizedRows), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=60',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
