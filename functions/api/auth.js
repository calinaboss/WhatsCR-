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

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = new TextEncoder().encode(a);
  const bBuf = new TextEncoder().encode(b);
  if (aBuf.byteLength !== bBuf.byteLength) return false;
  let c = 0;
  for (let i = 0; i < aBuf.byteLength; i++) {
    c |= aBuf[i] ^ bBuf[i];
  }
  return c === 0;
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const pwBuf = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey('raw', pwBuf, 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  const hashHex = Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `100000:${saltHex}:${hashHex}`;
}

async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const parts = stored.split(':');
  let iterations = 100000;
  let saltHex = '';
  let originalHashHex = '';
  if (parts.length === 3) {
    iterations = parseInt(parts[0], 10) || 100000;
    if (iterations > 100000) iterations = 100000;
    saltHex = parts[1];
    originalHashHex = parts[2];
  } else if (parts.length === 2) {
    saltHex = parts[0];
    originalHashHex = parts[1];
  } else {
    return false;
  }
  if (!saltHex || !originalHashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const pwBuf = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey('raw', pwBuf, 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
    key,
    256
  );
  const derivedHex = Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2, '0')).join('');
  return constantTimeEqual(derivedHex, originalHashHex);
}

function generateRandomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyHumanCaptcha(token, secretKey, remoteIp) {
  if (!token || typeof token !== 'string') return false;
  if (token === 'cf_turnstile_dummy_token' || token.startsWith('cf_test_')) {
    return false;
  }
  if (!secretKey) return false;
  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp && remoteIp !== 'anonymous') {
      formData.append('remoteip', remoteIp);
    }
    const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });
    const cfData = await cfRes.json();
    return Boolean(cfData && cfData.success === true);
  } catch (e) {
    return false;
  }
}

async function sendEmailJsOtp(env, toEmail, passcode, timeStr) {
  const serviceId = env.EMAILJS_SERVICE_ID;
  const templateId = env.EMAILJS_TEMPLATE_ID;
  const publicKey = env.EMAILJS_PUBLIC_KEY;
  const privateKey = env.EMAILJS_PRIVATE_KEY;
  if (!serviceId || !templateId || !publicKey) {
    console.error('EMAILJS_CONFIG_MISSING:', { serviceId: Boolean(serviceId), templateId: Boolean(templateId), publicKey: Boolean(publicKey) });
    return false;
  }
  try {
    const payload = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: {
        email: toEmail,
        passcode: passcode,
        time: timeStr || '15 minutes'
      }
    };
    if (privateKey) {
      payload.accessToken = privateKey;
    }
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('EMAILJS_HTTP_ERROR:', res.status, errText);
      return false;
    }
    return true;
  } catch (err) {
    console.error('EMAILJS_SEND_ERROR:', err && err.message ? err.message : String(err));
    return false;
  }
}

function inspectImageHeader(buffer) {
  if (!buffer || buffer.byteLength < 16) {
    return { valid: false, error: 'File is too small or invalid' };
  }
  const bytes = new Uint8Array(buffer.slice(0, 32));
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { valid: true, format: 'jpg', mime: 'image/jpeg' };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
      bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
    return { valid: true, format: 'png', mime: 'image/png' };
  }
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { valid: true, format: 'webp', mime: 'image/webp' };
  }
  return { valid: false, error: 'Only JPEG, PNG, or WebP images are allowed.' };
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

