import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { MusicProvider } from './base.js';

/**
 * MockProvider：Cookie 未配置时的兜底
 * 资源目录：server/data/mock/  下放 .mp3 + 同名 .json（{ name, artist, lyric }）
 */
export class MockProvider extends MusicProvider {
  constructor() {
    super();
    this.dir = path.join(config.DATA_DIR, 'mock');
    fs.mkdirSync(this.dir, { recursive: true });
    // 若目录为空，给一个占位 demo（无音频，仅元数据）便于前端联调
    this._library = this._loadLibrary();
  }

  _loadLibrary() {
    const items = [];
    try {
      for (const f of fs.readdirSync(this.dir)) {
        if (!f.endsWith('.mp3')) continue;
        const base = f.slice(0, -4);
        const metaPath = path.join(this.dir, base + '.json');
        let meta = { name: base, artist: 'Unknown' };
        if (fs.existsSync(metaPath)) {
          try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (_) {}
        }
        items.push({
          songId: 'mock-' + base,
          name: meta.name,
          artist: meta.artist,
          duration: meta.duration ?? 180,
          url: `/static/mock/${encodeURIComponent(f)}`,
          lyric: meta.lyric || '',
        });
      }
    } catch (e) {
      logger.warn({ err: e?.message }, 'mock library load failed');
    }
    if (!items.length) {
      // 占位条目，前端不会真正能播放，但保证 UI 链路通
      items.push({
        songId: 'mock-demo-1',
        name: 'Mock Track 1',
        artist: 'Claudio Mock',
        duration: 180,
        url: '',
        lyric: '',
      });
    }
    return items;
  }

  async search(keyword) {
    const k = (keyword || '').trim().toLowerCase();
    if (!k) return this._library.slice(0, 5);
    return this._library.filter(s =>
      s.name.toLowerCase().includes(k) || s.artist.toLowerCase().includes(k)
    ).slice(0, 5);
  }
  async getUrl(songId)   { return this._library.find(s => s.songId === songId)?.url   || ''; }
  async getLyric(songId) { return this._library.find(s => s.songId === songId)?.lyric || ''; }
  async recommend()      { return this._library.slice(0, 5); }
}
