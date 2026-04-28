import { store } from '../store.js';
import { api } from '../api.js';

class ClaudioInputBar extends HTMLElement {
  connectedCallback() {
    this.render();
    this.addEventListener('submit', (e) => this._onSubmit(e));
    this.addEventListener('click', (e) => this._onClick(e));
  }

  render() {
    this.innerHTML = `
      <form class="claudio-input" autocomplete="off">
        <input type="text" name="text" placeholder="对 DJ 说点什么…" maxlength="2000" />
        <button type="button" class="claudio-input__mic" data-act="mic" aria-label="语音">🎙</button>
        <button type="submit" class="claudio-input__send" aria-label="发送">→</button>
      </form>`;
  }

  async _onSubmit(e) {
    e.preventDefault();
    const input = this.querySelector('input[name="text"]');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    // 本地立即追加 user 消息（后端也会写 SQLite）
    store.push('messages', { ts: Date.now(), role: 'user', text });
    try {
      await api.chatStream(text);
      // 不等待响应——流式结果通过 WS claudio_stream_* 事件异步到达
    } catch (err) {
      store.push('messages', { ts: Date.now(), role: 'system', text: '[错误] ' + err.message });
    }
  }

  _onClick(e) {
    if (e.target?.dataset?.act !== 'mic') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      store.push('messages', { ts: Date.now(), role: 'system', text: '[提示] 当前浏览器不支持语音识别' });
      return;
    }
    const r = new SR();
    r.lang = 'zh-CN';
    r.onresult = (ev) => {
      const t = ev.results[0][0].transcript;
      this.querySelector('input[name="text"]').value = t;
    };
    r.start();
  }
}

customElements.define('claudio-input-bar', ClaudioInputBar);
