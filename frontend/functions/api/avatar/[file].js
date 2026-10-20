export async function onRequestGet(context) {
  const { request, params, env } = context;
  const filename = params.file;

  if (!filename || typeof filename !== 'string') {
    return new Response('Not found', { status: 404 });
  }

  const cleanFilename = filename.trim();
  const safeNameRegex = /^[a-f0-9\-]{36}\.(jpg|png|webp)$/i;
  if (!safeNameRegex.test(cleanFilename)) {
    return new Response('Invalid file request', { status: 400 });
  }

  let contentType = 'image/jpeg';
  if (cleanFilename.endsWith('.png')) {
    contentType = 'image/png';
  } else if (cleanFilename.endsWith('.webp')) {
    contentType = 'image/webp';
  }

  if (env.AVATAR_BUCKET) {
    try {
      const object = await env.AVATAR_BUCKET.get(cleanFilename);
      if (object && object.body) {
        return new Response(object.body, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'X-Content-Type-Options': 'nosniff',
            'Content-Disposition': 'inline',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
            'Cross-Origin-Resource-Policy': 'cross-origin'
          }
        });
      }
    } catch (bucketErr) {}
  } else if (env.AUDIO_BUCKET) {
    try {
      const object = await env.AUDIO_BUCKET.get(`avatars/${cleanFilename}`);
      if (object && object.body) {
        return new Response(object.body, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'X-Content-Type-Options': 'nosniff',
            'Content-Disposition': 'inline',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
            'Cross-Origin-Resource-Policy': 'cross-origin'
          }
        });
      }
    } catch (bucketErr) {}
  }

  if (env.DATABASE_URL) {
    try {
      const dbUrl = new URL(env.DATABASE_URL);
      const endpoint = `https://${dbUrl.host}/sql`;
      const sql = "SELECT encode(data, 'base64') as b64, mime_type FROM avatar_files WHERE filename = $1 LIMIT 1";

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Neon-Connection-String': env.DATABASE_URL
        },
        body: JSON.stringify({ query: sql, params: [cleanFilename] })
      });

      if (res.ok) {
        const data = await res.json();
        let rows = [];
        if (data && Array.isArray(data.rows)) {
          rows = data.rows;
        } else if (Array.isArray(data) && data[0] && Array.isArray(data[0].rows)) {
          rows = data[0].rows;
        }

        if (rows.length > 0) {
          const row = rows[0];
          const binaryString = atob(row.b64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          return new Response(bytes, {
            status: 200,
            headers: {
              'Content-Type': row.mime_type || contentType,
              'X-Content-Type-Options': 'nosniff',
              'Content-Disposition': 'inline',
              'Content-Length': len.toString(),
              'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
              'Cross-Origin-Resource-Policy': 'cross-origin'
            }
          });
        }
      }
    } catch (dbErr) {}
  }

  return new Response('File not found', { status: 404 });
}
