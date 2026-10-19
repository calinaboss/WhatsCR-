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
    const errText = await res.text().catch(() => '');
    throw new Error(`Database query failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  if (data && Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data) && data[0] && Array.isArray(data[0].rows)) return data[0].rows;
  return [];
}

let forumSchemaInitialized = false;
async function ensureForumTables(databaseUrl) {
  if (forumSchemaInitialized) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS forum_rooms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(120) NOT NULL,
      description VARCHAR(255),
      creator_name VARCHAR(60) NOT NULL,
      creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
      message_count INT DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_forum_rooms_last_msg ON forum_rooms(last_message_at DESC)`,
    `CREATE TABLE IF NOT EXISTS forum_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID NOT NULL REFERENCES forum_rooms(id) ON DELETE CASCADE,
      sender_name VARCHAR(60) NOT NULL,
      sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
      sender_role VARCHAR(32) DEFAULT 'user',
      is_guest BOOLEAN DEFAULT false,
      guest_id VARCHAR(64),
      content VARCHAR(800) NOT NULL,
      reply_to_id UUID,
      reply_to_sender VARCHAR(60),
      reply_to_text VARCHAR(200),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE forum_messages ADD COLUMN IF NOT EXISTS guest_id VARCHAR(64)`,
    `CREATE INDEX IF NOT EXISTS idx_forum_messages_room_created ON forum_messages(room_id, created_at ASC)`,
    `CREATE TABLE IF NOT EXISTS forum_typing (
      room_id UUID NOT NULL,
      user_name VARCHAR(60) NOT NULL,
      user_id UUID,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (room_id, user_name)
    )`,
    `CREATE TABLE IF NOT EXISTS rate_limits (key VARCHAR(255) PRIMARY KEY, count INT NOT NULL DEFAULT 1, reset_at TIMESTAMP WITH TIME ZONE NOT NULL)`
  ];
  for (const stmt of statements) {
    try {
      await runNeonSql(databaseUrl, stmt);
    } catch (err) {
      console.error('FORUM_SCHEMA_ERROR:', err && err.message ? err.message : String(err));
    }
  }
  forumSchemaInitialized = true;
}

async function checkPersistentRateLimit(databaseUrl, key, maxRequests = 30, windowMs = 60000) {
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
    return true;
  }
}

async function getSessionUser(request, env) {
  if (!env.DATABASE_URL) return null;
  const cookies = parseCookies(request.headers.get('Cookie'));
  const token = cookies.whatscr_session;
  if (!token) return null;
  try {
    const tokenHash = await sha256Hex(token);
    const rows = await runNeonSql(
      env.DATABASE_URL,
      'SELECT u.id, u.username, u.email, u.role, u.email_verified FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1',
      [tokenHash]
    );
    if (rows && rows.length > 0) {
      return rows[0];
    }
  } catch (e) {}
  return null;
}

const RESERVED_NAMES = ['admin', 'administrator', 'system', 'whatscr', 'moderator', 'mod', 'root', 'support', 'official'];

