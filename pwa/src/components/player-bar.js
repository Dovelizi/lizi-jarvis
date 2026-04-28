import { store, toggleQueue, isSongLiked } from '../store.js';
import { api } from '../api.js';
import { player } from '../audio.js';

/**
 * Player Bar · NOW PLAYING 大卡片
 * 参照 Nothing preview Now Playing 块
 *  ┌───────────────────────────────────┐
 *  │ NOW PLAYING            [⌃ chat]   │
 *  │                                   │
 *  │  Nightcall              ║║║│║║│║  │
 *  │  KAVINSKY · OUTRUN     （波形）   │
 *  │                                   │
 *  │  02:34 ━━━━━━●─────── 04:47       │
 *  │                                   │
 *  │  ⏮  ⏯  ⏭  ⏹  ♡   音量────●  列表 │
 *  └───────────────────────────────────┘
 */
class ClaudioPlayerBar extends HTMLElement {
  connectedCallback() {
    // 只在 player-bar 关心的字段变化时 re-render，避免无关 state 触发整卡 DOM 重建
    // （progress/canvas/lyric-slot 重建会引起视觉抖动）
    this._lastSig = '';
    this._unsub = store.subscribe((s) => {
      const sig = this._sigOf(s);
      if (sig === this._lastSig) return;
      this._lastSig = sig;
      this.render();
    });
    this._offPos = player.on('position', () => this._syncProgress());
    this._offLoaded = player.on('loaded', () => this.render());
    this.addEventListener('click', (e) => this._onClick(e));
    this.addEventListener('input', (e) => this._onInput(e));
    const v = store.state.now?.volume ?? 80;
    player.setVolume(v);
    this.render();
    // 用 RAF 驱动波形（60fps，跟随音频频谱真实律动）
    this._rafLoop = () => {
      this._drawWave();
      this._raf = requestAnimationFrame(this._rafLoop);
    };
    this._raf = requestAnimationFrame(this._rafLoop);
  }
  disconnectedCallback() {
    this._unsub && this._unsub();
    this._offPos && this._offPos();
    this._offLoaded && this._offLoaded();
    cancelAnimationFrame(this._raf);
  }

  _sigOf(s) {
    const song = s.now?.song;
    // 关心：歌曲身份 / 播放状态 / 音量 / 队列开合 / 队列长度 / 当前歌的收藏状态
    return [
      song?.songId || '',
      song?.name || '',
      s.now?.state || '',
      s.now?.volume ?? 80,
      s.queueOpen ? 1 : 0,
      (s.queue || []).length,
      isSongLiked(song, s.seedSongs) ? 1 : 0,
    ].join('|');
  }

