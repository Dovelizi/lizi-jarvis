import { store } from '../store.js';
import { player } from '../audio.js';

/**
 * ON AIR BAR · 底部装饰性状态栏（Nothing instrument panel 风）
 *
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │ ● ON AIR   24-7 ∞      ▎▎▎▎▎▎▎▎▎▎▎▎▎▎▎      42 对话 · v1.0     │
 *  └─────────────────────────────────────────────────────────────────┘
 *
 *  - 左：呼吸脉冲 + "ON AIR" + 启动时长
 *  - 中：30 格点阵律动（跟随播放状态温和脉动）
 *  - 右：对话计数 + 版本
 */
class ClaudioOnAirBar extends HTMLElement {
  connectedCallback() {
    this._start = Date.now();
    this._unsub = store.subscribe(() => this._syncStats());
    this._tick = setInterval(() => this._syncUptime(), 1000);
    this.render();
    this._rafLoop = () => {
      this._drawDots();
      this._raf = requestAnimationFrame(this._rafLoop);
    };
    this._raf = requestAnimationFrame(this._rafLoop);
  }
  disconnectedCallback() {
    this._unsub && this._unsub();
    clearInterval(this._tick);
    cancelAnimationFrame(this._raf);
  }

  render() {
    const { messages, connected, now } = store.state;
    const msgCount = messages?.length ?? 0;
    const statusText = connected ? 'ON AIR' : 'OFFLINE';
    const statusClass = connected ? 'is-on' : 'is-off';
    const songName = now?.song?.name || '—';

    this.innerHTML = `
      <section class="onair-bar">
        <div class="onair-bar__left">
          <span class="onair-bar__dot ${statusClass}"></span>
          <span class="onair-bar__status">${statusText}</span>
          <span class="onair-bar__sep">·</span>
          <span class="onair-bar__uptime" id="onair-uptime">00:00:00</span>
        </div>
        <div class="onair-bar__center">
          <canvas class="onair-bar__dots" width="600" height="20" aria-hidden="true"></canvas>
        </div>
        <div class="onair-bar__right">
          <span class="onair-bar__song" title="${escape(songName)}">${escape(songName)}</span>
          <span class="onair-bar__sep">·</span>
          <span class="onair-bar__msgs">${msgCount} MSG</span>
          <span class="onair-bar__sep">·</span>
          <span class="onair-bar__ver">v1.0.0</span>
        </div>
      </section>`;
  }

  _syncStats() {
    // 轻量同步：只改变动文本，不重建 DOM
    const uptime = this.querySelector('#onair-uptime');
    const ver = this.querySelector('.onair-bar__msgs');
    const dot = this.querySelector('.onair-bar__dot');
    const status = this.querySelector('.onair-bar__status');
    const song = this.querySelector('.onair-bar__song');
    if (!uptime) return;  // 组件尚未渲染
    const { messages, connected, now } = store.state;
    if (ver) ver.textContent = `${messages?.length ?? 0} MSG`;
    if (dot) dot.className = 'onair-bar__dot ' + (connected ? 'is-on' : 'is-off');
    if (status) status.textContent = connected ? 'ON AIR' : 'OFFLINE';
    if (song) {
      const n = now?.song?.name || '—';
      song.textContent = n;
      song.title = n;
    }
  }

  _syncUptime() {
    const el = this.querySelector('#onair-uptime');
    if (!el) return;
    const sec = Math.floor((Date.now() - this._start) / 1000);
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    el.textContent = `${h}:${m}:${s}`;
  }

  _drawDots() {
    const canvas = this.querySelector('.onair-bar__dots');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cols = 60;
    const dotR = 1.5;
    const gap = w / cols;
    const midY = h / 2;
    const isPlaying = (store.state.now?.state || 'idle') === 'playing';

    // 当前播放进度（0~1），无歌或无 duration 时 = 0
    const cur = player.currentTime || 0;
    const dur = player.duration || 0;
    const progress = (dur > 0) ? Math.min(1, Math.max(0, cur / dur)) : 0;
    const headIdx = Math.floor(progress * cols);

    // 播放头脉冲（仅播放中有效）：0~1 的 sine
    const t = Date.now() / 600;
    const headPulse = isPlaying ? (0.6 + 0.4 * Math.sin(t * 2)) : 0;

    for (let i = 0; i < cols; i++) {
      let color, alpha;

      if (i < headIdx) {
        // 已播：橙色实点
        color = '#FF6B1A';
        alpha = 0.85;
      } else if (i === headIdx) {
        // 播放头：高亮 + 脉冲
        color = '#FF6B1A';
        alpha = isPlaying ? headPulse : 0.6;
      } else {
        // 未播：灰色暗点
        color = '#666666';
        alpha = isPlaying ? 0.35 : 0.25;
      }

      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(i * gap + gap / 2, midY, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function escape(s) { return String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

customElements.define('claudio-on-air-bar', ClaudioOnAirBar);
