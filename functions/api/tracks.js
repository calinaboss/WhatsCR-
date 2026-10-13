const rateLimitCache = new Map();

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function runNeonSql(databaseUrl, sql, params = []) {
  const dbUrl = new URL(databaseUrl);
  const endpoint = `https://${dbUrl.host}/sql`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Neon-Connection-String': databaseUrl
    },
    body: JSON.stringify({ query: sql, params }),
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!res.ok) {
    throw new Error('Database query failed');
  }

  const data = await res.json();
  if (data && Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data) && data[0] && Array.isArray(data[0].rows)) return data[0].rows;
  return [];
}

let schemaInitialized = false;
async function ensureTrackTables(databaseUrl) {
  if (schemaInitialized) return;
  const statements = [
    "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0",
    "CREATE TABLE IF NOT EXISTS track_likes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, track_id INT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, CONSTRAINT unique_track_like UNIQUE (user_id, track_id))",
    "CREATE INDEX IF NOT EXISTS idx_track_likes_track ON track_likes(track_id)",
    "CREATE INDEX IF NOT EXISTS idx_track_likes_user ON track_likes(user_id)"
  ];
  try {
    for (const stmt of statements) {
      await runNeonSql(databaseUrl, stmt);
    }
    schemaInitialized = true;
  } catch (err) {}
}

function isValidAudioUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) {
    return false;
  }
  return trimmed.startsWith('/api/audio/') || trimmed.startsWith('audio/') || trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