  render() {
    const { now, queueOpen, queue } = store.state;
    const song = now?.song;
    const stateLower = (now?.state || 'idle').toLowerCase();
    const playIcon = player.paused ? '▶' : '⏸';
    const cur = fmt(player.currentTime);
    const total = fmt(player.duration);
    const vol = now?.volume ?? 80;
    const queueCount = (queue || []).length;
    const currentId = song?.songId;
    const liked = isSongLiked(song);

    // 保留 lyric-scroll 实例：重建 DOM 时先取出、稍后插回，避免滚筒状态被重置
    const preservedLyric = this.querySelector('claudio-lyric-scroll');

    const queueHtml = queueOpen ? `
      <div class="claudio-player__queue" role="dialog" aria-label="播放队列">
        <header class="claudio-player__queue-head">
          <span>QUEUE · ${queueCount} TRACKS</span>
          <button data-act="close-queue" aria-label="关闭">×</button>
        </header>
        ${queueCount === 0
          ? '<div class="claudio-player__queue-empty">// 队列为空</div>'
          : `<ul class="claudio-player__queue-list">
              ${(queue || []).map((s, i) => `
                <li class="claudio-player__queue-item ${s.songId === currentId ? 'is-current' : ''}" data-act="play-song" data-name="${escape(s.name || '')}">
                  <span class="claudio-player__queue-num">${String(i + 1).padStart(2, '0')}</span>
                  <span class="claudio-player__queue-name">${escape(s.name || '')}</span>
                  <span class="claudio-player__queue-artist">${escape(s.artist || '')}</span>
                </li>`).join('')}
            </ul>`}
      </div>` : '';

    this.innerHTML = `
      <section class="claudio-card claudio-player" data-state="${stateLower}">
        <header class="claudio-player__head">
          <span class="claudio-card__label">正在播放</span>
          <span class="claudio-player__head-sep">·</span>
          <span class="claudio-player__head-artist">${escape(song?.artist || '寂静')}</span>
          <span class="claudio-player__head-dash">—</span>
          <span class="claudio-player__head-name">${escape(song?.name || '暂无歌曲')}</span>
        </header>

        <div class="claudio-player__body">
          <div class="claudio-player__lyric-slot"></div>
          <canvas class="claudio-player__wave" width="240" height="56" aria-hidden="true"></canvas>
        </div>

        <div class="claudio-player__bar-row">
          <span class="claudio-player__time-current">${cur}</span>
          <input type="range" class="claudio-player__progress" data-act="seek" min="0" max="100" value="0" />
          <span class="claudio-player__time-total">${total}</span>
        </div>

        <div class="claudio-player__ctrl-row">
          <div class="claudio-player__controls">
            <button data-act="prev"   aria-label="上一首">⏮</button>
            <button data-act="toggle" aria-label="播放/暂停">${playIcon}</button>
            <button data-act="next"   aria-label="下一首">⏭</button>
            <button data-act="stop"   aria-label="停止">⏹</button>
            <button data-act="like"   aria-label="${liked ? '取消收藏' : '收藏'}" class="${liked ? 'is-liked' : ''}">${liked ? '♥' : '♡'}</button>
          </div>
          <div class="claudio-player__vol">
            <span>音量</span>
            <input type="range" data-act="vol" min="0" max="100" value="${vol}" />
          </div>
          <button data-act="list" class="claudio-player__btn-text ${queueOpen ? 'is-active' : ''}" aria-label="队列">
            列表 ${queueCount > 0 ? `<span class="claudio-player__btn-badge">${queueCount}</span>` : ''}
          </button>
        </div>

        ${queueHtml}
      </section>`;

    // 把保留的 lyric-scroll 元素插回 slot；首次渲染则创建新的
    const slot = this.querySelector('.claudio-player__lyric-slot');
    if (slot) {
      const lyric = preservedLyric || document.createElement('claudio-lyric-scroll');
      slot.replaceWith(lyric);
      lyric.classList.add('claudio-player__lyric');
    }

    // 立即同步进度条到当前播放位置
    // 否则 progress 元素是新建的，value=0 会"跳"一下，下一帧 position 事件才修正
    this._syncProgress();
  }

