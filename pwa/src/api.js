const BASE = '';

async function jget(path) {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function jsend(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${path} HTTP ${r.status}`);
  return r.json();
}

export const api = {
  health:       () => jget('/api/health'),
  now:          () => jget('/api/now'),
  next:         () => jget('/api/next'),
  taste:        () => jget('/api/taste'),
  plan:         () => jget('/api/plan/today'),
  messages:     (limit = 50) => jget(`/api/messages?limit=${limit}`),
  clearHistory: () => jsend('DELETE', '/api/messages'),
  chat:         (text) => jsend('POST', '/api/chat', { text }),
  chatStream:   (text) => jsend('POST', '/api/chat/stream', { text }),
  configGet:    () => jget('/api/config'),
  configPut:    (prefs) => jsend('PUT', '/api/config', { prefs }),
  weather:      () => jget('/api/weather'),
  daily:        (force = false) => jget('/api/daily' + (force ? '?force=1' : '')),
  lyric:        (songId) => jget('/api/lyric' + (songId ? `?songId=${encodeURIComponent(songId)}` : '')),
  seedList:     () => jget('/api/seed-songs'),
  seedAdd:      (name, artist) => jsend('POST',   '/api/seed-songs', { name, artist }),
  seedRemove:   (name, artist) => jsend('DELETE', '/api/seed-songs', { name, artist }),
};

export function openStream(onMsg) {
  let ws;
  let alive = true;
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/stream`;

  const connect = () => {
    ws = new WebSocket(url);
    ws.onopen    = () => onMsg({ type: '__open__' });
    ws.onmessage = (e) => { try { onMsg(JSON.parse(e.data)); } catch (_) {} };
    ws.onclose   = () => {
      onMsg({ type: '__close__' });
      if (alive) setTimeout(connect, 2000);
    };
    ws.onerror   = () => { try { ws.close(); } catch (_) {} };
  };
  connect();
  return () => { alive = false; ws && ws.close(); };
}
