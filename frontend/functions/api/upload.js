const uploadRateLimit = new Map();

function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'anonymous';
}

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

function verifyAudioMagicBytes(buffer) {
  if (!buffer || buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer.slice(0, 4));

  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return true;
  }

  if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) {
    return true;
  }

  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return true;
  }

  if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return true;
  }

  return false;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const ip = getClientIp(request);
  const now = Date.now();
  const userRate = uploadRateLimit.get(ip) || { count: 0, reset: now + 3600000 };
  if (now > userRate.reset) {
    userRate.count = 1;
    userRate.reset = now + 3600000;
  } else {
    userRate.count++;
  }
  uploadRateLimit.set(ip, userRate);

  if (userRate.count > 10) {
    return new Response(JSON.stringify({ error: 'Upload limit exceeded. Max 10 uploads per hour.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'Server database not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const cookies = parseCookies(request.headers.get('Cookie'));
  const sessionToken = cookies.whatscr_session;
  if (!sessionToken) {
    return new Response(JSON.stringify({ error: 'Authentication required. Please log in first.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let user = null;
  try {
    const tokenHash = await sha256Hex(sessionToken);
    const rows = await runNeonSql(
      env.DATABASE_URL,
      'SELECT u.id, u.email, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1',
      [tokenHash]
    );
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session. Please log in again.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    user = rows[0];
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Authentication check failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const file = formData.get('file');
  const title = (formData.get('title') || '').toString().trim().slice(0, 100);
  const artist = (formData.get('artist') || '').toString().trim().slice(0, 80) || user.email.split('@')[0];
  const genre = (formData.get('genre') || 'Soundtrack').toString().trim().slice(0, 50);
  const duration = (formData.get('duration') || '0:00').toString().trim().slice(0, 10);
  const isLoop = formData.get('is_loop') === 'true' || formData.get('is_loop') === 'on';

  if (!title) {
    return new Response(JSON.stringify({ error: 'Title is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!file || typeof file === 'string' || !file.size) {
    return new Response(JSON.stringify({ error: 'Please choose an audio file to upload.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const maxFileSize = 15 * 1024 * 1024;
  if (file.size > maxFileSize) {
    return new Response(JSON.stringify({ error: 'File size exceeds maximum allowed 15 MB.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const buffer = await file.arrayBuffer();
  if (!verifyAudioMagicBytes(buffer)) {
    return new Response(JSON.stringify({ error: 'Invalid audio format. Only genuine MP3, WAV or OGG files are permitted.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const fileId = crypto.randomUUID();
  const safeFilename = `${fileId}.mp3`;
  let audioUrl = `audio/${safeFilename}`;

  if (env.AUDIO_BUCKET) {
    try {
      await env.AUDIO_BUCKET.put(safeFilename, buffer, {
        httpMetadata: {
          contentType: 'audio/mpeg',
          cacheControl: 'public, max-age=31536000'
        }
      });
      audioUrl = `/api/audio/${safeFilename}`;
    } catch (e) {}
  }

  const initialStatus = (user.role === 'admin') ? 'approved' : 'pending';

  try {
    const insertSql = `
      INSERT INTO tracks (title, artist, genre, duration, audio_url, is_loop, license_type, user_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, title, artist, genre, duration, status
    `;

    const insertedRows = await runNeonSql(env.DATABASE_URL, insertSql, [
      title,
      artist,
      genre,
      duration,
      audioUrl,
      isLoop,
      'CC0 Free',
      user.id,
      initialStatus
    ]);

    return new Response(JSON.stringify({
      success: true,
      track: insertedRows[0],
      message: initialStatus === 'approved' 
        ? 'Track uploaded and published successfully!' 
        : 'Track uploaded successfully! It is now in the review queue for moderator approval.'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to record track in database' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
