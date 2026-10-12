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

async function runNeonSql(databaseUrl, sql, params = []) {
  const dbUrl = new URL(databaseUrl);
  const endpoint = `https://${dbUrl.host}/sql`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

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
    "CREATE TABLE IF NOT EXISTS sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash VARCHAR(255) UNIQUE NOT NULL, expires_at TIMESTAMP WITH TIME ZONE NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)",
    "CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)",
    "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'approved'"
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
        'SELECT u.id, u.email, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1',
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
    if (!checkRateLimit(ip, 8, 60000)) {
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

    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email) || email.length > 255) {
      return new Response(JSON.stringify({ error: 'Please enter a valid email address.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'register') {
      if (!password || password.length < 8 || password.length > 128) {
        return new Response(JSON.stringify({ error: 'Password must be at least 8 characters long.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      try {
        const existing = await runNeonSql(env.DATABASE_URL, 'SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
        if (existing && existing.length > 0) {
          return new Response(JSON.stringify({ error: 'An account with this email already exists.' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const hashed = await hashPassword(password);
        const adminEmail = (env.ADMIN_EMAIL || '').trim().toLowerCase();
        const role = (adminEmail && email === adminEmail) ? 'admin' : 'user';

        const insertRows = await runNeonSql(
          env.DATABASE_URL,
          'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
          [email, hashed, role]
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
      if (!password) {
        return new Response(JSON.stringify({ error: 'Please enter your password.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      try {
        const users = await runNeonSql(
          env.DATABASE_URL,
          'SELECT id, email, password_hash, role FROM users WHERE email = $1 LIMIT 1',
          [email]
        );

        if (!users || users.length === 0) {
          return new Response(JSON.stringify({ error: 'Invalid email or password.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const user = users[0];
        const isValid = await verifyPassword(password, user.password_hash);
        if (!isValid) {
          return new Response(JSON.stringify({ error: 'Invalid email or password.' }), {
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

        return new Response(JSON.stringify({ success: true, user: { id: user.id, email: user.email, role: user.role } }), {
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
