import { store } from '../store.js';

/**
 * 直播面板 · Telegram 风气泡聊天
 *  - bot (CLAUDIO)：左对齐，圆形头像 + 气泡（左下角小圆角）
 *  - user (MMGUO)：右对齐，圆形头像 + 气泡（右下角小圆角，accent-orange 高亮）
 *  - system：居中浅灰小字
 *  - 同角色连续消息：合并组（仅最后一条显示头像，气泡间距收紧）
 *  - 流式：气泡内三点动画
 *  - bot 气泡内嵌歌曲推荐 + 重播按钮（保留原功能）
 */
class ClaudioLivePanel extends HTMLElement {
  connectedCallback() {
    // 只在 live-panel 关心的字段（messages / connected）变化时 re-render，
    // 避免播放器按钮（音量、queueOpen、now.*）等无关变更引发整个气泡 DOM 重建造成视觉闪烁
    this._lastSig = '';
    this._unsub = store.subscribe((s) => {
      const sig = this._sigOf(s);
      if (sig === this._lastSig) return;
      this._lastSig = sig;
      this.render();
    });
    this.addEventListener('click', (e) => this._onClick(e));
    this.render();
  }
  disconnectedCallback() { this._unsub && this._unsub(); }

  _sigOf(s) {
    const msgs = s.messages || [];
    // 只关心：消息条数、最后一条的 ts/text/streaming 标志、connected 连接状态
    const last = msgs[msgs.length - 1];
    return [
      msgs.length,
      last?.ts ?? 0,
      last?.streaming ? 1 : 0,
      last?.text?.length ?? 0,
      s.connected ? 1 : 0,
    ].join('|');
  }

  render() {
    const { messages, connected } = store.state;

    // 预处理：标记每条消息是否为同角色组的"最后一条"（决定是否显示头像和时间戳）
    const list = (messages || []).slice(-100);
    const items = list.map((m, i) => {
      const next = list[i + 1];
      const isLastOfGroup = !next || next.role !== m.role;
      return this._bubble(m, isLastOfGroup);
    }).join('') || '<div class="claudio-live__empty">// 寂静也是一首歌</div>';

    // 仅在断线时显示状态条（避免常驻"已连接"占空间）
    const statusBar = connected ? '' : `<div class="claudio-live__status">正在重连…</div>`;

    this.innerHTML = `
      <section class="claudio-live" aria-label="live">
        <header class="claudio-live__header">
          <div class="claudio-live__brand">
            <span class="claudio-onair__dot"></span>
            <span>Claudio</span>
          </div>
          <span class="claudio-badge claudio-badge--live">直播</span>
        </header>
        ${statusBar}
        <div class="claudio-live__list" role="log" aria-live="polite">${items}</div>
      </section>`;
    const listEl = this.querySelector('.claudio-live__list');
    if (listEl) listEl.scrollTop = listEl.scrollHeight;
  }

  _bubble(m, isLastOfGroup) {
    const isUser = m.role === 'user';
    const isSystem = m.role === 'system';
    const t = new Date(m.ts).toTimeString().slice(0, 5);

    // system：居中提示
    if (isSystem) {
      return `
        <div class="chat-system">
          <span class="chat-system__text">${escape(m.text || '')}</span>
        </div>`;
    }

    const meta = (() => {
      try { return typeof m.meta === 'string' ? JSON.parse(m.meta) : m.meta; } catch (_) { return null; }
    })();
    const play = meta?.play;
    const playList = (!isUser && Array.isArray(play) && play.length) ? `
      <ul class="chat-suggest">
        ${play.map((p, i) => `
          <li class="chat-suggest__item ${i === 0 ? 'is-pick' : ''}" data-name="${escape(p.name || '')}">
            <button class="chat-suggest__play" aria-label="play">▶</button>
            <div class="chat-suggest__meta">
              <span class="chat-suggest__name">${escape(p.name || '')}</span>
              <span class="chat-suggest__artist">${escape(p.artist || '')}</span>
            </div>
          </li>`).join('')}
      </ul>` : '';

    // 时间戳放在气泡外底部，仅组末显示
    const timeFooter = isLastOfGroup
      ? `<div class="chat-time-footer">${t}</div>`
      : '';

    if (isUser) {
      return `
        <div class="chat-row chat-row--user ${isLastOfGroup ? 'is-last' : 'is-cont'}">
          <div class="chat-col">
            <div class="chat-bubble chat-bubble--user">
              <p class="chat-bubble__text">${escape(m.text || '')}</p>
            </div>
            ${timeFooter}
          </div>
          <div class="chat-avatar chat-avatar--user" aria-hidden="true">${isLastOfGroup ? 'M' : ''}</div>
        </div>`;
    }

    // bot · 流式中
    if (m.streaming) {
      return `
        <div class="chat-row chat-row--bot ${isLastOfGroup ? 'is-last' : 'is-cont'}">
          <div class="chat-avatar chat-avatar--bot" aria-hidden="true">${isLastOfGroup ? 'C' : ''}</div>
          <div class="chat-col">
            <div class="chat-bubble chat-bubble--bot">
              ${isLastOfGroup ? '<div class="chat-bubble__name">CLAUDIO <span class="chat-bubble__role">DJ</span></div>' : ''}
              <p class="chat-bubble__text chat-thinking">
                <span class="chat-thinking-dot"></span>
                <span class="chat-thinking-dot"></span>
                <span class="chat-thinking-dot"></span>
              </p>
            </div>
          </div>
        </div>`;
    }

    // bot · 终态
    return `
      <div class="chat-row chat-row--bot ${isLastOfGroup ? 'is-last' : 'is-cont'}">
        <div class="chat-avatar chat-avatar--bot" aria-hidden="true">${isLastOfGroup ? 'C' : ''}</div>
        <div class="chat-col">
          <div class="chat-bubble chat-bubble--bot">
            ${isLastOfGroup ? '<div class="chat-bubble__name">CLAUDIO <span class="chat-bubble__role">DJ</span></div>' : ''}
            <p class="chat-bubble__text">${escape(m.text || '')}</p>
            ${playList}
          </div>
          <div class="chat-bubble-meta">
            <button class="chat-bubble__replay" data-act="replay" data-text="${escape(m.text || '')}">▶ 重播</button>
            ${isLastOfGroup ? `<span class="chat-time-footer chat-time-footer--inline">${t}</span>` : ''}
          </div>
        </div>
      </div>`;
  }

  _onClick(e) {
    const act = e.target?.dataset?.act;
    if (act === 'replay') {
      const text = e.target.dataset.text;
      if (!text) return;
      this._replay(text);
    }
    const sug = e.target.closest('.chat-suggest__item');
    if (sug?.dataset?.name) {
      import('../api.js').then(({ api }) => api.chat(`播放 ${sug.dataset.name}`).catch(() => {}));
    }
  }

  /**
   * REPLAY：优先 Edge TTS，失败降级 SpeechSynthesis
   */
  async _replay(text) {
    const voice = store.state.config?.prefs?.ttsVoice || '';
    try {
      const url = `/api/tts?text=${encodeURIComponent(text.slice(0, 500))}${voice ? '&voice=' + encodeURIComponent(voice) : ''}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('tts http ' + r.status);
      const { url: mp3 } = await r.json();
      const audio = new Audio(mp3);
      audio.play().catch(() => this._fallbackTts(text));
    } catch (_) {
      this._fallbackTts(text);
    }
  }

  _fallbackTts(text) {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
}

function escape(s) { return String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

customElements.define('claudio-live-panel', ClaudioLivePanel);
