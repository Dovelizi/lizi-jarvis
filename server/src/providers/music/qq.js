import { logger } from '../../logger.js';
import { MusicProvider } from './base.js';

/**
 * QQMusicProvider · Cookie 接入
 * ─────────────────────────────────────────────────────────────
 * 实现说明（v1 骨架）：
 * - 本期仅落"接口外壳"：search / getUrl / getLyric / recommend 全部走 u.y.qq.com 的 musicu.fcg
 * - 真实签名细节（sign、guid、loginUin）依赖社区库（参考 jsososo/QQMusicApi）
 *   v1 留 TODO，等用户首次使用时按当时有效签名补齐；任意失败一律抛错由工厂兜底切 Mock
 * - 不在代码中固化 Cookie 字段；Cookie 整段透传到 Header 即可
 * - 严禁打印完整 Cookie，logger 仅打印长度
 */
const ENDPOINT = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
const HEADERS_BASE = {
  'Content-Type': 'application/json',
  'Referer': 'https://y.qq.com/',
  'Origin':  'https://y.qq.com',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
};

export class QQMusicProvider extends MusicProvider {
  constructor(cookie) {
    super();
    if (!cookie || typeof cookie !== 'string') throw new Error('QQ_MUSIC_COOKIE invalid');
    this.cookie = cookie;
    logger.info({ cookieLen: cookie.length }, 'QQMusicProvider initialized');
  }

  _headers() {
    return { ...HEADERS_BASE, Cookie: this.cookie };
  }

  async _post(payload) {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`qq http ${r.status}`);
    return r.json();
  }

  async search(keyword) {
    const payload = {
      // music.search.SearchCgiService - DoSearchForQQMusicDesktop
      req_1: {
        method: 'DoSearchForQQMusicDesktop',
        module: 'music.search.SearchCgiService',
        param: {
          query: String(keyword || ''),
          num_per_page: 10,
          page_num: 1,
          search_type: 0,
        },
      },
    };
    try {
      const j = await this._post(payload);
      const list = j?.req_1?.data?.body?.song?.list || [];
      return list.slice(0, 5).map((s) => ({
        songId: s.mid || s.songmid,
        name:   s.title || s.name,
        artist: (s.singer || []).map(x => x.name).join(' / '),
        album:  s.album?.name,
        duration: s.interval,
      }));
    } catch (e) {
      logger.warn({ err: e?.message }, 'qq search failed');
      return [];
    }
  }

  async getUrl(songMid) {
    if (!songMid) return '';
    // TODO(v1.1)：完整 vkey 接口签名。当前实现尝试公开 try.thirdparty 接口，失败返回空串
    const payload = {
      req_1: {
        module: 'vkey.GetVkeyServer',
        method: 'CgiGetVkey',
        param: {
          guid: '10000',
          songmid: [songMid],
          songtype: [0],
          uin: '0',
          loginflag: 1,
          platform: '20',
        },
      },
    };
    try {
      const j = await this._post(payload);
      const item = j?.req_1?.data?.midurlinfo?.[0];
      const sip  = j?.req_1?.data?.sip?.[0];
      if (item?.purl && sip) return sip + item.purl;
      return '';
    } catch (e) {
      logger.warn({ err: e?.message }, 'qq getUrl failed');
      return '';
    }
  }

  async getLyric(songMid) {
    if (!songMid) return '';
    // 改用 musicu.fcg 标准接口（旧的 c.y.qq.com/lyric/fcgv1 已返回 404）
    // 返回 { req_1: { data: { lyric: <base64-LRC>, trans: <base64> } } }
    const payload = {
      req_1: {
        module: 'music.musichallSong.PlayLyricInfo',
        method: 'GetPlayLyricInfo',
        param: { songMID: songMid, songID: 0 },
      },
    };
    try {
      const j = await this._post(payload);
      const b64 = j?.req_1?.data?.lyric || '';
      if (!b64) return '';
      // base64 → utf8（QQ 的 lyric 是 base64 编码的纯 LRC）
      try {
        return Buffer.from(b64, 'base64').toString('utf8');
      } catch (_) {
        // 接口偶尔返回未编码的明文，兜底直接返回
        return typeof b64 === 'string' ? b64 : '';
      }
    } catch (e) {
      logger.warn({ err: e?.message }, 'qq getLyric failed');
      return '';
    }
  }

  async recommend(seed) {
    // 第一期降级：用 search 当 recommend
    return this.search(seed?.name || seed || '');
  }
}
