import { store } from '../store.js';
import { player } from '../audio.js';
import { api } from '../api.js';

/**
 * 歌词滚筒 · 卡拉 OK 逐字高亮
 *  - 数据来源优先级：
 *    1) song.lyric（/api/now 或 now_changed 事件已带）
 *    2) /api/lyric?songId=xxx（按需拉取）
 *    3) MOCK_LYRICS（后端无数据时的兜底，仅用于 UI 调试）
 *  - 当前行：行内按 (currentTime - t_i) / (t_{i+1} - t_i) 线性插值，
 *    用 linear-gradient + background-clip:text 实现字级平滑推进
 *  - 过去行：暗灰缩小；未来行：中灰缩小
 */

// MOCK 兜底（后端无歌词时展示，不影响真实数据链路）
const MOCK_LYRICS = {
  '__default__': `[00:00.00]♪ 暂无歌词
[00:10.00]♪ 享受纯音乐
[00:20.00]♪ 让旋律带你去远方`,
};

function parseLrc(lrc) {
  if (!lrc) return [];
  const lines = lrc.split('\n');
  const out = [];
  const re = /\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  for (const line of lines) {
    let m;
    const stamps = [];
    re.lastIndex = 0;
    while ((m = re.exec(line)) !== null) {
      const mm = Number(m[1]);
      const ss = Number(m[2]);
      const ms = m[3] ? Number(m[3].padEnd(3, '0')) : 0;
      stamps.push(mm * 60 + ss + ms / 1000);
    }
    const text = line.replace(re, '').trim();
    if (!stamps.length || !text) continue;
    for (const t of stamps) out.push({ t, text });
  }
  return out.sort((a, b) => a.t - b.t);
}

class ClaudioLyricScroll extends HTMLElement {
  connectedCallback() {
    // 只在首次挂载时初始化状态；后续 disconnect→reconnect（被父组件 replaceWith 移动）保留原状态
    if (!this._initialized) {
      this._lines = [];
      this._currentIdx = -1;
      this._lastSongKey = null;
      this._progress = 0;
      this._initialized = true;
    }

    this._unsub = store.subscribe(() => this._syncSong());
    this._offPos = player.on('position', () => this._syncPosition());
    this._rafLoop = () => {
      this._syncPosition();
      this._raf = requestAnimationFrame(this._rafLoop);
    };

    // 已有数据则不重渲染（保留 DOM 与滚动位置）；否则首次构建
    if (!this._lines.length) {
      this.render();
      this._syncSong();
    } else {
      // 重新挂载：仅刷新一次 className（无平滑滚动，避免视觉跳）
      this._updateActiveLine(false);
    }
    this._raf = requestAnimationFrame(this._rafLoop);
  }
  disconnectedCallback() {
    this._unsub && this._unsub();
    this._offPos && this._offPos();
    cancelAnimationFrame(this._raf);
  }

  async _syncSong() {
    const song = store.state.now?.song;
    const key = song?.songId || song?.name || '';
    if (key === this._lastSongKey) return;
    this._lastSongKey = key;

    // 优先用 song 已带的 lyric
    let lrc = song?.lyric || '';
    // 否则走接口
    if (!lrc && song?.songId) {
      try {
        const r = await api.lyric(song.songId);
        if (r?.lyric) lrc = r.lyric;
      } catch (_) {}
    }
    // 兜底：mock
    if (!lrc) lrc = MOCK_LYRICS.__default__;

    this._lines = parseLrc(lrc);
    this._currentIdx = -1;
    this._progress = 0;
    this.render();
  }

