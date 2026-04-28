import { store, toggleChat, openMenu } from '../store.js';

/**
 * Player 视图 · 宽屏 Dashboard
 *
 *   ┌──────────────────────────────────────────┬──────[E 抽屉]──────┐
 *   │  ●C  CLAUDIO              [LIGHT|DARK] [☰]                    │
 *   ├──────────────────────────────────────────┤                    │
 *   │   A  时钟 (大)                           │   E 聊天面板        │
 *   ├──────────────────────────────────────────┤   (默认收起)       │
 *   │   D  播放器 (NOW PLAYING + 律动)         │                    │
 *   ├────────────────────┬─────────────────────┤                    │
 *   │  B  天气 (1fr)     │  C  每日一言 (1fr)  │                    │
 *   └────────────────────┴─────────────────────┴────────────────────┘
 *
 *   E 区交互：
 *   - 默认收起；右边缘有竖向 [ CHAT ▸ ] 把手按钮
 *   - 点击把手 / D 卡里的 chat-toggle / 输入框区域均可开合
 *   - 展开后宽度 380px，背景半透明叠加在主区上（不挤压主区）
 */
export function renderPlayer(root) {
  if (!root.querySelector('[data-mount="player"]')) {
    root.innerHTML = `
      <div data-mount="player" class="player-shell">
        <header class="claudio-header player-header">
          <div class="claudio-header__brand">
            <button class="claudio-avatar" data-act="open-profile" aria-label="个人资料">C</button>
            <span class="claudio-header__name">CLAUDIO</span>
          </div>
          <nav class="claudio-header__nav">
            <claudio-theme-toggle></claudio-theme-toggle>
            <button class="claudio-icon-btn" data-act="open-settings" aria-label="菜单 / 设置">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <line x1="2" y1="4"  x2="14" y2="4"/>
                <line x1="2" y1="8"  x2="14" y2="8"/>
                <line x1="2" y1="12" x2="14" y2="12"/>
              </svg>
            </button>
          </nav>
        </header>

        <main class="player-grid">
          <section class="player-grid__left">
            <claudio-led-clock class="grid-area-a"></claudio-led-clock>
            <claudio-player-bar></claudio-player-bar>
            <div class="player-grid__row-2col">
              <claudio-weather-card></claudio-weather-card>
              <claudio-daily-card></claudio-daily-card>
            </div>
            <claudio-on-air-bar></claudio-on-air-bar>
          </section>

          <!-- 右边缘 hover 触发区：默认透明，鼠标进入则显示抽屉把手 -->
          <div class="player-grid__edge-trigger" aria-hidden="true"></div>

          <!-- 把手：浮于 player-grid 右边缘（不嵌在抽屉内，避免被 overflow:hidden 裁掉） -->
          <button class="player-drawer__handle" data-act="toggle-chat" aria-label="展开对话面板">
            <span class="player-drawer__handle-text">CHAT</span>
            <span class="player-drawer__handle-arrow">‹</span>
          </button>

          <!-- E 区抽屉：打开时把手隐藏（display:none），通过 ×/ESC/点外部 关闭 -->
          <aside class="player-drawer" data-open="false" data-region="chat-area" aria-label="对话面板">
            <div class="player-drawer__body">
              <button class="player-drawer__close" data-act="close-chat" aria-label="关闭对话面板">×</button>
              <claudio-live-panel></claudio-live-panel>
              <claudio-input-bar></claudio-input-bar>
            </div>
          </aside>
        </main>

        <claudio-menu-drawer></claudio-menu-drawer>
      </div>`;

    root.addEventListener('click', (e) => {
      const act = e.target?.closest('[data-act]')?.dataset?.act;
      if (act === 'open-profile')  openMenu('profile');
      if (act === 'open-settings') openMenu('settings');
      if (act === 'toggle-chat')   toggleChat();
      if (act === 'close-chat') {
        if (store.state.chatVisible) toggleChat();
      }
    });

    // ESC → 关抽屉
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && store.state.chatVisible) toggleChat();
    });

    // chatVisible 变化 → 同步 drawer 开合
    const drawer = root.querySelector('.player-drawer');
    const handleArrow = () => root.querySelector('.player-drawer__handle-arrow');
    const sync = (s) => {
      if (!drawer) return;
      const open = !!s.chatVisible;
      drawer.setAttribute('data-open', String(open));
      const arrow = handleArrow();
      if (arrow) arrow.textContent = open ? '›' : '‹';
    };
    store.subscribe(sync);
    sync(store.state);
  }
}