export async function onRequest(context) {
  const { request, env } = context;
  const ip = request.headers.get('CF-Connecting-IP') || 'anonymous';
  const now = Date.now();
  const windowMs = 60000;
  const maxRequests = 100;

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

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'DATABASE_URL not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  await ensureTrackTables(env.DATABASE_URL);

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (request.method === 'POST' && (action === 'like' || action === 'toggle_like')) {
    const cookies = parseCookies(request.headers.get('Cookie'));
    const token = cookies.whatscr_session;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Please log in to like tracks.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let body = {};
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const trackId = parseInt(body.track_id, 10);
    if (!trackId || isNaN(trackId) || trackId <= 0) {
      return new Response(JSON.stringify({ error: 'Valid track ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const tokenHash = await sha256Hex(token);
      const sessionRows = await runNeonSql(
        env.DATABASE_URL,
        'SELECT u.id FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1',
        [tokenHash]
      );
      if (!sessionRows || sessionRows.length === 0) {
        return new Response(JSON.stringify({ error: 'Session expired. Please log in again.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const userId = sessionRows[0].id;

      const trackRows = await runNeonSql(
        env.DATABASE_URL,
        'SELECT id, likes_count FROM tracks WHERE id = $1 LIMIT 1',
        [trackId]
      );
      if (!trackRows || trackRows.length === 0) {
        return new Response(JSON.stringify({ error: 'Track not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const existingLike = await runNeonSql(
        env.DATABASE_URL,
        'SELECT id FROM track_likes WHERE user_id = $1 AND track_id = $2 LIMIT 1',
        [userId, trackId]
      );

      let liked = false;
      let newCount = 0;

      if (existingLike && existingLike.length > 0) {
        await runNeonSql(
          env.DATABASE_URL,
          'DELETE FROM track_likes WHERE user_id = $1 AND track_id = $2',
          [userId, trackId]
        );
        const updated = await runNeonSql(
          env.DATABASE_URL,
          'UPDATE tracks SET likes_count = GREATEST(0, COALESCE(likes_count, 1) - 1) WHERE id = $1 RETURNING likes_count',
          [trackId]
        );
        liked = false;
        newCount = updated && updated[0] ? parseInt(updated[0].likes_count, 10) || 0 : 0;
      } else {
        await runNeonSql(
          env.DATABASE_URL,
          'INSERT INTO track_likes (user_id, track_id) VALUES ($1, $2) ON CONFLICT (user_id, track_id) DO NOTHING',
          [userId, trackId]
        );
        const updated = await runNeonSql(
          env.DATABASE_URL,
          'UPDATE tracks SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = $1 RETURNING likes_count',
          [trackId]
        );
        liked = true;
        newCount = updated && updated[0] ? parseInt(updated[0].likes_count, 10) || 0 : 0;
      }

      return new Response(JSON.stringify({
        success: true,
        liked: liked,
        likes_count: newCount
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to update track like' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'GET') {
    const query = (url.searchParams.get('q') || '').trim();
    const genre = (url.searchParams.get('genre') || '').trim();
    const artist = (url.searchParams.get('artist') || '').trim();

    const cookies = parseCookies(request.headers.get('Cookie'));
    const token = cookies.whatscr_session;
    let currentUserId = null;

    if (token) {
      try {
        const tokenHash = await sha256Hex(token);
        const sessionRows = await runNeonSql(
          env.DATABASE_URL,
          'SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > NOW() LIMIT 1',
          [tokenHash]
        );
        if (sessionRows && sessionRows.length > 0) {
          currentUserId = sessionRows[0].user_id;
        }
      } catch (e) {}
    }

    try {
      const params = [];
      const conditions = [];

      conditions.push("(t.status = 'approved' OR t.status IS NULL)");

      if (query) {
        const clean = query.slice(0, 100).toLowerCase();
        params.push(`%${clean}%`);
        conditions.push(`(LOWER(t.title) LIKE $${params.length} OR LOWER(t.artist) LIKE $${params.length} OR LOWER(t.genre) LIKE $${params.length})`);
      }

      if (artist) {
        const cleanArtist = artist.slice(0, 100).toLowerCase();
        params.push(`%${cleanArtist}%`);
        conditions.push(`LOWER(t.artist) LIKE $${params.length}`);
      }

      if (genre && genre !== 'All' && genre !== 'Popular') {
        const cleanGenre = genre.slice(0, 50).toLowerCase();
        if (cleanGenre.includes('sound') || cleanGenre.includes('sfx') || cleanGenre.includes('effect')) {
          params.push('%sound%', '%sfx%', '%effect%');
          const p1 = params.length - 2;
          const p2 = params.length - 1;
          const p3 = params.length;
          conditions.push(`(LOWER(t.genre) LIKE $${p1} OR LOWER(t.genre) LIKE $${p2} OR LOWER(t.genre) LIKE $${p3})`);
        } else if (cleanGenre.includes('chip') || cleanGenre.includes('8-bit') || cleanGenre.includes('8bit')) {
          params.push('%chip%', '%8-bit%', '%8bit%');
          const p1 = params.length - 2;
          const p2 = params.length - 1;
          const p3 = params.length;
          conditions.push(`(LOWER(t.genre) LIKE $${p1} OR LOWER(t.genre) LIKE $${p2} OR LOWER(t.genre) LIKE $${p3})`);
        } else if (cleanGenre.includes('game') || cleanGenre.includes('gaming') || cleanGenre.includes('combat')) {
          params.push('%game%', '%gaming%', '%combat%');
          const p1 = params.length - 2;
          const p2 = params.length - 1;
          const p3 = params.length;
          conditions.push(`(LOWER(t.genre) LIKE $${p1} OR LOWER(t.genre) LIKE $${p2} OR LOWER(t.genre) LIKE $${p3})`);
        } else if (cleanGenre.includes('lo-fi') || cleanGenre.includes('lofi') || cleanGenre.includes('chill')) {
          params.push('%lo-fi%', '%lofi%', '%chill%');
          const p1 = params.length - 2;
          const p2 = params.length - 1;
          const p3 = params.length;
          conditions.push(`(LOWER(t.genre) LIKE $${p1} OR LOWER(t.genre) LIKE $${p2} OR LOWER(t.genre) LIKE $${p3})`);
        } else if (cleanGenre.includes('cine') || cleanGenre.includes('epic') || cleanGenre.includes('orchestral')) {
          params.push('%cine%', '%epic%', '%orchestral%');
          const p1 = params.length - 2;
          const p2 = params.length - 1;
          const p3 = params.length;
          conditions.push(`(LOWER(t.genre) LIKE $${p1} OR LOWER(t.genre) LIKE $${p2} OR LOWER(t.genre) LIKE $${p3})`);
        } else if (cleanGenre.includes('synth') || cleanGenre.includes('sci-fi') || cleanGenre.includes('scifi')) {
          params.push('%synth%', '%sci-fi%', '%scifi%');
          const p1 = params.length - 2;
          const p2 = params.length - 1;
          const p3 = params.length;
          conditions.push(`(LOWER(t.genre) LIKE $${p1} OR LOWER(t.genre) LIKE $${p2} OR LOWER(t.genre) LIKE $${p3})`);
        } else {
          params.push(`%${cleanGenre}%`);
          conditions.push(`LOWER(t.genre) LIKE $${params.length}`);
        }
      }

      let likeSubquery = 'false AS is_liked';
      if (currentUserId) {
        params.push(currentUserId);
        likeSubquery = `EXISTS(SELECT 1 FROM track_likes tl WHERE tl.track_id = t.id AND tl.user_id = $${params.length}) AS is_liked`;
      }

      let sql = `SELECT t.id, t.title, t.artist, t.genre, t.duration, t.audio_url, t.is_loop, t.license_type, t.user_id, t.status, COALESCE(t.likes_count, 0) AS likes_count, ${likeSubquery} FROM tracks t`;

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY t.id DESC LIMIT 50';

      const rows = await runNeonSql(env.DATABASE_URL, sql, params);

      const sanitizedRows = rows.map(r => {
        const audioUrl = isValidAudioUrl(r.audio_url) ? r.audio_url : '#';
        return {
          ...r,
          audio_url: audioUrl,
          likes_count: parseInt(r.likes_count, 10) || 0,
          is_liked: Boolean(r.is_liked)
        };
      });

      const cacheHeader = currentUserId ? 'private, no-cache' : 'public, max-age=15, stale-while-revalidate=60';

      return new Response(JSON.stringify(sanitizedRows), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': cacheHeader,
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

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestGet(context) {
  return onRequest(context);
}

export async function onRequestPost(context) {
  return onRequest(context);
}
