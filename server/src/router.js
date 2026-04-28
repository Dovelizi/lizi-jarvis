import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { logger } from './logger.js';
import { saveMessage, recentMessages, stmt, getDb } from './state.js';
import { broadcast } from './ws.js';
import { claude, safeParseBrainOutput } from './claude.js';
import { buildContext } from './context.js';

// 意图分流
const PLAY_PATTERNS = [
  { re: /^播放\s*(.+)/i,    op: 'play',     argIdx: 1 },
  { re: /^来一首\s*(.+)/,   op: 'play',     argIdx: 1 },
  { re: /^换一首/,          op: 'next' },
  { re: /^下一首/,          op: 'next' },
  { re: /^上一首/,          op: 'prev' },
  { re: /^暂停/,            op: 'pause' },
  { re: /^继续/,            op: 'resume' },
  { re: /^停止/,            op: 'stop' },
  { re: /^收藏/,            op: 'like' },
  { re: /^音量\s*(\d+)/,    op: 'volume',   argIdx: 1 },
];

export function classifyIntent(text) {
  for (const p of PLAY_PATTERNS) {
    const m = text.match(p.re);
    if (m) return { kind: 'control', op: p.op, arg: p.argIdx ? m[p.argIdx] : undefined };
  }
  return { kind: 'chat' };
}

