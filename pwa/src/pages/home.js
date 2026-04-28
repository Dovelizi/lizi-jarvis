import { store } from '../store.js';

export function renderHome(root) {
  root.innerHTML = `
    <header class="claudio-header">
      <div class="claudio-header__brand">
        <button class="claudio-avatar" data-act="open-profile" aria-label="open profile">C</button>
        <span class="claudio-header__name">Claudio</span>
      </div>
      <nav class="claudio-header__nav">
        <button class="claudio-btn" data-act="login">LOGIN</button>
        <claudio-theme-toggle></claudio-theme-toggle>
      </nav>
    </header>

    <claudio-led-clock></claudio-led-clock>
    <claudio-player-bar></claudio-player-bar>
    <claudio-queue-list></claudio-queue-list>
    <claudio-live-panel></claudio-live-panel>
    <claudio-input-bar></claudio-input-bar>

    <footer class="claudio-footer">
      <span>CLAUDIO FM</span>
      <span class="claudio-footer__right">
        <span class="claudio-onair__dot" id="footer-status-dot"></span>
        <span id="footer-status-text">CONNECTED</span>
      </span>
    </footer>

    <claudio-profile-modal></claudio-profile-modal>`;

  root.addEventListener('click', (e) => {
    const act = e.target?.dataset?.act;
    if (act === 'open-profile') store.set({ profileOpen: true });
    if (act === 'login') {
      store.push('messages', { ts: Date.now(), role: 'system', text: '本地单用户模式：已自动登录为 mmguo' });
    }
  });

  // 订阅连接状态更新页脚
  store.subscribe((s) => {
    const text = root.querySelector('#footer-status-text');
    const dot = root.querySelector('#footer-status-dot');
    if (text) text.textContent = s.connected ? 'CONNECTED' : 'OFFLINE';
    if (dot) dot.style.opacity = s.connected ? '1' : '0.3';
  });
}
