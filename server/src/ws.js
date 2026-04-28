import { logger } from './logger.js';

const clients = new Set();

export function attachWS(wss) {
  wss.on('connection', (ws) => {
    clients.add(ws);
    logger.debug({ size: clients.size }, 'ws client connected');
    ws.send(JSON.stringify({ type: 'hello', ts: Date.now() }));
    ws.on('close', () => {
      clients.delete(ws);
      logger.debug({ size: clients.size }, 'ws client closed');
    });
    ws.on('error', (e) => logger.warn({ err: e?.message }, 'ws error'));
  });
}

export function broadcast(evt) {
  const data = JSON.stringify(evt);
  for (const c of clients) {
    if (c.readyState === 1) {
      try { c.send(data); } catch (_) { /* ignore */ }
    }
  }
}
