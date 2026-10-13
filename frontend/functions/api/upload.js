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
  const timeoutId = setTimeout(() => controller.abort(), 10000);

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

async function checkPersistentRateLimit(databaseUrl, key, maxRequests = 15, windowMs = 3600000) {
  try {
    const now = new Date();
    const resetAt = new Date(Date.now() + windowMs);
    const rows = await runNeonSql(
      databaseUrl,
      `INSERT INTO rate_limits (key, count, reset_at)
       VALUES ($1, 1, $2)
       ON CONFLICT (key) DO UPDATE
       SET count = CASE WHEN rate_limits.reset_at < $3 THEN 1 ELSE rate_limits.count + 1 END,
           reset_at = CASE WHEN rate_limits.reset_at < $3 THEN $2 ELSE rate_limits.reset_at END
       RETURNING count`,
      [key, resetAt.toISOString(), now.toISOString()]
    );
    if (rows && rows.length > 0) {
      return parseInt(rows[0].count, 10) <= maxRequests;
    }
    return true;
  } catch (e) {
    return true;
  }
}

function inspectAudioHeader(buffer) {
  if (!buffer || buffer.byteLength < 64) {
    return { valid: false, error: 'File is too small or empty' };
  }
  const bytes = new Uint8Array(buffer);
  const len = bytes.length;

  if (bytes[0] === 0x4D && bytes[1] === 0x5A) {
    return { valid: false, error: 'Upload rejected: DOS or Windows executable header detected' };
  }
  if (bytes[0] === 0x7F && bytes[1] === 0x45 && bytes[2] === 0x4C && bytes[3] === 0x46) {
    return { valid: false, error: 'Upload rejected: Linux ELF executable header detected' };
  }
  if (bytes[0] === 0x50 && bytes[1] === 0x4B && ((bytes[2] === 0x03 && bytes[3] === 0x04) || (bytes[2] === 0x05 && bytes[3] === 0x06))) {
    return { valid: false, error: 'Upload rejected: ZIP or JAR archive header detected' };
  }
  if (bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21) {
    return { valid: false, error: 'Upload rejected: RAR archive header detected' };
  }
  if (bytes[0] === 0x37 && bytes[1] === 0x7A && bytes[2] === 0xBC && bytes[3] === 0xAF && bytes[4] === 0x27 && bytes[5] === 0x1C) {
    return { valid: false, error: 'Upload rejected: 7-Zip archive header detected' };
  }
  if (
    (bytes[0] === 0xCA && bytes[1] === 0xFE && bytes[2] === 0xBA && bytes[3] === 0xBE) ||
    (bytes[0] === 0xCE && bytes[1] === 0xFA && bytes[2] === 0xED && bytes[3] === 0xFE) ||
    (bytes[0] === 0xCF && bytes[1] === 0xFA && bytes[2] === 0xED && bytes[3] === 0xFE) ||
    (bytes[0] === 0xFE && bytes[1] === 0xED && bytes[2] === 0xFA && bytes[3] === 0xCE) ||
    (bytes[0] === 0xFE && bytes[1] === 0xED && bytes[2] === 0xFA && bytes[3] === 0xCF)
  ) {
    return { valid: false, error: 'Upload rejected: Mach-O binary or Java class header detected' };
  }
  if (bytes[0] === 0x23 && bytes[1] === 0x21) {
    return { valid: false, error: 'Upload rejected: Shell script shebang header detected' };
  }
  if (bytes[0] === 0x3C) {
    const headText = String.fromCharCode(...bytes.slice(0, 16)).toLowerCase();
    if (headText.startsWith('<!doctype') || headText.startsWith('<html') || headText.startsWith('<script') || headText.startsWith('<?xml') || headText.startsWith('<svg')) {
      return { valid: false, error: 'Upload rejected: HTML or XML document header detected' };
    }
  }

  const isId3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const isMp3Sync = bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0;
  const isRiffWav = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
                    bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;
  const isOgg = bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;

  if (isId3) {
    const tagSize = ((bytes[6] & 0x7F) << 21) |
                    ((bytes[7] & 0x7F) << 14) |
                    ((bytes[8] & 0x7F) << 7) |
                    (bytes[9] & 0x7F);
    const totalId3Header = 10 + tagSize;
    if (totalId3Header >= len) {
      return { valid: false, error: 'Truncated or corrupted ID3 tag header' };
    }
    const audioStart = totalId3Header;
    if (audioStart + 2 <= len) {
      const syncByte1 = bytes[audioStart];
      const syncByte2 = bytes[audioStart + 1];
      if (!(syncByte1 === 0xFF && (syncByte2 & 0xE0) === 0xE0)) {
        let foundSync = false;
        const searchLimit = Math.min(audioStart + 2048, len - 2);
        for (let i = audioStart; i < searchLimit; i++) {
          if (bytes[i] === 0xFF && (bytes[i + 1] & 0xE0) === 0xE0) {
            foundSync = true;
            break;
          }
        }
        if (!foundSync) {
          return { valid: false, error: 'Missing valid MPEG audio sync frame following ID3 tag' };
        }
      }
    }
    return { valid: true, format: 'mp3' };
  }

  if (isMp3Sync) {
    return { valid: true, format: 'mp3' };
  }

  if (isRiffWav) {
    const riffSize = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
    if (riffSize > 0 && len > riffSize + 128) {
      return { valid: false, error: 'WAV file contains suspicious appended data beyond declared RIFF length' };
    }
    return { valid: true, format: 'wav' };
  }

  if (isOgg) {
    return { valid: true, format: 'ogg' };
  }

  return { valid: false, error: 'Invalid audio format: only genuine MP3, WAV or OGG files are permitted.' };
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 32768) {
    const chunk = bytes.subarray(i, Math.min(i + 32768, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
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

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'Server database not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const uploadAllowed = await checkPersistentRateLimit(env.DATABASE_URL, `upload_${ip}`, 15, 3600000);
  if (!uploadAllowed) {
    return new Response(JSON.stringify({ error: 'Upload limit exceeded. Max 15 uploads per hour.' }), {
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
      'SELECT u.id, u.email, u.role, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1',
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

  const botTrap = formData.get('bot_trap');
  if (botTrap) {
    return new Response(JSON.stringify({ error: 'Automated submission detected.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const formTime = parseInt(formData.get('form_time'), 10);
  if (formTime && (Date.now() - formTime < 1000)) {
    return new Response(JSON.stringify({ error: 'Submission too fast. Please verify.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const file = formData.get('file');
  const title = (formData.get('title') || '').toString().trim().slice(0, 100);
  const artist = (formData.get('artist') || '').toString().trim().slice(0, 80) || (user.username || user.email.split('@')[0]);
  const genre = (formData.get('genre') || 'Soundtrack').toString().trim().slice(0, 50);
  let duration = (formData.get('duration') || '0:01').toString().trim().slice(0, 10);
  if (!duration || duration === '0:00' || duration === '0:0') {
    duration = '0:01';
  }
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
  const inspection = inspectAudioHeader(buffer);
  if (!inspection.valid) {
    return new Response(JSON.stringify({ error: inspection.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const detectedFormat = inspection.format;
  const originalFileName = (file.name || '').toLowerCase();
  let ext = '';
  if (originalFileName.endsWith('.mp3')) ext = 'mp3';
  else if (originalFileName.endsWith('.wav')) ext = 'wav';
  else if (originalFileName.endsWith('.ogg')) ext = 'ogg';

  if (!ext) {
    return new Response(JSON.stringify({ error: 'File extension must be .mp3, .wav or .ogg.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (ext !== detectedFormat) {
    return new Response(JSON.stringify({ error: `File extension (.${ext}) does not match detected audio format (${detectedFormat.toUpperCase()}).` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const declaredMime = (file.type || '').toLowerCase();
  if (declaredMime && declaredMime !== 'application/octet-stream') {
    if (detectedFormat === 'mp3' && !declaredMime.includes('mpeg') && !declaredMime.includes('mp3') && !declaredMime.includes('mpg')) {
      return new Response(JSON.stringify({ error: 'Declared MIME type does not match MP3 audio format.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (detectedFormat === 'wav' && !declaredMime.includes('wav') && !declaredMime.includes('wave')) {
      return new Response(JSON.stringify({ error: 'Declared MIME type does not match WAV audio format.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (detectedFormat === 'ogg' && !declaredMime.includes('ogg') && !declaredMime.includes('vorbis')) {
      return new Response(JSON.stringify({ error: 'Declared MIME type does not match OGG audio format.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  let mimeType = 'audio/mpeg';
  let safeExt = 'mp3';
  if (detectedFormat === 'wav') {
    mimeType = 'audio/wav';
    safeExt = 'wav';
  } else if (detectedFormat === 'ogg') {
    mimeType = 'audio/ogg';
    safeExt = 'ogg';
  }

  const fileId = crypto.randomUUID();
  const safeFilename = `${fileId}.${safeExt}`;
  const audioUrl = `/api/audio/${safeFilename}`;

  if (env.AUDIO_BUCKET) {
    try {
      await env.AUDIO_BUCKET.put(safeFilename, buffer, {
        httpMetadata: {
          contentType: mimeType,
          cacheControl: 'public, max-age=31536000'
        }
      });
    } catch (e) {}
  }

  try {
    const base64Data = arrayBufferToBase64(buffer);
    await runNeonSql(
      env.DATABASE_URL,
      "INSERT INTO audio_files (filename, mime_type, data) VALUES ($1, $2, decode($3, 'base64')) ON CONFLICT (filename) DO NOTHING",
      [safeFilename, mimeType, base64Data]
    );
  } catch (storageErr) {
    return new Response(JSON.stringify({ error: 'Failed to save audio file to database' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
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
