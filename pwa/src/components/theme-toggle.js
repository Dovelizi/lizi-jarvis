import { store, setTheme } from '../store.js';

class ClaudioThemeToggle extends HTMLElement {
  connectedCallback() {
    this._unsub = store.subscribe(() => this.render());
    this.addEventListener('click', (e) => {
      const t = e.target?.closest('[data-theme-set]')?.dataset?.themeSet;
      if (t && t !== store.state.theme) setTheme(t);
    });
    this.render();
  }
  disconnectedCallback() { this._unsub && this._unsub(); }
  render() {
    const t = store.state.theme;
    this.innerHTML = `
      <div class="claudio-theme-toggle">
        <button data-theme-set="dark"  class="${t === 'dark'  ? 'is-active' : ''}">深色</button>
        <button data-theme-set="light" class="${t === 'light' ? 'is-active' : ''}">浅色</button>
      </div>`;
  }
}
customElements.define('claudio-theme-toggle', ClaudioThemeToggle);
