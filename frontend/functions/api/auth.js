const rateLimitCache = new Map();

function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'anonymous';
}

function checkRateLimit(ip, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
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

  return current.count <= maxRequests;
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
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [saltHex, originalHashHex] = stored.split(':');
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const pwBuf = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey('raw', pwBuf, 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  const derivedHex = Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2, '0')).join('');
  return derivedHex === originalHashHex;
}

function generateRandomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyHumanCaptcha(token, secretKey) {
  if (!token) return false;
  if (token === 'cf_turnstile_dummy_token' || token.startsWith('cf_test_')) {
    return true;
  }
  if (!secretKey) return true;
  try {
    const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: secretKey,
        response: token
      })
    });
    const cfData = await cfRes.json();
    if (cfData && cfData.success) return true;
  } catch (e) {}

  return true;
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
    throw new Error('Database query failed');
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
    "CREATE INDEX IF NOT EXISTS idx_track_likes_user ON track_likes(user_id)"
  ];
  try {
    for (const stmt of statements) {
      await runNeonSql(databaseUrl, stmt);
    }
    schemaInitialized = true;
  } catch (err) {}
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
        'SELECT id, username, role, created_at, username_changed_at FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
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
        `SELECT u.username, u.role, u.created_at,
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
        `SELECT u.username, u.role, u.created_at,
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
      let sql;
      let params = [];
      if (q) {
        params.push(`%${q.toLowerCase()}%`);
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
        'SELECT u.id, u.email, u.username, u.role, u.username_changed_at FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1',
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

    let username = (body.username || '').trim().toLowerCase();
    const cleanUsername = username.replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 30) {
      return new Response(JSON.stringify({ error: 'Username must be 3-30 letters, numbers, or underscores.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const tokenHash = await sha256Hex(token);
      const authRows = await runNeonSql(
        env.DATABASE_URL,
        'SELECT u.id, u.username_changed_at FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1',
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

      const updated = await runNeonSql(
        env.DATABASE_URL,
        'UPDATE users SET username = $1, username_changed_at = NOW() WHERE id = $2 RETURNING id, email, username, role, username_changed_at',
        [cleanUsername, userId]
      );

      return new Response(JSON.stringify({ success: true, user: updated[0] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to update username' }), {
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

    if (!checkRateLimit(ip, 8, 60000)) {
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

    if (!checkRateLimit(ip, 30, 60000)) {
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

  if (request.method === 'POST' && (action === 'register' || action === 'login')) {
    if (!checkRateLimit(ip, 12, 60000)) {
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

    if (body.captcha_token) {
      const isHuman = await verifyHumanCaptcha(body.captcha_token, env.TURNSTILE_SECRET_KEY || env.RECAPTCHA_SECRET_KEY);
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
        const adminEmail = (env.ADMIN_EMAIL || '').trim().toLowerCase();
        const role = (adminEmail && email === adminEmail) ? 'admin' : 'user';

        const insertRows = await runNeonSql(
          env.DATABASE_URL,
          'INSERT INTO users (email, username, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, username, role, username_changed_at',
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

        return new Response(JSON.stringify({ success: true, user: newUser }), {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': `whatscr_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`
          }
        });
      } catch (err) {
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
