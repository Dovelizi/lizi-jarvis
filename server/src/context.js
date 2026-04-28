import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { logger } from './logger.js';
import { fetchWeather } from './providers/weather/qweather.js';
import { getDb } from './state.js';

async function readFileSafe(p, fallback = '') {
  try { return await fs.readFile(p, 'utf8'); } catch (_) { return fallback; }
}

let _musicProvider = null;
export function setNowProvider(controller) { _musicProvider = controller; }

export async function ensureUserCorpus() {
  await fs.mkdir(config.USER_DIR, { recursive: true });
  const seeds = [
    ['taste.md',     '# taste.md\n\n- 喜欢：周杰伦、Harry Styles、Daft Punk、坂本龙一\n- 不喜欢：电子舞曲、网络口水歌\n- 场景：写作要白噪音 + 神经古典；做饭要 J-Rock；睡前要 ambient\n'],
    ['routines.md',  '# routines.md\n\n- 07:00 早间：天气 + 今日要做的事 + 一首入耳曲\n- 09:00 第一首歌：跟随今日心情\n- 整点：情绪扫描\n- 22:00 收尾：sleep playlist\n'],
    ['playlists.json', '[\n  { "name": "deep work", "tags": ["jazz-hiphop", "lo-fi"] },\n  { "name": "rainy night", "tags": ["post-rock", "ambient"] }\n]\n'],
    ['mood-rules.md','# mood-rules.md\n\n- 累 → 慢节奏 + 温暖人声\n- 嗨 → BPM 120+ 的 funk / disco\n- 想哭 → neo-classical 钢琴\n'],
    ['seed-songs.json', '[\n  { "name": "示例 · 七里香", "artist": "周杰伦", "addedAt": "2026-01-01" }\n]\n'],
  ];
  for (const [name, content] of seeds) {
    const p = path.join(config.USER_DIR, name);
    try { await fs.access(p); }
    catch (_) {
      await fs.writeFile(p, content, 'utf8');
      logger.info({ file: name }, 'seeded user corpus');
    }
  }
}

let _envCache = { ts: 0, value: null };
const ENV_TTL = 5 * 60 * 1000;

async function loadEnv() {
  const now = new Date();

  // 当前播放（实时，不缓存）
  let nowPlaying = null;
  try {
    const n = _musicProvider?.now?.();
    if (n?.song) nowPlaying = { name: n.song.name, artist: n.song.artist, state: n.state };
  } catch (_) {}

  // 天气（5min 缓存）
  let weather = _envCache.value?.weather;
  if (!_envCache.value || Date.now() - _envCache.ts > ENV_TTL) {
    weather = await fetchWeather().catch(() => null);
    _envCache = { ts: Date.now(), value: { weather } };
  }

  return {
    time: now.toISOString(),
    localTime: now.toString(),
    weekday: now.toLocaleDateString('en-US', { weekday: 'long' }),
    weather,
    nowPlaying,
    calendar: null,  // 飞书日历预留位（P1）
  };
}

async function loadTaste() {
  const p = (f) => path.join(config.USER_DIR, f);
  const [taste, routines, playlists, moodRules, seedSongs] = await Promise.all([
    readFileSafe(p('taste.md')),
    readFileSafe(p('routines.md')),
    readFileSafe(p('playlists.json'), '[]'),
    readFileSafe(p('mood-rules.md')),
    readFileSafe(p('seed-songs.json'), '[]'),
  ]);
  // seed-songs.json 是用户长期维护的"品味种子"歌单，brain 推荐时用它做风格参考
  return [
    taste     && `### taste.md\n${taste}`,
    routines  && `### routines.md\n${routines}`,
    moodRules && `### mood-rules.md\n${moodRules}`,
    playlists && `### playlists.json\n${playlists}`,
    seedSongs && `### seed-songs.json（我的种子歌单 · 推荐时优先参考相似风格）\n${seedSongs}`,
  ].filter(Boolean).join('\n\n');
}

/**
 * 第三层 ④「已检索记忆」
 * 简单实现：从 plays 表里取最近 N 首播放过的曲目 + 用户收藏的曲目
 * 让 Brain 避免重复推荐 + 知道用户实际听什么
 */
function retrieveMemory(_userInput) {
  try {
    const db = getDb();
    if (!db) return '';
    const recent = db.prepare(`
      SELECT name, artist, datetime(ts/1000, 'unixepoch', 'localtime') as t
      FROM plays ORDER BY ts DESC LIMIT 20
    `).all();
    const liked = db.prepare(`
      SELECT DISTINCT name, artist FROM plays
      WHERE liked = 1 ORDER BY ts DESC LIMIT 10
    `).all();
    const lines = [];
    if (recent.length) {
      lines.push('### 最近播放');
      lines.push(...recent.map(r => `- ${r.name} — ${r.artist}（${r.t}）`));
    }
    if (liked.length) {
      lines.push('\n### 收藏曲目');
      lines.push(...liked.map(r => `- ${r.name} — ${r.artist}`));
    }
    return lines.join('\n');
  } catch (e) {
    logger.debug({ err: e?.message }, 'retrieveMemory failed');
    return '';
  }
}

export async function buildContext({ userInput, recentMessages = [] }) {
  const [taste, env] = await Promise.all([loadTaste(), loadEnv()]);
  return {
    taste,
    env,
    memory: retrieveMemory(userInput),
    input: userInput,
    trace: recentMessages.map((m) => ({ role: m.role, text: m.text })),
  };
}