export function mountRoutes(app, { music }) {
  // ---- POST /api/chat（整段响应，保留兼容）----
  app.post('/api/chat', async (req, res) => {
    const { text } = req.body || {};
    if (typeof text !== 'string' || !text.trim() || text.length > 2000) {
      return res.status(400).json({ error: 'invalid text' });
    }

    const intent = classifyIntent(text);

    // 控制类：完全沉默 —— 不写聊天历史、不 broadcast 任何文本
    // （用户操作的是按钮/列表，已知道自己在做什么；不需要在聊天框里复述）
    if (intent.kind === 'control') {
      try {
        const r = await music.handle(intent);
        if (r?.song)  broadcast({ type: 'now_changed', song: r.song });
        if (r?.queue) broadcast({ type: 'queue_changed', queue: r.queue });
        return res.json({ ok: true, song: r?.song, queue: r?.queue });
      } catch (e) {
        return res.status(500).json({ error: 'music control failed' });
      }
    }

    // 自然语言对话：保留原有写聊天历史 + 广播
    saveMessage('user', text);
    try {
      const ctx = await buildContext({ userInput: text, recentMessages: recentMessages(20) });
      const raw = await claude.ask(ctx);
      const parsed = safeParseBrainOutput(raw);
      if (parsed.play?.length) {
        try { await music.enqueue(parsed.play); } catch (_) {}
      }
      saveMessage('bot', parsed.say, parsed);
      broadcast({ type: 'claudio_say', ts: Date.now(), text: parsed.say, play: parsed.play });
      return res.json(parsed);
    } catch (e) {
      const fallback = { say: '我在打盹，稍后再聊', play: [], reason: 'brain unavailable' };
      saveMessage('bot', fallback.say, fallback);
      return res.json(fallback);
    }
  });

  // ---- POST /api/chat/stream（WS 流式推送）----
  // 请求立即返回 { streamId }；真实内容通过 WS claudio_stream_* 事件流到达
  app.post('/api/chat/stream', async (req, res) => {
    const { text } = req.body || {};
    if (typeof text !== 'string' || !text.trim() || text.length > 2000) {
      return res.status(400).json({ error: 'invalid text' });
    }

    const streamId = `s_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    res.json({ streamId });

    const intent = classifyIntent(text);

    // 控制类：完全沉默 —— 不写聊天历史、不广播文本（用户操作已被 UI 反馈）
    if (intent.kind === 'control') {
      (async () => {
        try {
          const r = await music.handle(intent);
          if (r?.song)  broadcast({ type: 'now_changed', song: r.song });
          if (r?.queue) broadcast({ type: 'queue_changed', queue: r.queue });
          // 显式终止占位 stream（如前端有 stream_start 也无需保留占位）
          broadcast({ type: 'claudio_stream_end', streamId, final: { say: '', play: [], silent: true } });
        } catch (e) {
          broadcast({ type: 'claudio_stream_error', streamId, error: String(e?.message || e) });
        }
      })();
      return;
    }

    // 自然语言对话：写用户消息到历史
    saveMessage('user', text);

    // chat 流式
    (async () => {
      broadcast({ type: 'claudio_stream_start', streamId, ts: Date.now() });
      try {
        const ctx = await buildContext({ userInput: text, recentMessages: recentMessages(20) });
        const parsed = await claude.askStream(ctx, (delta, full) => {
          broadcast({ type: 'claudio_stream_delta', streamId, delta, full });
        });
        // 推荐了歌曲：enqueue 入队 + 自动播放第一首（如当前没在播）
        // 前端会先播 TTS（say）、再切音乐（needTtsIntro=true 时延迟 now_changed 处理）
        let triggeredPlay = false;
        if (parsed.play?.length) {
          try {
            await music.enqueue(parsed.play);
            // 当前空闲 → 自动 next 播第一首
            if (!music.now()?.song || music.now()?.state === 'idle') {
              const r = await music.handle({ kind: 'control', op: 'next' });
              if (r?.song) {
                broadcast({ type: 'now_changed', song: r.song });
                triggeredPlay = true;
              }
              if (r?.queue) broadcast({ type: 'queue_changed', queue: r.queue });
            } else {
              broadcast({ type: 'queue_changed', queue: music.queue() });
            }
          } catch (_) {}
        }
        saveMessage('bot', parsed.say, parsed);
        // needTtsIntro：前端拿到 stream_end 后，先用 TTS 念 say，结束再播音乐
        broadcast({
          type: 'claudio_stream_end',
          streamId,
          final: { ...parsed, needTtsIntro: !!(triggeredPlay && parsed.say) },
        });
      } catch (e) {
        logger.error({ err: e?.message }, 'stream chat failed');
        broadcast({ type: 'claudio_stream_error', streamId, error: 'brain error' });
      }
    })();
  });

  // ---- GET /api/now ----
  app.get('/api/now', (_req, res) => res.json(music.now()));

  // ---- GET /api/next ----
  app.get('/api/next', (_req, res) => res.json({ queue: music.queue() }));

  // ---- GET /api/taste ----
  app.get('/api/taste', async (_req, res) => {
    const read = (f, fallback = '') => fs.readFile(path.join(config.USER_DIR, f), 'utf8').catch(() => fallback);
    const [taste, routines, playlistsRaw, moodRules] = await Promise.all([
      read('taste.md'), read('routines.md'), read('playlists.json', '[]'), read('mood-rules.md'),
    ]);
    let playlists = [];
    try { playlists = JSON.parse(playlistsRaw); } catch (_) {}
    res.json({ taste, routines, playlists, moodRules });
  });

  // ---- GET /api/plan/today ----
  app.get('/api/plan/today', (_req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const row = stmt.getPlan().get(today);
    res.json({ date: today, blocks: row ? JSON.parse(row.blocks) : [] });
  });

  // ---- GET /api/messages ----
  app.get('/api/messages', (req, res) => {
    const n = Math.min(Number(req.query.limit) || 50, 200);
    res.json({ messages: recentMessages(n) });
  });

  // ---- DELETE /api/messages（清空历史，Settings 用）----
  app.delete('/api/messages', (_req, res) => {
    getDb().exec('DELETE FROM messages;');
    res.json({ ok: true });
  });

  // ---- GET /api/config（Settings 读）----
  app.get('/api/config', (_req, res) => {
    res.json({
      musicProvider: config.MUSIC_PROVIDER,
      hasQQCookie:   !!config.QQ_MUSIC_COOKIE,
      ttsProvider:   config.TTS_PROVIDER,
      scheduler: {
        morning_brief: '07:00',
        first_track:   '09:00',
        hourly_mood:   'hourly',
        wrap_up:       '22:00',
      },
      prefs: readPrefs(),
    });
  });

  // ---- PUT /api/config（Settings 写，仅 prefs 可热改；provider/密钥改 .env）----
  app.put('/api/config', (req, res) => {
    const { prefs } = req.body || {};
    if (prefs && typeof prefs === 'object') {
      for (const [k, v] of Object.entries(prefs)) {
        stmt.setPref().run(k, JSON.stringify(v));
      }
    }
    res.json({ ok: true, prefs: readPrefs() });
  });

  // ---- GET /api/health ----
  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

  // ---- GET /api/weather（B 区天气卡）----
  app.get('/api/weather', async (_req, res) => {
    try {
      const { fetchWeather } = await import('./providers/weather/qweather.js');
      const w = await fetchWeather();
      if (!w) return res.json({ available: false });
      res.json({ available: true, ...w, location: config.QWEATHER_LOCATION });
    } catch (e) {
      res.json({ available: false, error: e?.message });
    }
  });

  // ---- GET /api/daily（C 区每日一言）每日一次 Brain 调用 + 缓存 ----
  // ?force=1 跳过缓存强制重生成
  app.get('/api/daily', async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = 'daily_quote:' + today;
    const force = req.query?.force === '1' || req.query?.force === 'true';

    // 先查缓存（force 时跳过）
    if (!force) {
      try {
        const row = stmt.getPref().get(cacheKey);
        if (row?.v) {
          try { return res.json({ ...JSON.parse(row.v), cached: true }); } catch (_) {}
        }
      } catch (_) {}
    }

    // 没缓存 → 调 Brain
    try {
      const ctx = await buildContext({
        userInput: '请用一句话给我今天的「每日一言」。要求：基于我的 taste 和今天的天气、星期、心情主题；中文；25 字以内；带一点电台 DJ 的腔调；JSON schema 仍是 {"say":"一句话","play":[],"reason":"为什么挑这句"}。',
        recentMessages: [],
      });
      const raw = await claude.ask(ctx);
      const parsed = safeParseBrainOutput(raw);
      const result = { date: today, quote: parsed.say || '今天也是值得听首歌的日子。', reason: parsed.reason || '' };
      try { stmt.setPref().run(cacheKey, JSON.stringify(result)); } catch (_) {}
      res.json({ ...result, cached: false });
    } catch (e) {
      res.json({ date: today, quote: '今天也是值得听首歌的日子。', cached: false, error: 'brain unavailable' });
    }
  });
  // ---- GET /api/lyric（当前/指定歌曲的 LRC 歌词）----
  // 调用顺序：1) 缓存命中（_now.lyric 非空）  2) 回源 provider.getLyric(songId)
  app.get('/api/lyric', async (req, res) => {
    let songId = (req.query?.songId || '').toString().trim();
    try {
      const nowSong = music?.now?.()?.song;
      // 未指定 songId → 用当前播放的 songId
      if (!songId && nowSong?.songId) songId = nowSong.songId;

      // 优先使用 _now 缓存的歌词（仅当请求的就是当前歌且缓存非空）
      if (nowSong && nowSong.songId === songId && nowSong.lyric) {
        return res.json({ songId, lyric: nowSong.lyric, cached: true });
      }

      // 回源 provider
      if (songId && music?.provider?.getLyric) {
        const lyric = await music.provider.getLyric(songId);
        // 回填 _now.lyric 缓存（避免下次再请求）
        if (lyric && nowSong && nowSong.songId === songId) {
          nowSong.lyric = lyric;
        }
        return res.json({ songId, lyric: lyric || '', cached: false });
      }
      res.json({ songId: songId || '', lyric: '', cached: false });
    } catch (e) {
      res.json({ songId: songId || '', lyric: '', error: e?.message || 'unknown' });
    }
  });

  // ───── seed-songs（用户长期种子歌单）─────
  // 文件路径：USER_DIR/seed-songs.json
  // 格式：[{ name, artist, addedAt }]
  // 与 brain 上下文（loadTaste）共享同一份文件
  const seedFile = () => path.join(config.USER_DIR, 'seed-songs.json');

  app.get('/api/seed-songs', async (_req, res) => {
    try {
      const list = await readSeedSongs(seedFile());
      res.json({ songs: list });
    } catch (e) {
      res.status(500).json({ error: e?.message || 'read failed' });
    }
  });

  app.post('/api/seed-songs', async (req, res) => {
    const { name, artist } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.length > 200) {
      return res.status(400).json({ error: 'invalid name' });
    }
    const safeName = name.trim();
    const safeArtist = (typeof artist === 'string' ? artist : '').trim().slice(0, 200);
    try {
      const list = await readSeedSongs(seedFile());
      const key = normalizeSeedKey(safeName, safeArtist);
      if (list.some(s => normalizeSeedKey(s.name, s.artist) === key)) {
        // 已存在 → 视为成功（幂等）
        return res.json({ ok: true, songs: list, added: false });
      }
      list.unshift({
        name:    safeName,
        artist:  safeArtist,
        addedAt: new Date().toISOString().slice(0, 10),
      });
      await writeSeedSongs(seedFile(), list);
      res.json({ ok: true, songs: list, added: true });
    } catch (e) {
      res.status(500).json({ error: e?.message || 'write failed' });
    }
  });

  app.delete('/api/seed-songs', async (req, res) => {
    const { name, artist } = req.body || {};
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'invalid name' });
    }
    try {
      const list = await readSeedSongs(seedFile());
      const key = normalizeSeedKey(name.trim(), (artist || '').trim());
      const next = list.filter(s => normalizeSeedKey(s.name, s.artist) !== key);
      const removed = next.length !== list.length;
      if (removed) await writeSeedSongs(seedFile(), next);
      res.json({ ok: true, songs: next, removed });
    } catch (e) {
      res.status(500).json({ error: e?.message || 'write failed' });
    }
  });
}

// ───── seed-songs helpers ─────
function normalizeSeedKey(name, artist) {
  const norm = (s) => String(s ?? '')
    .toLowerCase()
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\s+/g, '')
    .trim();
  return norm(name) + '|' + norm(artist);
}

async function readSeedSongs(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // 过滤合法记录（必须有 name；artist/addedAt 可缺）
    return arr.filter(s => s && typeof s.name === 'string' && s.name.trim());
  } catch (_) {
    return [];
  }
}

async function writeSeedSongs(filePath, list) {
  // 排序：addedAt 倒序（最近收藏在前），无 addedAt 排最后
  const sorted = list.slice().sort((a, b) => {
    const ta = a.addedAt || '';
    const tb = b.addedAt || '';
    return tb.localeCompare(ta);
  });
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}

function readPrefs() {
  try {
    const rows = getDb().prepare('SELECT k, v FROM prefs').all();
    const out = {};
    for (const { k, v } of rows) {
      try { out[k] = JSON.parse(v); } catch { out[k] = v; }
    }
    return out;
  } catch (_) { return {}; }
}
