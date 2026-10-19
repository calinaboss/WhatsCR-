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

async function authenticateAdmin(request, env) {
  if (!env.DATABASE_URL) return null;
  const cookies = parseCookies(request.headers.get('Cookie'));
  const token = cookies.whatscr_session;
  if (!token) return null;

  try {
    const tokenHash = await sha256Hex(token);
    const rows = await runNeonSql(
      env.DATABASE_URL,
      'SELECT u.id, u.email, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1',
      [tokenHash]
    );
    if (!rows || rows.length === 0) return null;
    const user = rows[0];
    if (user.role !== 'admin') return null;
    return user;
  } catch (e) {
    return null;
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const adminUser = await authenticateAdmin(request, env);
  if (!adminUser) {
    return new Response(JSON.stringify({ error: 'Access denied: Administrator privileges required.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (request.method === 'GET' && action === 'pending') {
    try {
      const rows = await runNeonSql(
        env.DATABASE_URL,
        "SELECT id, title, artist, genre, duration, audio_url, is_loop, license_type, user_id, status FROM tracks WHERE status = 'pending' ORDER BY id DESC LIMIT 100"
      );
      return new Response(JSON.stringify({ tracks: rows }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to fetch pending tracks' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'GET' && action === 'all') {
    try {
      const rows = await runNeonSql(
        env.DATABASE_URL,
        "SELECT id, title, artist, genre, duration, audio_url, is_loop, license_type, user_id, status, COALESCE(likes_count, 0) as likes_count FROM tracks ORDER BY id DESC LIMIT 200"
      );
      return new Response(JSON.stringify({ tracks: rows }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to fetch tracks' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'POST' && action === 'approve') {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const trackId = parseInt(body.id, 10);
    if (!trackId || isNaN(trackId) || trackId <= 0) {
      return new Response(JSON.stringify({ error: 'Valid track ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const updated = await runNeonSql(
        env.DATABASE_URL,
        "UPDATE tracks SET status = 'approved' WHERE id = $1 RETURNING id, title, status",
        [trackId]
      );
      if (!updated || updated.length === 0) {
        return new Response(JSON.stringify({ error: 'Track not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ success: true, track: updated[0] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Database update failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'POST' && (action === 'delete' || action === 'reject')) {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const trackId = parseInt(body.id, 10);
    if (!trackId || isNaN(trackId) || trackId <= 0) {
      return new Response(JSON.stringify({ error: 'Valid track ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const existing = await runNeonSql(
        env.DATABASE_URL,
        'SELECT id, audio_url FROM tracks WHERE id = $1 LIMIT 1',
        [trackId]
      );

      if (!existing || existing.length === 0) {
        return new Response(JSON.stringify({ error: 'Track not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const track = existing[0];
      if (track.audio_url && track.audio_url.includes('/api/audio/')) {
        const parts = track.audio_url.split('/');
        const filename = parts[parts.length - 1];
        if (filename && filename.endsWith('.mp3')) {
          if (env.AUDIO_BUCKET) {
            try {
              await env.AUDIO_BUCKET.delete(filename);
            } catch (r2Err) {}
          }
          try {
            await runNeonSql(env.DATABASE_URL, 'DELETE FROM audio_files WHERE filename = $1', [filename]);
          } catch (dbAudioErr) {}
        }
      }

      await runNeonSql(env.DATABASE_URL, 'DELETE FROM tracks WHERE id = $1', [trackId]);

      return new Response(JSON.stringify({ success: true, message: 'Track deleted successfully.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to delete track' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Action not supported' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  });
}
