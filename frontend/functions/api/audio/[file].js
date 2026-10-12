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

  if (!env.AUDIO_BUCKET) {
    return new Response('Audio storage service not configured', { status: 503 });
  }

  try {
    const object = await env.AUDIO_BUCKET.get(cleanFilename, {
      range: request.headers,
      onlyIf: request.headers
    });

    if (!object) {
      return new Response('File not found', { status: 404 });
    }

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
  } catch (err) {
    return new Response('Error retrieving audio stream', { status: 500 });
  }
}
