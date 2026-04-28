import { store } from '../store.js';

const TAGS = [
  'JAZZ-HIPHOP', 'NEO-CLASSICAL', '90S 华语', 'HIP-HOP',
  '柴可夫斯基 + EMINEM', 'J-ROCK', '下雨白噪音', 'POST-PUNK', 'SHIBUYA-KEI',
];

class ClaudioProfileModal extends HTMLElement {
  connectedCallback() {
    this._unsub = store.subscribe(() => this.render());
    this.addEventListener('click', (e) => this._onClick(e));
    this._onKey = (e) => { if (e.key === 'Escape') store.set({ profileOpen: false }); };
    document.addEventListener('keydown', this._onKey);
    this.render();
  }
  disconnectedCallback() {
    this._unsub && this._unsub();
    document.removeEventListener('keydown', this._onKey);
  }

  render() {
    if (!store.state.profileOpen) { this.innerHTML = ''; return; }
    this.innerHTML = `
      <div class="claudio-modal__backdrop" data-act="close"></div>
      <div class="claudio-modal__card" role="dialog" aria-modal="true" aria-label="Claudio profile">
        <div class="claudio-modal__avatar">C</div>
        <h2>Claudio</h2>
        <p class="claudio-modal__tagline">"一开机我就打碟"</p>
        <p class="claudio-modal__bio">Your mood is my prompt. I hate algorithm. I have taste.</p>
        <dl class="claudio-modal__stats">
          <div><dt>ON AIR</dt><dd>24-7</dd></div>
          <div><dt>GENRES</dt><dd>∞</dd></div>
          <div><dt>LISTENER</dt><dd>1</dd></div>
        </dl>
        <ul class="claudio-tags">
          ${TAGS.map(t => `<li>${t}</li>`).join('')}
        </ul>
      </div>`;
  }

  _onClick(e) {
    if (e.target?.dataset?.act === 'close') store.set({ profileOpen: false });
  }
}

customElements.define('claudio-profile-modal', ClaudioProfileModal);
