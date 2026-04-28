import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { MockProvider } from './mock.js';
import { QQMusicProvider } from './qq.js';

// 抽象基类从 base.js 转出（避免循环依赖）
export { MusicProvider } from './base.js';

export function createMusicProvider() {
  const want = config.MUSIC_PROVIDER;
  if (want === 'qq' && config.QQ_MUSIC_COOKIE) {
    try {
      logger.info('music provider = QQ (cookie configured)');
      return new QQMusicProvider(config.QQ_MUSIC_COOKIE);
    } catch (e) {
      logger.error({ err: e?.message }, 'QQ provider init failed, fallback to mock');
    }
  }
  logger.warn({ want, hasCookie: !!config.QQ_MUSIC_COOKIE }, 'music provider = MOCK');
  return new MockProvider();
}

/**
 * 播放控制器：聚合 provider + 内存中的当前曲与队列
 * 第一期为单实例内存态；F-015 持久化在 plays 表里只记播放历史与收藏
 */
export class PlaybackController {
  constructor(provider) {
    this.provider = provider;
    this._now = null;          // { songId, name, artist, url, lyric }
    this._queue = [];          // [{ songId, name, artist, duration }]
    this._state = 'idle';      // idle | playing | paused
    this._volume = 80;
  }

  now() {
    return { song: this._now, state: this._state, volume: this._volume };
  }
  queue() { return this._queue.slice(); }

  async enqueue(items) {
    // items: [{ name, artist, songId? }]
    const resolved = [];
    for (const it of items) {
      if (it.songId) { resolved.push(it); continue; }
      try {
        const list = await this.provider.search(`${it.name} ${it.artist || ''}`.trim());
        if (list[0]) resolved.push(list[0]);
      } catch (e) {
        // 搜不到就跳过；不阻塞整体
      }
    }
    // 去重：同批内 + 与现有队列 + 与当前正在播的歌
    this._queue = dedupSongs([...this._queue, ...resolved], this._now);
    return this._queue.slice();
  }

  async handle(intent) {
    switch (intent.op) {
      case 'play': {
        const list = await this.provider.search(intent.arg || '');
        if (!list.length) return { say: `没找到「${intent.arg}」` };
        const head = list[0];
        // 候选队列：去掉与首歌重名的版本，最多保留 5 首
        const tail = dedupSongs(list.slice(1), head).slice(0, 5);
        this._queue = tail;
        await this._loadAndPlay(head);
        return { say: `好，给你放 ${head.name} — ${head.artist}`, song: this._now, queue: this._queue };
      }
      case 'next': {
        const next = this._queue.shift();
        if (!next) return { say: '队列空了' };
        await this._loadAndPlay(next);
        return { say: '下一首', song: this._now, queue: this._queue };
      }
      case 'prev':   return { say: '上一首功能在 v1.1 开放' };
      case 'pause':  this._state = 'paused';  return { say: '暂停', song: this._now };
      case 'resume': this._state = 'playing'; return { say: '继续', song: this._now };
      case 'stop':   this._state = 'idle'; this._now = null; return { say: '停止' };
      case 'like':   return { say: '已收藏' };
      case 'volume': this._volume = Math.max(0, Math.min(100, Number(intent.arg) || 80)); return { say: `音量 ${this._volume}` };
      default:       return { say: '我没听懂这个控制指令' };
    }
  }

  async _loadAndPlay(song) {
    let url = song.url;
    let lyric = song.lyric;
    try { if (!url)   url   = await this.provider.getUrl(song.songId); } catch (_) {}
    try { if (!lyric) lyric = await this.provider.getLyric(song.songId); } catch (_) {}
    this._now = { ...song, url, lyric };
    this._state = 'playing';
  }
}

/**
 * 歌曲去重：保序，按归一化歌名比对（同名异艺人也视为同一首，保留首次出现）
 * - 已存在的（含 exclude 当前曲）会被跳过
 * - 同一批内重复也会被去除
 *
 *   dedupSongs([a, b, a, c], curr)  →  [a, b, c] （若 curr=a，则 [b, c]）
 *
 * 归一化策略：
 *  - 小写
 *  - 去括号注释：(2023星盛典现场) / (Live) / (能量流) 等
 *  - 去所有空白
 *  - 仅按歌名比对（artist 不参与），避免"云烟成雨 - 房东的猫"和
 *    "云烟成雨 - 李珺瑶"被识别为两首
 */
function normalizeKey(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[（(][^）)]*[）)]/g, '')   // 去括号注释（中英文括号）
    .replace(/\s+/g, '')                 // 去所有空白
    .trim();
}

function songKey(s) {
  if (!s) return '';
  // 仅按歌名归一化作为去重键
  // 注：songId 不参与，因为 QQ 不同版本的同名歌有不同 songId（这正是问题来源）
  return 'name:' + normalizeKey(s.name);
}

function dedupSongs(list, exclude) {
  const seen = new Set();
  if (exclude) {
    const k = songKey(exclude);
    if (k) seen.add(k);
  }
  const out = [];
  for (const s of list) {
    const k = songKey(s);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}
