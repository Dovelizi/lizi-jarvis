/**
 * MusicProvider 抽象基类（独立文件，避免与 index.js 形成循环依赖）
 *  search(keyword)   → [{ songId, name, artist, duration, album }]
 *  getUrl(songId)    → string (mp3 URL)
 *  getLyric(songId)  → string (LRC)
 *  recommend(seed)   → [...]
 */
export class MusicProvider {
  async search(_kw)    { throw new Error('search not implemented'); }
  async getUrl(_id)    { throw new Error('getUrl not implemented'); }
  async getLyric(_id)  { throw new Error('getLyric not implemented'); }
  async recommend(_s)  { return []; }
}
