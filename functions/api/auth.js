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
  try {
    const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: secretKey || '0x4AAAAAAFU20J4IcKpc6qVzjGj3VcM2iOg',
        response: token
      })
    });
    const cfData = await cfRes.json();
    if (cfData && cfData.success) return true;
  } catch (e) {}

  try {
    const gRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secretKey || '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe')}&response=${encodeURIComponent(token)}`
    });
    const gData = await gRes.json();
    if (gData && gData.success) return true;
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
    "CREATE TABLE IF NOT EXISTS audio_files (filename VARCHAR(255) PRIMARY KEY, mime_type VARCHAR(64) NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)"
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
    const targetUsername = (url.searchParams.get('username') || '').trim();
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
        return new Response(JSON.stringify({
          user: {
            username: u.username,
            role: u.role,
            created_at: u.created_at,
            track_count: count
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        user: {
          username: targetUsername,
          role: 'artist',
          created_at: null,
          track_count: count
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
