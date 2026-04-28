import { store, closeMenu } from '../store.js';
import { api } from '../api.js';

const TAGS = [
  '爵士嘻哈', '新古典', '90 年代华语', '嘻哈',
  '柴可夫斯基 + EMINEM', '日式摇滚', '雨声白噪音', '后朋克', '涩谷系',
];

/**
 * MenuDrawer · 右侧统一抽屉，承载「资料」+「设置」两个 tab
 *  - 头像点击 → 默认打开 profile tab
 *  - ☰  点击 → 默认打开 settings tab
 *  - ESC / 点遮罩 / 关闭按钮 → 关闭
 */
class ClaudioMenuDrawer extends HTMLElement {
  connectedCallback() {
    this._unsub = store.subscribe(() => this.render());
    this.addEventListener('click', (e) => this._onClick(e));
    this.addEventListener('input', (e) => this._onInput(e));
    this.addEventListener('change', (e) => this._onChange(e));
    this._onKey = (e) => { if (e.key === 'Escape') closeMenu(); };
    document.addEventListener('keydown', this._onKey);
    this.render();
  }
  disconnectedCallback() {
    this._unsub && this._unsub();
    document.removeEventListener('keydown', this._onKey);
  }

  render() {
    const { menuOpen, menuTab, messages, config } = store.state;
    if (!menuOpen) { this.innerHTML = ''; return; }

    const tab = menuTab || 'profile';
    this.innerHTML = `
      <div class="menu-drawer__backdrop" data-act="close"></div>
      <aside class="menu-drawer" role="dialog" aria-modal="true" aria-label="Claudio menu">
        <header class="menu-drawer__head">
          <div class="menu-drawer__tabs">
            <button class="menu-drawer__tab ${tab === 'profile' ? 'is-active' : ''}" data-tab="profile">资料</button>
            <button class="menu-drawer__tab ${tab === 'settings' ? 'is-active' : ''}" data-tab="settings">设置</button>
          </div>
          <button class="menu-drawer__close" data-act="close" aria-label="关闭">×</button>
        </header>
        <div class="menu-drawer__body">
          ${tab === 'profile' ? this._renderProfile(messages.length) : this._renderSettings(config)}
        </div>
      </aside>`;

    // settings tab：每次 render 后补一次 voices 列表（store 变化触发 re-render 会清空下拉）
    if (tab === 'settings') {
      setTimeout(() => this._initSettingsAsync(), 0);
    }
  }

  _renderProfile(msgCount) {
    return `
      <section class="menu-profile">
        <div class="menu-profile__avatar">C</div>
        <h2 class="menu-profile__name">Claudio</h2>
        <p class="menu-profile__tagline">"一开机我就打碟"</p>
        <p class="menu-profile__bio">
          你的心情就是我的提示词。<br/>
          我讨厌算法，我有 taste。
        </p>
        <dl class="menu-profile__stats">
          <div><dt>不停播</dt><dd>24/7</dd></div>
          <div><dt>风格数</dt><dd>∞</dd></div>
          <div><dt>对话数</dt><dd>${msgCount}</dd></div>
        </dl>
        <div class="menu-profile__tags-label">擅长风格</div>
        <ul class="claudio-tags">
          ${TAGS.map(t => `<li>${t}</li>`).join('')}
        </ul>
      </section>`;
  }

  _renderSettings(cfg) {
    const prefs = cfg?.prefs || {};
    const defaultVolume = prefs.defaultVolume ?? 80;
    const sec = (title, body) => `
      <section class="s-section">
        <div class="s-section-title">${title}</div>
        ${body}
      </section>`;

    return `
      <div class="menu-settings">
        ${sec('外观', `
          <div class="s-row" style="border-top:0">
            <span class="s-label">主题</span>
            <claudio-theme-toggle></claudio-theme-toggle>
          </div>
        `)}

        ${sec('音乐源', `
          <div class="s-row" style="border-top:0">
            <span class="s-label">提供方</span>
            <span class="s-val">${cfg ? cfg.musicProvider.toUpperCase() : '—'}</span>
          </div>
          <div class="s-row">
            <span class="s-label">QQ COOKIE</span>
            <span class="s-val" style="color:${cfg?.hasQQCookie ? 'var(--success)' : 'var(--text-disabled)'}">${cfg?.hasQQCookie ? '已配置' : '未配置'}</span>
          </div>
          <div class="s-hint">修改音乐源请编辑 .env 后重启服务</div>
        `)}

        ${sec('语音合成 TTS', `
          <div class="s-row" style="border-top:0">
            <span class="s-label">引擎</span>
            <span class="s-val">${cfg ? cfg.ttsProvider.toUpperCase() : '—'}</span>
          </div>
          <div class="s-row">
            <span class="s-label">音色</span>
            <span class="s-tts-voice-wrap">
              <select id="tts-voice" class="s-select">
                <option value="">系统默认</option>
              </select>
              <button id="tts-preview" class="s-btn-icon" title="试听当前音色" aria-label="试听">▶</button>
            </span>
          </div>
          <div class="s-row">
            <span class="s-label">闲聊朗读</span>
            <label class="s-toggle">
              <input id="pref-tts-chat" type="checkbox" ${prefs.ttsChat ? 'checked' : ''}/>
              <span class="s-toggle-track"><span class="s-toggle-knob"></span></span>
            </label>
          </div>
          <div class="s-hint">推荐歌曲时会自动念介绍；闲聊朗读默认关闭</div>
        `)}

        ${sec('节律调度', cfg ? `
          <div class="s-row" style="border-top:0"><span class="s-label">早间播报</span><span class="s-val">${cfg.scheduler.morning_brief}</span></div>
          <div class="s-row"><span class="s-label">第一首歌</span><span class="s-val">${cfg.scheduler.first_track}</span></div>
          <div class="s-row"><span class="s-label">整点心情</span><span class="s-val">${cfg.scheduler.hourly_mood}</span></div>
          <div class="s-row"><span class="s-label">睡前收尾</span><span class="s-val">${cfg.scheduler.wrap_up}</span></div>
        ` : '<div class="s-hint">加载中…</div>')}

        ${sec('偏好', `
          <div class="s-row" style="border-top:0">
            <span class="s-label">默认音量</span>
            <input id="pref-vol" type="range" min="0" max="100" value="${defaultVolume}" class="s-slider"/>
            <span class="s-val" id="pref-vol-val">${defaultVolume}</span>
          </div>
        `)}

        ${sec('数据', `
          <button id="clear-history" class="s-btn-danger">清空对话历史</button>
        `)}

        <div class="menu-settings__foot">
          <span>CLAUDIO FM</span>
          <span>v1.0.0</span>
        </div>
      </div>`;
  }

