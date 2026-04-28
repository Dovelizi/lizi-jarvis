import { store } from '../store.js';

/**
 * Speaking 态：手机竖屏沉浸式
 * 结构（对齐 viod.MP4 第 45 帧）：
 *   ┌─ 外层卡片（圆角 24px，深色，宽度 360px）
 *   ├─ 顶部条：● Claudio  /  时间戳   ●Speaking…
 *   ├─ 黑色波形条（跳动）
 *   ├─ 大白卡：歌曲大标题 + 副标题 + 进度条
 *   ├─ Claudio 实时口播流（每行带 Claudio · 0:38 前缀，当前行关键词绿高亮）
 *   └─ 底部：⏸ + 实时秒数 + mini 波形
 */
export function renderSpeaking(root) {
  // 默认占位文案，给一个起点；后续真实场景由 Brain 推送的 messages 注入
  const lines = [
    { ts: '0:17', text: 'tuning to the night frequency,', current: false, key: 'frequency' },
    { ts: '0:20', text: 'this is your private radio,', current: true,  key: 'private' },
    { ts: '0:27', text: 'a few signals before silence,', current: false, key: 'silence' },
    { ts: '0:32', text: 'breathing slow with the bassline,', current: false, key: 'bassline' },
  ];
  const { now } = store.state;
  const song = now?.song || { name: 'A Human Odyssey', artist: 'Sign of the Times — Harry Styles' };
  const cur = '0:20';
  const total = '5:41';
  const elapsed = 20;

  root.innerHTML = `
    <div class="claudio-speaking-bg">
      <article class="claudio-speaking-card">
        <header class="claudio-speaking-card__head">
          <span class="claudio-speaking-card__brand">
            <span class="claudio-avatar claudio-avatar--xs">C</span>
            <span class="claudio-speaking-card__name">Claudio</span>
          </span>
          <span class="claudio-speaking-card__time">${cur}</span>
        </header>
        <div class="claudio-speaking-card__status">
          <span class="claudio-onair__dot"></span>
          <span>Speaking…</span>
        </div>

        <canvas class="claudio-speaking-card__wave" id="wave-top" aria-hidden="true"></canvas>

        <section class="claudio-speaking-card__white">
          <h1 class="claudio-speaking-card__title">${escape(song.name)}</h1>
          <p  class="claudio-speaking-card__sub">${escape(song.artist)}</p>
          <div class="claudio-speaking-card__bar">
            <button class="claudio-speaking-card__pause" aria-label="pause">⏸</button>
            <div class="claudio-speaking-card__track">
              <span class="claudio-speaking-card__progress" style="width:${(elapsed/341*100).toFixed(1)}%"></span>
            </div>
            <span class="claudio-speaking-card__total">${cur} / ${total}</span>
          </div>

          <ol class="claudio-speaking-card__lines" id="lines">
            ${lines.map(l => `
              <li class="${l.current ? 'is-current' : 'is-past'}">
                <span class="claudio-speaking-card__line-meta">Claudio · ${l.ts}</span>
                <p class="claudio-speaking-card__line-text">
                  ${l.current
                    ? escape(l.text).replace(escape(l.key), `<mark>${escape(l.key)}</mark>`)
                    : escape(l.text)}
                </p>
              </li>`).join('')}
          </ol>
        </section>

        <footer class="claudio-speaking-card__foot">
          <span class="claudio-speaking-card__foot-time">${cur}</span>
          <canvas class="claudio-speaking-card__wave-mini" id="wave-foot" aria-hidden="true"></canvas>
          <button class="claudio-speaking-card__pause claudio-speaking-card__pause--dark" aria-label="pause">⏸</button>
        </footer>
      </article>

      <div class="claudio-speaking-back">
        <a href="#/" class="claudio-btn">← back</a>
      </div>
    </div>`;

  drawWave(root.querySelector('#wave-top'),  { bars: 80, height: 70 });
  drawWave(root.querySelector('#wave-foot'), { bars: 40, height: 28, alpha: 0.45 });
}

function drawWave(canvas, { bars = 64, height = 80, alpha = 1 } = {}) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const resize = () => {
    canvas.width  = canvas.offsetWidth * dpr;
    canvas.height = (canvas.style.height ? parseInt(canvas.style.height) : height) * dpr;
  };
  canvas.style.height = height + 'px';
  resize();
  const ctx = canvas.getContext('2d');
  let raf;
  const render = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    const w = canvas.width / bars;
    for (let i = 0; i < bars; i++) {
      const phase = (Math.sin(Date.now() / 220 + i * 0.45)
                  + Math.sin(Date.now() / 410 + i * 0.18) * 0.5) * 0.5 + 0.5;
      const h = phase * canvas.height * 0.85;
      ctx.fillRect(i * w + 1, (canvas.height - h) / 2, Math.max(1, w - 2), h);
    }
    raf = requestAnimationFrame(render);
  };
  render();
  const obs = new MutationObserver(() => {
    if (!document.body.contains(canvas)) { cancelAnimationFrame(raf); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

function escape(s) { return String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