  _syncPosition() {
    if (!this._lines.length) return;
    const cur = player.currentTime;

    // 二分查找当前行
    let lo = 0, hi = this._lines.length - 1, idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this._lines[mid].t <= cur) { idx = mid; lo = mid + 1; }
      else hi = mid - 1;
    }

    // 行内进度（卡拉 OK 推进度）
    let progress = 0;
    if (idx >= 0 && idx < this._lines.length) {
      const curT = this._lines[idx].t;
      const nextT = idx + 1 < this._lines.length
        ? this._lines[idx + 1].t
        : curT + 5;  // 最后一行按 5s 估算
      const span = Math.max(0.01, nextT - curT);
      progress = Math.min(1, Math.max(0, (cur - curT) / span));
    }

    const idxChanged = idx !== this._currentIdx;
    this._currentIdx = idx;
    this._progress = progress;

    if (idxChanged) {
      this._updateActiveLine();
    } else {
      this._updateActiveProgress();
    }
  }

  render() {
    // 保留旧滚动位置（如果已有 DOM）
    const oldContainer = this.querySelector('.lyric-scroll');
    const oldScrollTop = oldContainer?.scrollTop ?? 0;

    if (!this._lines.length) {
      this.innerHTML = `
        <div class="lyric-scroll">
          <div class="lyric-scroll__empty">// 无歌词</div>
        </div>`;
      return;
    }
    const pad = ['', '', ''];
    const padHtml = pad.map(() => '<li class="lyric-scroll__pad"></li>').join('');
    const rows = this._lines.map((l, i) => {
      // 把每个字符拆成 span（含空格用 &nbsp; 占位），让卡拉 OK 进度按字符索引控制颜色
      // 即使换行也能正确：每个字符独立着色，与位置无关
      const chars = [...l.text].map((ch, ci) => {
        const safe = escape(ch) === ' ' ? '&nbsp;' : escape(ch);
        return `<span class="lyric-char" data-ci="${ci}">${safe}</span>`;
      }).join('');
      return `<li class="lyric-scroll__line" data-idx="${i}" data-len="${[...l.text].length}">
        <span class="lyric-scroll__line-text">${chars}</span>
      </li>`;
    }).join('');
    this.innerHTML = `
      <div class="lyric-scroll">
        <ul class="lyric-scroll__list">
          ${padHtml}
          ${rows}
          ${padHtml}
        </ul>
      </div>`;

    // 还原滚动位置（避免 DOM 重建后跳到顶部）
    const newContainer = this.querySelector('.lyric-scroll');
    if (newContainer && oldScrollTop > 0) {
      newContainer.scrollTop = oldScrollTop;
    }

    this._updateActiveLine();
  }

  /**
   * 切换行：设置 is-past/is-active/is-future，滚动到居中
   * @param {boolean} smooth 是否平滑滚动；false 则瞬移（用于重挂载/初始定位）
   */
  _updateActiveLine(smooth = true) {
    const list = this.querySelector('.lyric-scroll__list');
    if (!list) return;
    const lines = list.querySelectorAll('.lyric-scroll__line');
    lines.forEach((el) => {
      const idx = Number(el.dataset.idx);
      el.classList.toggle('is-past',   idx < this._currentIdx);
      el.classList.toggle('is-active', idx === this._currentIdx);
      el.classList.toggle('is-future', idx > this._currentIdx);
      // 非当前行：清掉所有字符的 is-sung 类，恢复纯色
      if (idx !== this._currentIdx) {
        el.querySelectorAll('.lyric-char.is-sung').forEach(c => c.classList.remove('is-sung'));
      }
    });
    this._updateActiveProgress();

    // 滚动到当前行居中
    const active = list.querySelector('.lyric-scroll__line.is-active');
    if (active) {
      const container = this.querySelector('.lyric-scroll');
      if (!container) return;
      const containerH = container.clientHeight;
      const offsetTop = active.offsetTop;
      const activeH = active.offsetHeight;
      const target = offsetTop - (containerH - activeH) / 2;
      container.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'auto' });
    }
  }

  /**
   * 帧级：仅更新 active 行的字符 is-sung 状态
   * 按 progress 计算应当已唱的字符数，调整每个 char 的类
   * 优化：用 _lastSungCount 比对，仅在数量变化时更新 DOM
   */
  _updateActiveProgress() {
    const active = this.querySelector('.lyric-scroll__line.is-active');
    if (!active) return;
    const total = Number(active.dataset.len) || 0;
    if (!total) return;
    const sungCount = Math.floor(this._progress * total);
    if (sungCount === this._lastSungCount && active === this._lastActive) return;
    this._lastSungCount = sungCount;
    this._lastActive = active;

    const chars = active.querySelectorAll('.lyric-char');
    chars.forEach((c, i) => {
      c.classList.toggle('is-sung', i < sungCount);
    });
  }
}

function escape(s) { return String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }

customElements.define('claudio-lyric-scroll', ClaudioLyricScroll);