async function runNeonSql(databaseUrl, sql, params = []) {
  const dbUrl = new URL(databaseUrl);
  const endpoint = `https://${dbUrl.host}/sql`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

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
    const errBody = await res.text().catch(() => '');
    throw new Error(`Database query failed (${res.status}): ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  if (data && Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data) && data[0] && Array.isArray(data[0].rows)) return data[0].rows;
  return [];
}

let schemaInitialized = false;
async function ensureTables(databaseUrl) {
  if (schemaInitialized) return;
  const statements = [
    "CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, role VARCHAR(32) NOT NULL DEFAULT 'user', created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMP WITH TIME ZONE",
    "CREATE TABLE IF NOT EXISTS sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash VARCHAR(255) UNIQUE NOT NULL, expires_at TIMESTAMP WITH TIME ZONE NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)",
    "CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)",
    "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'approved'",
    "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0",
    "CREATE TABLE IF NOT EXISTS audio_files (filename VARCHAR(255) PRIMARY KEY, mime_type VARCHAR(64) NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS follows (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, CONSTRAINT unique_follow UNIQUE (follower_id, following_id))",
    "CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id)",
    "CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id)",
    "CREATE TABLE IF NOT EXISTS track_likes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, track_id INT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, CONSTRAINT unique_track_like UNIQUE (user_id, track_id))",
    "CREATE INDEX IF NOT EXISTS idx_track_likes_track ON track_likes(track_id)",
    "CREATE INDEX IF NOT EXISTS idx_track_likes_user ON track_likes(user_id)",
    "CREATE TABLE IF NOT EXISTS rate_limits (key VARCHAR(255) PRIMARY KEY, count INT NOT NULL DEFAULT 1, reset_at TIMESTAMP WITH TIME ZONE NOT NULL)",
    "CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_at)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(300)",
    "CREATE TABLE IF NOT EXISTS avatar_files (filename VARCHAR(255) PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE, mime_type VARCHAR(64) NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)",
    "CREATE INDEX IF NOT EXISTS idx_avatar_files_user ON avatar_files(user_id)",
    "CREATE TABLE IF NOT EXISTS email_verifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE CASCADE, email VARCHAR(255) NOT NULL, code_hash VARCHAR(255) NOT NULL, expires_at TIMESTAMP WITH TIME ZONE NOT NULL, attempts INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)",
    "CREATE INDEX IF NOT EXISTS idx_email_verif_email ON email_verifications(email)"
  ];
  for (const stmt of statements) {
    try {
      await runNeonSql(databaseUrl, stmt);
    } catch (err) {
      console.error('SCHEMA_MIGRATION_ERROR:', err && err.message ? err.message : String(err));
    }
  }
  schemaInitialized = true;
}

async function checkPersistentRateLimit(databaseUrl, key, maxRequests = 10, windowMs = 60000) {
  try {
    const now = new Date();
    const resetAt = new Date(Date.now() + windowMs);
    if (Math.random() < 0.05) {
      runNeonSql(databaseUrl, 'DELETE FROM rate_limits WHERE reset_at < NOW()').catch(() => {});
    }
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
    return false;
  } catch (e) {
    return false;
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const ip = getClientIp(request);
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'Server database not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  await ensureTables(env.DATABASE_URL);

  if (request.method === 'GET' && action === 'profile') {
    const targetUsername = (url.searchParams.get('username') || '').trim().replace(/^@/, '');
    if (!targetUsername) {
      return new Response(JSON.stringify({ error: 'Username is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const userRows = await runNeonSql(
        env.DATABASE_URL,
        'SELECT id, username, role, created_at, username_changed_at, avatar_url, bio FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
        [targetUsername]
      );

      const trackRows = await runNeonSql(
        env.DATABASE_URL,
        "SELECT COUNT(*) as track_count FROM tracks WHERE LOWER(artist) = LOWER($1) AND (status = 'approved' OR status IS NULL)",
        [targetUsername]
      );
      const count = trackRows && trackRows[0] ? parseInt(trackRows[0].track_count, 10) || 0 : 0;

      if (userRows && userRows.length > 0) {
        const u = userRows[0];

        const followStats = await runNeonSql(
          env.DATABASE_URL,
          'SELECT (SELECT COUNT(*) FROM follows WHERE following_id = $1) AS follower_count, (SELECT COUNT(*) FROM follows WHERE follower_id = $1) AS following_count',
          [u.id]
        );
        const followerCount = followStats && followStats[0] ? parseInt(followStats[0].follower_count, 10) || 0 : 0;
        const followingCount = followStats && followStats[0] ? parseInt(followStats[0].following_count, 10) || 0 : 0;

        let isFollowing = false;
        const cookies = parseCookies(request.headers.get('Cookie'));
        const token = cookies.whatscr_session;
        if (token) {
          try {
            const tokenHash = await sha256Hex(token);
            const sessionRows = await runNeonSql(
              env.DATABASE_URL,
              'SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > NOW() LIMIT 1',
              [tokenHash]
            );
            if (sessionRows && sessionRows.length > 0) {
              const currentUserId = sessionRows[0].user_id;
              const isF = await runNeonSql(
                env.DATABASE_URL,
                'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1',
                [currentUserId, u.id]
              );
              if (isF && isF.length > 0) isFollowing = true;
            }
          } catch (sessionErr) {}
        }

        return new Response(JSON.stringify({
          user: {
            username: u.username,
            role: u.role,
            avatar_url: u.avatar_url || null,
            bio: u.bio || '',
            created_at: u.created_at,
            track_count: count,
            follower_count: followerCount,
            following_count: followingCount,
            is_following: isFollowing
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        user: {
          username: targetUsername,
          role: 'Creator',
          created_at: null,
          track_count: count,
          follower_count: 0,
          following_count: 0,
          is_following: false
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to fetch profile' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'GET' && action === 'followers') {
    const targetUsername = (url.searchParams.get('username') || '').trim().replace(/^@/, '');
    if (!targetUsername) {
      return new Response(JSON.stringify({ error: 'Username is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const rows = await runNeonSql(
        env.DATABASE_URL,
        `SELECT u.username, u.role, u.created_at, u.avatar_url,
          (SELECT COUNT(*) FROM tracks t WHERE t.user_id = u.id AND (t.status = 'approved' OR t.status IS NULL)) as track_count
        FROM follows f
        JOIN users u ON f.follower_id = u.id
        JOIN users target ON f.following_id = target.id
        WHERE LOWER(target.username) = LOWER($1)
        ORDER BY f.created_at DESC
        LIMIT 50`,
        [targetUsername]
      );
      return new Response(JSON.stringify({ users: rows }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to fetch followers' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'GET' && action === 'following') {
    const targetUsername = (url.searchParams.get('username') || '').trim().replace(/^@/, '');
    if (!targetUsername) {
      return new Response(JSON.stringify({ error: 'Username is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const rows = await runNeonSql(
        env.DATABASE_URL,
        `SELECT u.username, u.role, u.created_at, u.avatar_url,
          (SELECT COUNT(*) FROM tracks t WHERE t.user_id = u.id AND (t.status = 'approved' OR t.status IS NULL)) as track_count
        FROM follows f
        JOIN users u ON f.following_id = u.id
        JOIN users target ON f.follower_id = target.id
        WHERE LOWER(target.username) = LOWER($1)
        ORDER BY f.created_at DESC
        LIMIT 50`,
        [targetUsername]
      );
      return new Response(JSON.stringify({ users: rows }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to fetch following' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'GET' && action === 'search_users') {
    const q = (url.searchParams.get('q') || '').trim().replace(/^@/, '').slice(0, 50);
    try {
      let currentUserId = null;
      const cookies = parseCookies(request.headers.get('Cookie'));
      const token = cookies.whatscr_session;
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
        } catch (sessionErr) {}
      }

      let sql;
      let params = [];
      if (q) {
        params.push(`%${q.toLowerCase()}%`);
        if (currentUserId) {
          params.push(currentUserId);
          sql = `SELECT u.username, u.role, u.created_at,
            COUNT(DISTINCT t.id) as track_count,
            COUNT(DISTINCT f.follower_id) as follower_count
          FROM users u
          LEFT JOIN tracks t ON t.user_id = u.id AND (t.status = 'approved' OR t.status IS NULL)
          LEFT JOIN follows f ON f.following_id = u.id
          WHERE u.username IS NOT NULL AND LOWER(u.username) LIKE $1 AND u.id != $2
          GROUP BY u.id, u.username, u.role, u.created_at
          ORDER BY follower_count DESC, track_count DESC
          LIMIT 30`;
        } else {
          sql = `SELECT u.username, u.role, u.created_at,
            COUNT(DISTINCT t.id) as track_count,
            COUNT(DISTINCT f.follower_id) as follower_count
          FROM users u
          LEFT JOIN tracks t ON t.user_id = u.id AND (t.status = 'approved' OR t.status IS NULL)
          LEFT JOIN follows f ON f.following_id = u.id
          WHERE u.username IS NOT NULL AND LOWER(u.username) LIKE $1
          GROUP BY u.id, u.username, u.role, u.created_at
          ORDER BY follower_count DESC, track_count DESC
          LIMIT 30`;
        }
      } else {
        if (currentUserId) {
          params.push(currentUserId);
          sql = `SELECT u.username, u.role, u.created_at,
            COUNT(DISTINCT t.id) as track_count,
            COUNT(DISTINCT f.follower_id) as follower_count
          FROM users u
          LEFT JOIN tracks t ON t.user_id = u.id AND (t.status = 'approved' OR t.status IS NULL)
          LEFT JOIN follows f ON f.following_id = u.id
          WHERE u.username IS NOT NULL AND u.id != $1
          GROUP BY u.id, u.username, u.role, u.created_at
          ORDER BY follower_count DESC, track_count DESC
          LIMIT 30`;
        } else {
          sql = `SELECT u.username, u.role, u.created_at,
            COUNT(DISTINCT t.id) as track_count,
            COUNT(DISTINCT f.follower_id) as follower_count
          FROM users u
          LEFT JOIN tracks t ON t.user_id = u.id AND (t.status = 'approved' OR t.status IS NULL)
          LEFT JOIN follows f ON f.following_id = u.id
          WHERE u.username IS NOT NULL
          GROUP BY u.id, u.username, u.role, u.created_at
          ORDER BY follower_count DESC, track_count DESC
          LIMIT 30`;
        }
      }
      const rows = await runNeonSql(env.DATABASE_URL, sql, params);
      return new Response(JSON.stringify({ users: rows }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to search users' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'GET' && action === 'me') {
    const cookies = parseCookies(request.headers.get('Cookie'));
    const token = cookies.whatscr_session;
    if (!token) {
      return new Response(JSON.stringify({ user: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const tokenHash = await sha256Hex(token);
      const rows = await runNeonSql(
        env.DATABASE_URL,
        'SELECT u.id, u.email, u.username, u.role, u.username_changed_at, u.email_verified, u.avatar_url, u.bio FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1',
        [tokenHash]
      );
      if (rows && rows.length > 0) {
        return new Response(JSON.stringify({ user: rows[0] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (e) {}

    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'POST' && action === 'update_profile') {
    const cookies = parseCookies(request.headers.get('Cookie'));
    const token = cookies.whatscr_session;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
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

    const hasUsername = typeof body.username === 'string' && body.username.trim().length > 0;
    const hasBio = body.bio !== undefined;
    const rawBio = hasBio ? String(body.bio).trim().slice(0, 300) : null;

    try {
      const tokenHash = await sha256Hex(token);
      const authRows = await runNeonSql(
        env.DATABASE_URL,
        'SELECT u.id, u.username, u.username_changed_at, u.bio, u.avatar_url FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1',
        [tokenHash]
      );
      if (!authRows || authRows.length === 0) {
        return new Response(JSON.stringify({ error: 'Session expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const user = authRows[0];
      const userId = user.id;

      let cleanUsername = null;
      if (hasUsername) {
        const username = body.username.trim().toLowerCase();
        cleanUsername = username.replace(/[^a-z0-9_]/g, '');
        if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 30) {
          return new Response(JSON.stringify({ error: 'Username must be 3-30 letters, numbers, or underscores.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (cleanUsername !== (user.username || '').toLowerCase()) {
          if (user.username_changed_at) {
            const lastChanged = new Date(user.username_changed_at).getTime();
            const diffMs = Date.now() - lastChanged;
            const cooldownMs = 24 * 60 * 60 * 1000;
            if (diffMs < cooldownMs) {
              const remainingMin = Math.ceil((cooldownMs - diffMs) / (60 * 1000));
              const hours = Math.floor(remainingMin / 60);
              const mins = remainingMin % 60;
              const timeText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
              return new Response(JSON.stringify({
                error: `You can change your username only once every 24 hours. Please wait another ${timeText}.`
              }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' }
              });
            }
          }

          const taken = await runNeonSql(
            env.DATABASE_URL,
            'SELECT id FROM users WHERE LOWER(username) = $1 AND id != $2 LIMIT 1',
            [cleanUsername, userId]
          );
          if (taken && taken.length > 0) {
            return new Response(JSON.stringify({ error: 'This username is already taken. Please choose another.' }), {
              status: 409,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
      }

      let updated;
      if (cleanUsername && cleanUsername !== (user.username || '').toLowerCase() && hasBio) {
        updated = await runNeonSql(
          env.DATABASE_URL,
          'UPDATE users SET username = $1, username_changed_at = NOW(), bio = $2 WHERE id = $3 RETURNING id, email, username, role, username_changed_at, email_verified, avatar_url, bio',
          [cleanUsername, rawBio, userId]
        );
      } else if (cleanUsername && cleanUsername !== (user.username || '').toLowerCase()) {
        updated = await runNeonSql(
          env.DATABASE_URL,
          'UPDATE users SET username = $1, username_changed_at = NOW() WHERE id = $2 RETURNING id, email, username, role, username_changed_at, email_verified, avatar_url, bio',
          [cleanUsername, userId]
        );
      } else if (hasBio) {
        updated = await runNeonSql(
          env.DATABASE_URL,
          'UPDATE users SET bio = $1 WHERE id = $2 RETURNING id, email, username, role, username_changed_at, email_verified, avatar_url, bio',
          [rawBio, userId]
        );
      } else {
        return new Response(JSON.stringify({ success: true, user: user }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, user: updated[0] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to update profile' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'POST' && action === 'upload_avatar') {
    const cookies = parseCookies(request.headers.get('Cookie'));
    const token = cookies.whatscr_session;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const tokenHash = await sha256Hex(token);
      const sessionRows = await runNeonSql(
        env.DATABASE_URL,
        'SELECT u.id, u.username, u.email, u.avatar_url FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1',
        [tokenHash]
      );
      if (!sessionRows || sessionRows.length === 0) {
        return new Response(JSON.stringify({ error: 'Session expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const user = sessionRows[0];

      const rateKey = `avatar_upload_${user.id}`;
      const allowed = await checkPersistentRateLimit(env.DATABASE_URL, rateKey, 10, 3600000);
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Too many avatar changes. Please wait an hour.' }), {
          status: 429,
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

      const file = formData.get('avatar') || formData.get('file');
      if (!file || typeof file === 'string' || !file.size) {
        return new Response(JSON.stringify({ error: 'Please choose an image file to upload.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const maxFileSize = 2 * 1024 * 1024;
      if (file.size > maxFileSize) {
        return new Response(JSON.stringify({ error: 'File size exceeds maximum allowed 2 MB.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const buffer = await file.arrayBuffer();
      const inspection = inspectImageHeader(buffer);
      if (!inspection.valid) {
        return new Response(JSON.stringify({ error: inspection.error }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const fileId = crypto.randomUUID();
      const safeFilename = `${fileId}.${inspection.format}`;
      const avatarUrl = `/api/avatar/${safeFilename}`;

      if (env.AVATAR_BUCKET) {
        try {
          await env.AVATAR_BUCKET.put(safeFilename, buffer, {
            httpMetadata: {
              contentType: inspection.mime,
              cacheControl: 'public, max-age=86400'
            }
          });
        } catch (e) {}
      } else if (env.AUDIO_BUCKET) {
        try {
          await env.AUDIO_BUCKET.put(`avatars/${safeFilename}`, buffer, {
            httpMetadata: {
              contentType: inspection.mime,
              cacheControl: 'public, max-age=86400'
            }
          });
        } catch (e) {}
      }

      try {
        const base64Data = arrayBufferToBase64(buffer);
        await runNeonSql(
          env.DATABASE_URL,
          "INSERT INTO avatar_files (filename, user_id, mime_type, data) VALUES ($1, $2, $3, decode($4, 'base64')) ON CONFLICT (filename) DO NOTHING",
          [safeFilename, user.id, inspection.mime, base64Data]
        );
      } catch (storageErr) {
        return new Response(JSON.stringify({ error: 'Failed to save avatar image' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (user.avatar_url && user.avatar_url.includes('/api/avatar/')) {
        const oldFilename = user.avatar_url.split('/').pop();
        if (oldFilename && /^[a-f0-9\-]{36}\.(jpg|png|webp)$/i.test(oldFilename)) {
          if (env.AVATAR_BUCKET) {
            env.AVATAR_BUCKET.delete(oldFilename).catch(() => {});
          } else if (env.AUDIO_BUCKET) {
            env.AUDIO_BUCKET.delete(`avatars/${oldFilename}`).catch(() => {});
          }
          runNeonSql(env.DATABASE_URL, 'DELETE FROM avatar_files WHERE filename = $1', [oldFilename]).catch(() => {});
        }
      }

      const updatedUser = await runNeonSql(
        env.DATABASE_URL,
        'UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING id, email, username, role, avatar_url, bio',
        [avatarUrl, user.id]
      );

      return new Response(JSON.stringify({
        success: true,
        avatar_url: avatarUrl,
        user: updatedUser[0]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (uploadErr) {
      return new Response(JSON.stringify({ error: 'Avatar upload failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'POST' && action === 'delete_avatar') {
    const cookies = parseCookies(request.headers.get('Cookie'));
    const token = cookies.whatscr_session;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const tokenHash = await sha256Hex(token);
      const sessionRows = await runNeonSql(
        env.DATABASE_URL,
        'SELECT u.id, u.avatar_url FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1',
        [tokenHash]
      );
      if (!sessionRows || sessionRows.length === 0) {
        return new Response(JSON.stringify({ error: 'Session expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const user = sessionRows[0];

      if (user.avatar_url && user.avatar_url.includes('/api/avatar/')) {
        const oldFilename = user.avatar_url.split('/').pop();
        if (oldFilename && /^[a-f0-9\-]{36}\.(jpg|png|webp)$/i.test(oldFilename)) {
          if (env.AVATAR_BUCKET) {
            env.AVATAR_BUCKET.delete(oldFilename).catch(() => {});
          } else if (env.AUDIO_BUCKET) {
            env.AUDIO_BUCKET.delete(`avatars/${oldFilename}`).catch(() => {});
          }
          runNeonSql(env.DATABASE_URL, 'DELETE FROM avatar_files WHERE filename = $1', [oldFilename]).catch(() => {});
        }
      }

      const updatedUser = await runNeonSql(
        env.DATABASE_URL,
        'UPDATE users SET avatar_url = NULL WHERE id = $1 RETURNING id, email, username, role, avatar_url, bio',
        [user.id]
      );

      return new Response(JSON.stringify({
        success: true,
        avatar_url: null,
        user: updatedUser[0]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (delErr) {
      return new Response(JSON.stringify({ error: 'Failed to delete avatar' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'POST' && action === 'change_password') {
    const cookies = parseCookies(request.headers.get('Cookie'));
    const token = cookies.whatscr_session;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const pwLimitKey = `auth_pw_${ip}`;
    const pwAllowed = await checkPersistentRateLimit(env.DATABASE_URL, pwLimitKey, 8, 60000);
    if (!pwAllowed) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please wait a minute.' }), {
        status: 429,
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

    const currentPassword = body.current_password || '';
    const newPassword = body.new_password || '';

    if (!currentPassword) {
      return new Response(JSON.stringify({ error: 'Please enter your current password.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
      return new Response(JSON.stringify({ error: 'New password must be at least 8 characters long.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (currentPassword === newPassword) {
      return new Response(JSON.stringify({ error: 'New password must be different from your current password.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const tokenHash = await sha256Hex(token);
      const authRows = await runNeonSql(
        env.DATABASE_URL,
        'SELECT u.id, u.password_hash FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1',
        [tokenHash]
      );
      if (!authRows || authRows.length === 0) {
        return new Response(JSON.stringify({ error: 'Session expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const user = authRows[0];

      const changePwKey = `auth_change_pw_${user.id}`;
      const allowed = await checkPersistentRateLimit(env.DATABASE_URL, changePwKey, 5, 300000);
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Too many attempts. Please wait 5 minutes.' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const isCurrentValid = await verifyPassword(currentPassword, user.password_hash);
      if (!isCurrentValid) {
        return new Response(JSON.stringify({ error: 'Current password is incorrect.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const newHashed = await hashPassword(newPassword);
      await runNeonSql(
        env.DATABASE_URL,
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [newHashed, user.id]
      );

      await runNeonSql(
        env.DATABASE_URL,
        'DELETE FROM sessions WHERE user_id = $1 AND token_hash != $2',
        [user.id, tokenHash]
      );

      return new Response(JSON.stringify({ success: true, message: 'Password updated successfully!' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to update password' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'POST' && action === 'follow') {
    const cookies = parseCookies(request.headers.get('Cookie'));
    const token = cookies.whatscr_session;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required. Please log in.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const followLimitKey = `auth_follow_${ip}`;
    const followAllowed = await checkPersistentRateLimit(env.DATABASE_URL, followLimitKey, 30, 60000);
    if (!followAllowed) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment.' }), {
        status: 429,
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

    const targetUsername = (body.username || '').trim().replace(/^@/, '');
    if (!targetUsername) {
      return new Response(JSON.stringify({ error: 'Target username is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const tokenHash = await sha256Hex(token);
      const sessionRows = await runNeonSql(
        env.DATABASE_URL,
        'SELECT u.id, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1',
        [tokenHash]
      );
      if (!sessionRows || sessionRows.length === 0) {
        return new Response(JSON.stringify({ error: 'Session expired. Please log in again.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const currentUser = sessionRows[0];

      const targetRows = await runNeonSql(
        env.DATABASE_URL,
        'SELECT id, username FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
        [targetUsername]
      );
      if (!targetRows || targetRows.length === 0) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const targetUser = targetRows[0];

      if (currentUser.id === targetUser.id) {
        return new Response(JSON.stringify({ error: 'You cannot follow yourself.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const existingFollow = await runNeonSql(
        env.DATABASE_URL,
        'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1',
        [currentUser.id, targetUser.id]
      );

      let isFollowing = false;
      if (existingFollow && existingFollow.length > 0) {
        await runNeonSql(
          env.DATABASE_URL,
          'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
          [currentUser.id, targetUser.id]
        );
        isFollowing = false;
      } else {
        await runNeonSql(
          env.DATABASE_URL,
          'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT (follower_id, following_id) DO NOTHING',
          [currentUser.id, targetUser.id]
        );
        isFollowing = true;
      }

      const countRows = await runNeonSql(
        env.DATABASE_URL,
        'SELECT COUNT(*) as follower_count FROM follows WHERE following_id = $1',
        [targetUser.id]
      );
      const followerCount = countRows && countRows[0] ? parseInt(countRows[0].follower_count, 10) || 0 : 0;

      return new Response(JSON.stringify({
        success: true,
        is_following: isFollowing,
        follower_count: followerCount
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to update follow status' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'POST' && action === 'logout') {
    const cookies = parseCookies(request.headers.get('Cookie'));
    const token = cookies.whatscr_session;
    if (token) {
      try {
        const tokenHash = await sha256Hex(token);
        await runNeonSql(env.DATABASE_URL, 'DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
      } catch (e) {}
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'whatscr_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
      }
    });
  }

  if (request.method === 'POST' && action === 'send_verification') {
    const cookies = parseCookies(request.headers.get('Cookie'));
    const token = cookies.whatscr_session;
    let targetEmail = '';
    let targetUserId = null;

    if (token) {
      try {
        const tokenHash = await sha256Hex(token);
        const sessionRows = await runNeonSql(
          env.DATABASE_URL,
          'SELECT u.id, u.email, u.email_verified FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1',
          [tokenHash]
        );
        if (sessionRows && sessionRows.length > 0) {
          if (sessionRows[0].email_verified) {
            return new Response(JSON.stringify({ error: 'Email is already verified.' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          targetEmail = sessionRows[0].email;
          targetUserId = sessionRows[0].id;
        }
      } catch (e) {}
    }

    if (!targetEmail) {
      let body = {};
      try {
        body = await request.json();
      } catch (e) {}
      targetEmail = (body.email || '').trim().toLowerCase();
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!targetEmail || !emailRegex.test(targetEmail)) {
      return new Response(JSON.stringify({ error: 'Valid email is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const rateKey = `otp_send_${targetEmail}`;
    const allowed = await checkPersistentRateLimit(env.DATABASE_URL, rateKey, 4, 300000);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please wait a few minutes before requesting another code.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await sha256Hex(otpCode);

    const now = new Date();
    const expDate = new Date(now.getTime() + 15 * 60 * 1000);
    const expiresAt = expDate.toISOString();
    const timeStr = expDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    await runNeonSql(env.DATABASE_URL, 'DELETE FROM email_verifications WHERE LOWER(email) = LOWER($1)', [targetEmail]);
    await runNeonSql(
      env.DATABASE_URL,
      'INSERT INTO email_verifications (user_id, email, code_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [targetUserId, targetEmail, codeHash, expiresAt]
    );

    const sent = await sendEmailJsOtp(env, targetEmail, otpCode, timeStr);
    if (!sent) {
      return new Response(JSON.stringify({ error: 'Failed to send verification email. Please try again later.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Verification code sent to your email.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'POST' && action === 'verify_email') {
    const rateKey = `otp_verify_${ip}`;
    const allowed = await checkPersistentRateLimit(env.DATABASE_URL, rateKey, 8, 300000);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Too many attempts. Please wait 5 minutes.' }), {
        status: 429,
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

    const code = (body.code || '').toString().trim().replace(/\D/g, '');
    let email = (body.email || '').trim().toLowerCase();

    if (!email) {
      const cookies = parseCookies(request.headers.get('Cookie'));
      const token = cookies.whatscr_session;
      if (token) {
        try {
          const tokenHash = await sha256Hex(token);
          const sRows = await runNeonSql(
            env.DATABASE_URL,
            'SELECT u.email FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1',
            [tokenHash]
          );
          if (sRows && sRows.length > 0) {
            email = sRows[0].email;
          }
        } catch (e) {}
      }
    }

    if (!email || code.length !== 6) {
      return new Response(JSON.stringify({ error: 'Please enter a valid 6-digit code.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const verifRows = await runNeonSql(
      env.DATABASE_URL,
      'SELECT id, user_id, code_hash, attempts, expires_at FROM email_verifications WHERE LOWER(email) = LOWER($1) AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email]
    );

    if (!verifRows || verifRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Verification code is invalid or has expired. Please request a new code.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const record = verifRows[0];
    if (record.attempts >= 5) {
      await runNeonSql(env.DATABASE_URL, 'DELETE FROM email_verifications WHERE id = $1', [record.id]);
      return new Response(JSON.stringify({ error: 'Too many incorrect attempts. Please request a new code.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const inputHash = await sha256Hex(code);
    const isMatch = constantTimeEqual(inputHash, record.code_hash);

    if (!isMatch) {
      await runNeonSql(env.DATABASE_URL, 'UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1', [record.id]);
      return new Response(JSON.stringify({ error: 'Invalid verification code. Please try again.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await runNeonSql(env.DATABASE_URL, 'UPDATE users SET email_verified = TRUE WHERE LOWER(email) = LOWER($1)', [email]);
    await runNeonSql(env.DATABASE_URL, 'DELETE FROM email_verifications WHERE LOWER(email) = LOWER($1)', [email]);

    return new Response(JSON.stringify({ success: true, message: 'Email verified successfully!' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'POST' && (action === 'register' || action === 'login')) {
    const rateKey = `auth_${action}_${ip}`;
    const allowed = await checkPersistentRateLimit(env.DATABASE_URL, rateKey, 12, 60000);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Too many attempts. Please wait a minute.' }), {
        status: 429,
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

    if (body.bot_trap) {
      return new Response(JSON.stringify({ error: 'Automated submission blocked.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const formTime = parseInt(body.form_time, 10);
    if (formTime && (Date.now() - formTime < 1000)) {
      return new Response(JSON.stringify({ error: 'Please wait a moment before submitting.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const turnstileSecret = env.TURNSTILE_SECRET_KEY || env.RECAPTCHA_SECRET_KEY;

    if (action === 'register') {
      if (!body.captcha_token) {
        return new Response(JSON.stringify({ error: 'Human verification required.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const isHuman = await verifyHumanCaptcha(body.captcha_token, turnstileSecret, ip);
      if (!isHuman) {
        return new Response(JSON.stringify({ error: 'Human verification failed. Please try again.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else if (action === 'login' && body.captcha_token) {
      const isHuman = await verifyHumanCaptcha(body.captcha_token, turnstileSecret, ip);
      if (!isHuman) {
        return new Response(JSON.stringify({ error: 'Human verification failed. Please try again.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const identifier = (body.identifier || body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (action === 'register') {
      const email = identifier;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email) || email.length > 255) {
        return new Response(JSON.stringify({ error: 'Please enter a valid email address.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      let username = (body.username || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (!username || username.length < 3) {
        username = email.split('@')[0].replace(/[^a-z0-9_]/g, '').slice(0, 30);
      }
      if (username.length < 3) {
        username = `user_${crypto.randomUUID().slice(0, 8)}`;
      }

      if (!password || password.length < 8 || password.length > 128) {
        return new Response(JSON.stringify({ error: 'Password must be at least 8 characters long.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      try {
        const existing = await runNeonSql(
          env.DATABASE_URL,
          'SELECT id FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $2 LIMIT 1',
          [email, username]
        );
        if (existing && existing.length > 0) {
          return new Response(JSON.stringify({ error: 'An account with this email or username already exists.' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const hashed = await hashPassword(password);
        const role = 'user';

        const insertRows = await runNeonSql(
          env.DATABASE_URL,
          'INSERT INTO users (email, username, password_hash, role, email_verified) VALUES ($1, $2, $3, $4, FALSE) RETURNING id, email, username, role, username_changed_at, email_verified',
          [email, username, hashed, role]
        );
        const newUser = insertRows[0];

        const token = generateRandomToken();
        const tokenHash = await sha256Hex(token);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        await runNeonSql(
          env.DATABASE_URL,
          'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
          [newUser.id, tokenHash, expiresAt]
        );

        let otpSent = false;
        try {
          const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
          const codeHash = await sha256Hex(otpCode);
          const expDate = new Date(Date.now() + 15 * 60 * 1000);
          const otpExpiresAt = expDate.toISOString();
          const timeStr = expDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          await runNeonSql(
            env.DATABASE_URL,
            'INSERT INTO email_verifications (user_id, email, code_hash, expires_at) VALUES ($1, $2, $3, $4)',
            [newUser.id, email, codeHash, otpExpiresAt]
          );

          otpSent = await sendEmailJsOtp(env, email, otpCode, timeStr);
        } catch (otpErr) {
          console.error('REGISTER_OTP_ERROR:', otpErr && otpErr.message ? otpErr.message : String(otpErr));
        }

        return new Response(JSON.stringify({
          success: true,
          user: newUser,
          requires_verification: otpSent,
          otp_failed: !otpSent,
          email: email
        }), {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': `whatscr_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`
          }
        });
      } catch (err) {
        console.error('REGISTER_ERROR:', err && err.message ? err.message : String(err));
        return new Response(JSON.stringify({ error: 'Registration error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (action === 'login') {
      if (!identifier || !password) {
        return new Response(JSON.stringify({ error: 'Please enter your login details.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      try {
        const users = await runNeonSql(
          env.DATABASE_URL,
          'SELECT id, email, username, password_hash, role, username_changed_at FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1 LIMIT 1',
          [identifier]
        );

        if (!users || users.length === 0) {
          return new Response(JSON.stringify({ error: 'Invalid login credentials.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const user = users[0];
        const isValid = await verifyPassword(password, user.password_hash);
        if (!isValid) {
          return new Response(JSON.stringify({ error: 'Invalid login credentials.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const token = generateRandomToken();
        const tokenHash = await sha256Hex(token);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        await runNeonSql(
          env.DATABASE_URL,
          'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
          [user.id, tokenHash, expiresAt]
        );

        return new Response(JSON.stringify({
          success: true,
          user: { id: user.id, email: user.email, username: user.username, role: user.role, username_changed_at: user.username_changed_at }
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': `whatscr_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`
          }
        });
      } catch (err) {
        console.error('LOGIN_ERROR:', err && err.message ? err.message : String(err));
        return new Response(JSON.stringify({ error: 'Login error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
}
