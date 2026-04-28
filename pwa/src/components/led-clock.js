const WEEKDAYS_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

class ClaudioLedClock extends HTMLElement {
  connectedCallback() {
    this.render();
    this._timer = setInterval(() => this.render(), 1000);
  }
  disconnectedCallback() { clearInterval(this._timer); }
  render() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const weekday = WEEKDAYS_CN[d.getDay()];
    const yyyy = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    this.innerHTML = `
      <section class="claudio-card claudio-clock">
        <header class="claudio-card__label">本地时间</header>
        <div class="claudio-clock__time">
          <span class="claudio-clock__dot"></span>
          <span>${hh}</span><i class="claudio-clock__colon">:</i><span>${mm}</span>
        </div>
        <div class="claudio-clock__date">
          <span>${weekday}</span>
          <span class="claudio-clock__date-line2">${yyyy}.${mo}.${dd}</span>
        </div>
      </section>`;
  }
}
customElements.define('claudio-led-clock', ClaudioLedClock);
