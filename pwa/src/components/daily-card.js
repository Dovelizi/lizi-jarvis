import { store } from '../store.js';
import { api } from '../api.js';

class ClaudioDailyCard extends HTMLElement {
  connectedCallback() {
    this._unsub = store.subscribe(() => this.render());
    this.addEventListener('click', (e) => {
      const btn = e.target?.closest('[data-act="refresh"]');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        this._load(true);
      }
    });
    this._load();
    this.render();
  }
  disconnectedCallback() { this._unsub && this._unsub(); }

  async _load(force = false) {
    // 一天一次：localStorage 记今天日期
    const today = new Date().toISOString().slice(0, 10);
    const cacheDate = localStorage.getItem('daily_date');
    const cacheText = localStorage.getItem('daily_text');
    if (!force && cacheDate === today && cacheText) {
      store.set({ daily: { quote: cacheText, cached: true, date: today } });
      return;
    }
    // 强制刷新：先显示 loading 提示
    if (force) {
      store.set({ daily: { quote: '换一句…', cached: false, date: today } });
      // 强制刷新时清缓存日期，让服务端真的返回新内容
      localStorage.removeItem('daily_date');
    }
    try {
      const r = await api.daily(force);
      if (r?.quote) {
        store.set({ daily: r });
        localStorage.setItem('daily_date', r.date || today);
        localStorage.setItem('daily_text', r.quote);
      } else if (force) {
        store.set({ daily: { quote: '[换不出来了]', cached: false, date: today } });
      }
    } catch (_) {
      if (force) store.set({ daily: { quote: '[网络错误，稍后再试]', cached: false, date: today } });
    }
  }

  render() {
    const d = store.state.daily;
    const text = d?.quote || '加载中…';
    this.innerHTML = `
      <section class="claudio-card claudio-daily">
        <header class="claudio-daily__head">
          <span class="claudio-card__label">每日一言</span>
          <button class="claudio-daily__refresh" data-act="refresh" aria-label="刷新">↻</button>
        </header>
        <p class="claudio-daily__text">${escape(text)}</p>
      </section>`;
  }
}

function escape(s) { return String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }

customElements.define('claudio-daily-card', ClaudioDailyCard);
