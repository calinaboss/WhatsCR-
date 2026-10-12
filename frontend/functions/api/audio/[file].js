export async function onRequestGet(context) {
  const { request, params, env } = context;
  const filename = params.file;

  if (!filename || typeof filename !== 'string') {
    return new Response('Not found', { status: 404 });
  }

  const cleanFilename = filename.trim();
  const safeNameRegex = /^[a-zA-Z0-9_\-\.]+\.(mp3|wav|ogg)$/i;
  if (!safeNameRegex.test(cleanFilename)) {
    return new Response('Invalid file request', { status: 400 });
  }

  if (env.AUDIO_BUCKET) {
    try {
      const object = await env.AUDIO_BUCKET.get(cleanFilename, {
        range: request.headers,
        onlyIf: request.headers
      });

      if (object) {
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Accept-Ranges', 'bytes');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');

        if (!headers.get('Content-Type')) {
          if (cleanFilename.endsWith('.wav')) {
            headers.set('Content-Type', 'audio/wav');
          } else if (cleanFilename.endsWith('.ogg')) {
            headers.set('Content-Type', 'audio/ogg');
          } else {
            headers.set('Content-Type', 'audio/mpeg');
          }
        }

        const status = object.body ? (request.headers.get('range') ? 206 : 200) : 304;

        return new Response(object.body, {
          status: status,
          headers: headers
        });
      }
    } catch (r2Err) {}
  }

  if (env.DATABASE_URL) {
    try {
      const dbUrl = new URL(env.DATABASE_URL);
      const endpoint = `https://${dbUrl.host}/sql`;
      const sql = "SELECT encode(data, 'base64') as b64, mime_type FROM audio_files WHERE filename = $1 LIMIT 1";

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

          const rangeHeader = request.headers.get('range');
          if (rangeHeader && rangeHeader.startsWith('bytes=')) {
            const parts = rangeHeader.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10) || 0;
            const end = parts[1] ? parseInt(parts[1], 10) : len - 1;
            const chunk = bytes.slice(start, end + 1);

            return new Response(chunk, {
              status: 206,
              headers: {
                'Content-Type': row.mime_type || 'audio/mpeg',
                'Content-Range': `bytes ${start}-${end}/${len}`,
                'Content-Length': chunk.length.toString(),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=31536000, immutable'
              }
            });
          }

          return new Response(bytes, {
            status: 200,
            headers: {
              'Content-Type': row.mime_type || 'audio/mpeg',
              'Content-Length': len.toString(),
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=31536000, immutable'
            }
          });
        }
      }
    } catch (dbErr) {}
  }

  return new Response('File not found', { status: 404 });
}