  _drawWave() {
    const canvas = this.querySelector('.claudio-player__wave');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    const isPlaying = (store.state.now?.state || 'idle') === 'playing';

    const bars = 40;
    const gap = 2;
    const bw = (w - gap * (bars - 1)) / bars;
    const radius = Math.min(1.5, bw / 2);

    // 颜色跟随主题的"显示色"（字体主色）
    // 读 CSS 变量 --text-display；fallback 白
    if (!this._colorCache || this._colorCacheTheme !== document.documentElement.dataset.theme) {
      const c = getComputedStyle(document.documentElement).getPropertyValue('--text-display').trim();
      this._colorCache = c || '#FFFFFF';
      this._colorCacheTheme = document.documentElement.dataset.theme;
    }
    ctx.fillStyle = this._colorCache;

    const drawBar = (i, bh) => {
      const x = i * (bw + gap);
      const y = h - bh;
      const r = Math.min(radius, bh / 2);
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.lineTo(x + bw - r, y);
      ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
      ctx.lineTo(x + bw, h);
      ctx.closePath();
      ctx.fill();
    };

    // 初始化平滑值数组
    if (!this._smooth || this._smooth.length !== bars) {
      this._smooth = new Array(bars).fill(h * 0.08);
    }
    const smooth = this._smooth;

    // 不对称衰减系数：上升快，下降慢（仿 VU 表）
    const RISE = 0.45;
    const FALL = 0.10;

    if (isPlaying) {
      const freq = player.getFrequencyData();
      if (freq && freq.length) {
        const step = Math.floor(freq.length / bars / 1.5) || 1;
        for (let i = 0; i < bars; i++) {
          const v = freq[i * step] / 255;
          const target = Math.max(2, v * h);
          const k = target > smooth[i] ? RISE : FALL;
          smooth[i] += (target - smooth[i]) * k;
        }
      } else {
        // 频谱不可用：平滑衰减到低位静柱
        const target = h * 0.18;
        for (let i = 0; i < bars; i++) {
          smooth[i] += (target - smooth[i]) * 0.08;
        }
      }
    } else {
      // 暂停：平滑衰减到定格帧（若有）或低位静柱
      const frozen = this._lastFrame;
      for (let i = 0; i < bars; i++) {
        const target = frozen?.[i] ?? h * 0.10;
        smooth[i] += (target - smooth[i]) * 0.20;
      }
    }

    // 清屏并一次性绘制所有柱子
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < bars; i++) drawBar(i, smooth[i]);

    // 播放时缓存最近一帧（供暂停时作为衰减目标）
    if (isPlaying) this._lastFrame = smooth.slice();
  }

  _syncProgress() {
    if (this._dragging) return;
    const bar = this.querySelector('[data-act="seek"]');
    const cur = this.querySelector('.claudio-player__time-current');
    if (!bar) return;
    if (player.duration) bar.value = (player.currentTime / player.duration) * 100;
    if (cur) cur.textContent = fmt(player.currentTime);
  }

  _onClick(e) {
    const act = e.target?.closest('[data-act]')?.dataset?.act;
    if (!act) return;
    if (act === 'toggle') {
      if (player.paused) player.play();
      else player.pause();
    }
    if (act === 'next') api.chat('下一首').catch(() => {});
    if (act === 'prev') api.chat('上一首').catch(() => {});
    if (act === 'stop') {
      player.stop();
      store.set({ now: { song: null, state: 'idle', volume: store.state.now.volume } });
    }
    if (act === 'like') this._toggleLike();
    if (act === 'list') toggleQueue();
    if (act === 'close-queue') store.set({ queueOpen: false });
    if (act === 'play-song') {
      const name = e.target.closest('[data-name]')?.dataset?.name;
      if (name) api.chat(`播放 ${name}`).catch(() => {});
    }
  }

  async _toggleLike() {
    const song = store.state.now?.song;
    if (!song?.name) return;
    const liked = isSongLiked(song);
    try {
      const r = liked
        ? await api.seedRemove(song.name, song.artist || '')
        : await api.seedAdd(song.name, song.artist || '');
      if (r?.songs) store.set({ seedSongs: r.songs });
    } catch (e) {
      console.warn('toggleLike failed', e);
    }
  }

  _onInput(e) {
    const act = e.target?.dataset?.act;
    if (act === 'seek') {
      this._dragging = true;
      player.seek(Number(e.target.value));
      setTimeout(() => { this._dragging = false; }, 200);
    }
    if (act === 'vol') {
      const v = Number(e.target.value) || 0;
      player.setVolume(v);
      store.set({ now: { ...store.state.now, volume: v } });
    }
  }
}

function fmt(sec) {
  if (!sec || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
function escape(s) { return String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }

customElements.define('claudio-player-bar', ClaudioPlayerBar);
