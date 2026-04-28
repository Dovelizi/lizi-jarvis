import { store } from '../store.js';
import { api } from '../api.js';

class ClaudioWeatherCard extends HTMLElement {
  connectedCallback() {
    this._unsub = store.subscribe(() => this.render());
    this._load();
    // 每 30min 刷新一次
    this._timer = setInterval(() => this._load(), 30 * 60 * 1000);
    this.render();
  }
  disconnectedCallback() {
    this._unsub && this._unsub();
    clearInterval(this._timer);
  }
  async _load() {
    try {
      const w = await api.weather();
      store.set({ weather: w });
    } catch (_) { /* 静默 */ }
  }
  render() {
    const w = store.state.weather;
    if (!w?.available) {
      this.innerHTML = `
        <section class="claudio-card claudio-weather">
          <div class="claudio-card__label">天气</div>
          <div class="claudio-card__hint">未配置或拉取失败</div>
        </section>`;
      return;
    }
    this.innerHTML = `
      <section class="claudio-card claudio-weather">
        <div class="claudio-card__label">天气</div>
        <div class="claudio-weather__main">
          <span class="claudio-weather__temp">${w.temp}<sup>°</sup></span>
          <span class="claudio-weather__text">${w.text || ''}</span>
        </div>
        <div class="claudio-weather__sub">${w.wind || ''} · 湿度 ${w.humidity || '—'}%</div>
      </section>`;
  }
}
customElements.define('claudio-weather-card', ClaudioWeatherCard);