async function sanitizeGuestName(name, databaseUrl) {
  if (!name || typeof name !== 'string') {
    return `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
  }
  let clean = name.trim().replace(/[^\w\s-]/g, '').slice(0, 24);
  if (clean.length < 2) {
    return `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
  }
  const lower = clean.toLowerCase();
  if (RESERVED_NAMES.includes(lower)) {
    return `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
  }
  try {
    const existing = await runNeonSql(databaseUrl, 'SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1', [clean]);
    if (existing && existing.length > 0) {
      return `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
    }
  } catch (e) {}
  return clean;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const ip = request.headers.get('CF-Connecting-IP') || 'anonymous';
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'rooms';

  if (!env.DATABASE_URL) {
    return jsonResponse({ error: 'DATABASE_URL not configured' }, 500);
  }

  await ensureForumTables(env.DATABASE_URL);

  const generalAllowed = await checkPersistentRateLimit(env.DATABASE_URL, `forum_req_${ip}`, 180, 60000);
  if (!generalAllowed) {
    return jsonResponse({ error: 'Too many requests, please slow down' }, 429);
  }

  if (request.method === 'GET' && action === 'rooms') {
    try {
      const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
      let rows;
      if (q) {
        rows = await runNeonSql(
          env.DATABASE_URL,
          `SELECT id, title, description, creator_name, creator_id, message_count, created_at, last_message_at
           FROM forum_rooms
           WHERE title ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%'
           ORDER BY last_message_at DESC
           LIMIT 50`,
          [q]
        );
      } else {
        rows = await runNeonSql(
          env.DATABASE_URL,
          `SELECT id, title, description, creator_name, creator_id, message_count, created_at, last_message_at
           FROM forum_rooms
           ORDER BY last_message_at DESC
           LIMIT 50`
        );
      }
      return jsonResponse({ rooms: rows || [] });
    } catch (err) {
      console.error('FORUM_ROOMS_ERROR:', err && err.message ? err.message : String(err));
      return jsonResponse({ error: 'Failed to fetch rooms' }, 500);
    }
  }

  if (request.method === 'GET' && action === 'room') {
    const roomId = url.searchParams.get('id');
    if (!roomId) return jsonResponse({ error: 'Room ID required' }, 400);
    try {
      const rows = await runNeonSql(
        env.DATABASE_URL,
        `SELECT id, title, description, creator_name, creator_id, message_count, created_at, last_message_at
         FROM forum_rooms
         WHERE id = $1
         LIMIT 1`,
        [roomId]
      );
      if (!rows || rows.length === 0) {
        return jsonResponse({ error: 'Room not found' }, 404);
      }
      return jsonResponse({ room: rows[0] });
    } catch (err) {
      console.error('FORUM_ROOM_ERROR:', err && err.message ? err.message : String(err));
      return jsonResponse({ error: 'Failed to fetch room' }, 500);
    }
  }

  if (request.method === 'POST' && action === 'create_room') {
    const sessionUser = await getSessionUser(request, env);
    if (!sessionUser) {
      return jsonResponse({ error: 'Devi essere loggato con un account verificato per creare una stanza.' }, 401);
    }

    if (!sessionUser.email_verified && sessionUser.role !== 'admin') {
      return jsonResponse({ error: 'Account non verificato. Verifica la tua email dal tuo profilo prima di creare stanze.' }, 403);
    }

    if (sessionUser.role !== 'admin') {
      const recentRooms = await runNeonSql(
        env.DATABASE_URL,
        `SELECT created_at FROM forum_rooms WHERE creator_id = $1 AND created_at > NOW() - INTERVAL '10 hours' ORDER BY created_at DESC LIMIT 1`,
        [sessionUser.id]
      );
      if (recentRooms && recentRooms.length > 0) {
        const lastCreated = new Date(recentRooms[0].created_at).getTime();
        const elapsed = Date.now() - lastCreated;
        const remainingMs = 10 * 3600 * 1000 - elapsed;
        const remainingHours = Math.floor(remainingMs / 3600000);
        const remainingMinutes = Math.ceil((remainingMs % 3600000) / 60000);
        const timeMsg = remainingHours > 0 ? `${remainingHours} ore e ${remainingMinutes} minuti` : `${remainingMinutes} minuti`;
        return jsonResponse({
          error: `Limite raggiunto: puoi creare una stanza solo ogni 10 ore. Riprova tra ${timeMsg}.`
        }, 429);
      }

      const ipAllowed = await checkPersistentRateLimit(env.DATABASE_URL, `forum_create_room_ip_${ip}`, 1, 36000000);
      if (!ipAllowed) {
        return jsonResponse({
          error: 'Limite raggiunto: e consentito creare solo 1 stanza ogni 10 ore da questa connessione.'
        }, 429);
      }
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ error: 'Invalid JSON payload' }, 400);
    }

    const title = (body.title || '').trim().replace(/[\r\n\t]/g, ' ').slice(0, 100);
    const description = (body.description || '').trim().slice(0, 240);

    if (title.length < 3) {
      return jsonResponse({ error: 'Il titolo deve contenere almeno 3 caratteri.' }, 400);
    }

    try {
      const inserted = await runNeonSql(
        env.DATABASE_URL,
        `INSERT INTO forum_rooms (title, description, creator_name, creator_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, title, description, creator_name, creator_id, message_count, created_at, last_message_at`,
        [title, description, sessionUser.username, sessionUser.id]
      );
      return jsonResponse({ success: true, room: inserted[0] }, 201);
    } catch (err) {
      console.error('FORUM_CREATE_ROOM_ERROR:', err && err.message ? err.message : String(err));
      return jsonResponse({ error: 'Failed to create room' }, 500);
    }
  }

  if (request.method === 'GET' && action === 'messages') {
    const roomId = url.searchParams.get('room_id');
    if (!roomId) return jsonResponse({ error: 'Room ID required' }, 400);
    const since = url.searchParams.get('since');

    try {
      let rows;
      if (since && !isNaN(Date.parse(since))) {
        rows = await runNeonSql(
          env.DATABASE_URL,
          `SELECT id, room_id, sender_name, sender_id, sender_role, is_guest, guest_id, content, reply_to_id, reply_to_sender, reply_to_text, created_at
           FROM forum_messages
           WHERE room_id = $1 AND created_at > $2
           ORDER BY created_at ASC
           LIMIT 100`,
          [roomId, since]
        );
      } else {
        rows = await runNeonSql(
          env.DATABASE_URL,
          `SELECT id, room_id, sender_name, sender_id, sender_role, is_guest, guest_id, content, reply_to_id, reply_to_sender, reply_to_text, created_at
           FROM (
             SELECT * FROM forum_messages
             WHERE room_id = $1
             ORDER BY created_at DESC
             LIMIT 80
           ) sub
           ORDER BY created_at ASC`,
          [roomId]
        );
      }
      return jsonResponse({ messages: rows || [] });
    } catch (err) {
      console.error('FORUM_MESSAGES_ERROR:', err && err.message ? err.message : String(err));
      return jsonResponse({ error: 'Failed to fetch messages' }, 500);
    }
  }

  if (request.method === 'POST' && action === 'send_message') {
    const msgRate = await checkPersistentRateLimit(env.DATABASE_URL, `forum_msg_${ip}`, 30, 60000);
    if (!msgRate) {
      return jsonResponse({ error: 'Slow down! Please wait a moment before sending another message.' }, 429);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ error: 'Invalid JSON payload' }, 400);
    }

    const roomId = body.room_id;
    const rawContent = (body.content || '').trim().slice(0, 800);
    const replyToId = body.reply_to_id || null;
    const clientGuestId = (body.guest_id || '').trim().slice(0, 64);

    if (!roomId) return jsonResponse({ error: 'Room ID required' }, 400);
    if (!rawContent) return jsonResponse({ error: 'Message content cannot be empty' }, 400);

    const sessionUser = await getSessionUser(request, env);
    let senderName = '';
    let senderId = null;
    let senderRole = 'user';
    let isGuest = true;
    let storedGuestId = null;

    if (sessionUser) {
      senderName = sessionUser.username;
      senderId = sessionUser.id;
      senderRole = sessionUser.role || 'user';
      isGuest = false;
      storedGuestId = null;
    } else {
      senderName = await sanitizeGuestName(body.guest_name, env.DATABASE_URL);
      isGuest = true;
      storedGuestId = clientGuestId || null;
    }

    let replyToSender = null;
    let replyToText = null;

    if (replyToId) {
      try {
        const replyRows = await runNeonSql(
          env.DATABASE_URL,
          `SELECT sender_name, content FROM forum_messages WHERE id = $1 AND room_id = $2 LIMIT 1`,
          [replyToId, roomId]
        );
        if (replyRows && replyRows.length > 0) {
          replyToSender = replyRows[0].sender_name;
          replyToText = (replyRows[0].content || '').slice(0, 140);
        }
      } catch (e) {}
    }

    try {
      const inserted = await runNeonSql(
        env.DATABASE_URL,
        `INSERT INTO forum_messages (room_id, sender_name, sender_id, sender_role, is_guest, guest_id, content, reply_to_id, reply_to_sender, reply_to_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, room_id, sender_name, sender_id, sender_role, is_guest, guest_id, content, reply_to_id, reply_to_sender, reply_to_text, created_at`,
        [roomId, senderName, senderId, senderRole, isGuest, storedGuestId, rawContent, replyToId, replyToSender, replyToText]
      );

      runNeonSql(
        env.DATABASE_URL,
        `UPDATE forum_rooms SET message_count = message_count + 1, last_message_at = NOW() WHERE id = $1`,
        [roomId]
      ).catch(() => {});

      runNeonSql(
        env.DATABASE_URL,
        `DELETE FROM forum_typing WHERE room_id = $1 AND user_name = $2`,
        [roomId, senderName]
      ).catch(() => {});

      return jsonResponse({ success: true, message: inserted[0] }, 201);
    } catch (err) {
      console.error('FORUM_SEND_ERROR:', err && err.message ? err.message : String(err));
      return jsonResponse({ error: 'Failed to send message' }, 500);
    }
  }

  if (request.method === 'POST' && action === 'typing') {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ error: 'Invalid JSON payload' }, 400);
    }

    const roomId = body.room_id;
    if (!roomId) return jsonResponse({ error: 'Room ID required' }, 400);

    const sessionUser = await getSessionUser(request, env);
    let userName = '';
    let userId = null;

    if (sessionUser) {
      userName = sessionUser.username;
      userId = sessionUser.id;
    } else {
      userName = (body.guest_name || 'Guest').trim().slice(0, 24);
    }

    try {
      await runNeonSql(
        env.DATABASE_URL,
        `INSERT INTO forum_typing (room_id, user_name, user_id, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (room_id, user_name) DO UPDATE
         SET updated_at = NOW()`,
        [roomId, userName, userId]
      );

      if (Math.random() < 0.1) {
        runNeonSql(env.DATABASE_URL, `DELETE FROM forum_typing WHERE updated_at < NOW() - INTERVAL '30 seconds'`).catch(() => {});
      }

      return jsonResponse({ success: true });
    } catch (err) {
      return jsonResponse({ error: 'Typing update failed' }, 500);
    }
  }

  if (request.method === 'GET' && action === 'typing') {
    const roomId = url.searchParams.get('room_id');
    const exclude = (url.searchParams.get('exclude') || '').trim();
    if (!roomId) return jsonResponse({ error: 'Room ID required' }, 400);

    try {
      const rows = await runNeonSql(
        env.DATABASE_URL,
        `SELECT user_name
         FROM forum_typing
         WHERE room_id = $1 AND updated_at > NOW() - INTERVAL '4 seconds' AND user_name != $2
         LIMIT 6`,
        [roomId, exclude]
      );
      const names = (rows || []).map(r => r.user_name);
      return jsonResponse({ typing: names });
    } catch (err) {
      return jsonResponse({ typing: [] });
    }
  }

  if (request.method === 'POST' && action === 'delete_message') {
    const sessionUser = await getSessionUser(request, env);
    if (!sessionUser) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ error: 'Invalid JSON payload' }, 400);
    }

    const messageId = body.message_id;
    if (!messageId) return jsonResponse({ error: 'Message ID required' }, 400);

    try {
      const msgRows = await runNeonSql(
        env.DATABASE_URL,
        `SELECT id, room_id, sender_id FROM forum_messages WHERE id = $1 LIMIT 1`,
        [messageId]
      );
      if (!msgRows || msgRows.length === 0) {
        return jsonResponse({ error: 'Message not found' }, 404);
      }
      const msg = msgRows[0];
      const isAdmin = sessionUser.role === 'admin';
      const isOwner = msg.sender_id && msg.sender_id === sessionUser.id;

      if (!isAdmin && !isOwner) {
        return jsonResponse({ error: 'Forbidden: You cannot delete this message' }, 403);
      }

      await runNeonSql(env.DATABASE_URL, `DELETE FROM forum_messages WHERE id = $1`, [messageId]);
      runNeonSql(
        env.DATABASE_URL,
        `UPDATE forum_rooms SET message_count = GREATEST(0, message_count - 1) WHERE id = $1`,
        [msg.room_id]
      ).catch(() => {});

      return jsonResponse({ success: true, deleted_id: messageId });
    } catch (err) {
      console.error('FORUM_DELETE_MSG_ERROR:', err && err.message ? err.message : String(err));
      return jsonResponse({ error: 'Failed to delete message' }, 500);
    }
  }

  if (request.method === 'POST' && action === 'delete_room') {
    const sessionUser = await getSessionUser(request, env);
    if (!sessionUser) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ error: 'Invalid JSON payload' }, 400);
    }

    const roomId = body.room_id;
    if (!roomId) return jsonResponse({ error: 'Room ID required' }, 400);

    try {
      const roomRows = await runNeonSql(
        env.DATABASE_URL,
        `SELECT id, creator_id FROM forum_rooms WHERE id = $1 LIMIT 1`,
        [roomId]
      );
      if (!roomRows || roomRows.length === 0) {
        return jsonResponse({ error: 'Room not found' }, 404);
      }
      const r = roomRows[0];
      const isAdmin = sessionUser.role === 'admin';
      const isOwner = r.creator_id && r.creator_id === sessionUser.id;

      if (!isAdmin && !isOwner) {
        return jsonResponse({ error: 'Forbidden: You cannot delete this room' }, 403);
      }

      await runNeonSql(env.DATABASE_URL, `DELETE FROM forum_rooms WHERE id = $1`, [roomId]);
      return jsonResponse({ success: true, deleted_id: roomId });
    } catch (err) {
      console.error('FORUM_DELETE_ROOM_ERROR:', err && err.message ? err.message : String(err));
      return jsonResponse({ error: 'Failed to delete room' }, 500);
    }
  }

  return jsonResponse({ error: 'Invalid endpoint or method' }, 404);
}