  _onClick(e) {
    const act = e.target?.closest('[data-act]')?.dataset?.act;
    if (act === 'close') { closeMenu(); return; }

    const tabBtn = e.target?.closest('[data-tab]');
    if (tabBtn) {
      store.set({ menuTab: tabBtn.dataset.tab });
      // 切换 tab 后重新加载下拉等异步项
      setTimeout(() => this._initSettingsAsync(), 0);
      return;
    }

    if (e.target?.id === 'clear-history') {
      if (!confirm('确定要清空所有对话历史吗？此操作不可恢复。')) return;
      api.clearHistory().then(() => {
        store.set({ messages: [] });
        alert('[已清空]');
      });
    }

    if (e.target?.id === 'tts-preview') {
      // 试听：用 select 当前选中的音色合成一句话，立即播放
      const sel = this.querySelector('#tts-voice');
      const voice = sel?.value || ''; // '' = 用 .env 默认
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = '…';
      import('../main.js')
        .then(({ speakOnly }) => speakOnly('你好，我是 Claudio，今天想听点什么？', {
          voiceOverride: voice,
          onEnd: () => { btn.disabled = false; btn.textContent = '▶'; },
        }))
        .catch(() => { btn.disabled = false; btn.textContent = '▶'; });
    }
  }

  _onInput(e) {
    if (e.target?.id === 'pref-vol') {
      const v = e.target.value;
      const valEl = this.querySelector('#pref-vol-val');
      if (valEl) valEl.textContent = v;
    }
  }

  _onChange(e) {
    const cfg = store.state.config;
    const prefs = cfg?.prefs || {};
    if (e.target?.id === 'pref-vol') {
      api.configPut({ ...prefs, defaultVolume: Number(e.target.value) })
        .then((r) => store.set({ config: { ...cfg, prefs: r.prefs } }))
        .catch(() => {});
    }
    if (e.target?.id === 'tts-voice') {
      api.configPut({ ...prefs, ttsVoice: e.target.value })
        .then((r) => store.set({ config: { ...cfg, prefs: r.prefs } }))
        .catch(() => {});
    }
    if (e.target?.id === 'pref-tts-chat') {
      api.configPut({ ...prefs, ttsChat: e.target.checked })
        .then((r) => store.set({ config: { ...cfg, prefs: r.prefs } }))
        .catch(() => {});
    }
  }

  // 设置 tab 打开后异步拉 voices 列表
  _initSettingsAsync() {
    const sel = this.querySelector('#tts-voice');
    if (!sel) return;
    const prefs = store.state.config?.prefs || {};
    fetch('/api/tts/voices').then(r => r.json()).then(({ voices = [], default: def }) => {
      const valid = new Set(voices.map(v => v.shortName));
      // 残留兼容：保存的音色不在当前 provider 的 voices 列表里（例如切换 engine 后）
      // → 自动清掉旧值并保存新默认值，避免后端拿到 invalid voice 触发 fallback
      let saved = prefs.ttsVoice || '';
      if (saved && !valid.has(saved)) {
        saved = def || '';
        api.configPut({ ...prefs, ttsVoice: saved })
          .then((r) => store.set({ config: { ...store.state.config, prefs: r.prefs } }))
          .catch(() => {});
      }
      const effective = saved || def || '';
      sel.innerHTML = '<option value="">系统默认</option>' +
        voices.map(v => `<option value="${v.shortName}" ${v.shortName === effective ? 'selected' : ''}>${v.shortName} · ${v.gender === 'Female' ? '女' : '男'} · ${v.locale}</option>`).join('');
    }).catch(() => {});
  }
}

customElements.define('claudio-menu-drawer', ClaudioMenuDrawer);

// 抽屉打开后首次加载下拉
let lastOpen = false;
store.subscribe((s) => {
  if (s.menuOpen && s.menuTab === 'settings' && !lastOpen) {
    setTimeout(() => {
      const drawer = document.querySelector('claudio-menu-drawer');
      drawer?._initSettingsAsync?.();
    }, 0);
  }
  lastOpen = s.menuOpen;
});
