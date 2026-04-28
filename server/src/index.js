import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { WebSocketServer } from 'ws';

import { config, summarizeConfig } from './config.js';
import { logger } from './logger.js';
import { initState } from './state.js';
import { mountRoutes } from './router.js';
import { attachWS } from './ws.js';
import { startScheduler, setSchedulerMusic } from './scheduler.js';
import { ensureUserCorpus, setNowProvider } from './context.js';
import { createMusicProvider, PlaybackController } from './providers/music/index.js';
import { mountTtsRoutes } from './providers/tts/index.js';

async function main() {
  summarizeConfig();
  initState();
  await ensureUserCorpus();

  const provider = createMusicProvider();
  const music = new PlaybackController(provider);
  setNowProvider(music);   // context.js 注入当前播放
  setSchedulerMusic(music); // scheduler 注入 controller，用于推歌入队

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use((req, _res, next) => { logger.debug({ m: req.method, u: req.url }, 'http'); next(); });

  // Mock 资源静态服务
  const mockDir = path.join(config.DATA_DIR, 'mock');
  if (fs.existsSync(mockDir)) app.use('/static/mock', express.static(mockDir));

  mountRoutes(app, { music });
  mountTtsRoutes(app);

  // 生产模式：直接吐 PWA build
  if (fs.existsSync(config.PWA_DIST)) {
    app.use(express.static(config.PWA_DIST));
    app.get('*', (_req, res) => res.sendFile(path.join(config.PWA_DIST, 'index.html')));
  }

  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/stream' });
  attachWS(wss);

  startScheduler();

  server.listen(config.PORT, config.HOST, () => {
    logger.info({ url: `http://${config.HOST}:${config.PORT}` }, 'Claudio is on air');
  });
}

main().catch((e) => {
  logger.fatal({ err: e?.stack || e?.message }, 'fatal');
  process.exit(1);
});
