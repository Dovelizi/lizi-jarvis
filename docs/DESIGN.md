# Claudio · UI / UX 设计规范（DESIGN v1.0）

| 项 | 内容 |
|---|---|
| 文档版本 | v1.0 |
| 作者 | 设计专家（虚拟角色） |
| 日期 | 2026-04-27 |
| 关联 PRD | [`./PRD.md`](./PRD.md) |
| 视觉参考 | [`../img/1.png`](../img/1.png) ~ [`../img/9.png`](../img/9.png) |

## 目录

- [1. 设计原则](#1-设计原则)
- [2. Design Tokens（CSS 变量表）](#2-design-tokenscss-变量表)
- [3. 字体系统](#3-字体系统)
- [4. 色彩系统](#4-色彩系统)
- [5. 组件规范](#5-组件规范)
- [6. 布局与栅格](#6-布局与栅格)
- [7. 响应式断点](#7-响应式断点)
- [8. 交互动效清单](#8-交互动效清单)
- [9. 可访问性](#9-可访问性)
- [10. 状态态规范](#10-状态态规范)
- [11. 图标系统](#11-图标系统)
- [12. 交付物清单](#12-交付物清单)

---

## 1. 设计原则

| # | 原则 | 含义 |
|---|---|---|
| P1 | **等宽字体即人格** | 全局采用等宽 / 点阵字体，建立"老式电台 / 终端 / LED 牌"的统一气质 |
| P2 | **点阵网格即电台氛围** | 全局背景叠 16px 间距的极淡点阵，是 Claudio 的视觉签名 |
| P3 | **留白即呼吸** | 模块间距 ≥ 24px，密度低于一般信息密集型 SaaS，让人能"听" |
| P4 | **状态即叙事** | ON AIR 呼吸圆点、LED 冒号闪烁、波形跳动——所有动态元素讲"现在还活着"的故事 |
| P5 | **DARK 与 LIGHT 是同一身份的两套时段** | 不是两个 brand，配色权重保持一致：背景退后、强调色一致绿 |

## 2. Design Tokens（CSS 变量表）

### 2.1 深色模式（默认）

```css
:root {
  /* color · base */
  --bg:              #0A0E0A;          /* 主背景 深绿黑 */
  --bg-elevated:     #131913;          /* 卡片/弹层背景 */
  --bg-input:        #0F140F;          /* 输入框/进度条底 */

  /* color · foreground */
  --fg:              #E8F5E9;          /* 主文字 */
  --fg-dim:          #8FAA90;          /* 次级文字 caption */
  --fg-muted:        #4F6650;          /* 注释/分隔线辅助 */

  /* color · accent */
  --accent:          #4ADE80;          /* ON AIR 主绿 */
  --accent-soft:     rgba(74,222,128,0.18);
  --accent-glow:     0 0 12px rgba(74,222,128,0.45);

  /* color · semantic */
  --warn:            #FACC15;
  --error:           #F87171;
  --success:         var(--accent);

  /* border & divider */
  --border:          rgba(232,245,233,0.08);
  --border-strong:   rgba(232,245,233,0.18);
  --divider:         dashed 1px var(--border);

  /* shadow */
  --shadow-card:     0 2px 8px rgba(0,0,0,0.35);
  --shadow-modal:    0 20px 60px rgba(0,0,0,0.55);

  /* dot grid */
  --dot-grid-size:   16px;
  --dot-grid-color:  rgba(74,222,128,0.08);

  /* font */
  --font-mono:       'JetBrains Mono','IBM Plex Mono',ui-monospace,monospace;
  --font-pixel:      'VT323','Press Start 2P',var(--font-mono);

  /* radius */
  --radius-card:     12px;
  --radius-btn:      6px;
  --radius-pill:     999px;

  /* spacing scale */
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px;
  --sp-4: 16px; --sp-5: 24px; --sp-6: 32px; --sp-7: 48px;

  /* motion */
  --ease-out:        cubic-bezier(.22,.61,.36,1);
  --ease-pulse:      cubic-bezier(.4,0,.2,1);
}
```

### 2.2 浅色模式

```css
[data-theme="light"] {
  --bg:              #F5F5F0;
  --bg-elevated:     #FFFFFF;
  --bg-input:        #EDEDE6;

  --fg:              #1A1A1A;
  --fg-dim:          #5A6760;
  --fg-muted:        #9AA39B;

  --accent:          #22C55E;
  --accent-soft:     rgba(34,197,94,0.15);
  --accent-glow:     0 0 10px rgba(34,197,94,0.35);

  --border:          rgba(0,0,0,0.08);
  --border-strong:   rgba(0,0,0,0.18);

  --shadow-card:     0 2px 8px rgba(0,0,0,0.06);
  --shadow-modal:    0 20px 60px rgba(0,0,0,0.18);

  --dot-grid-color:  rgba(0,0,0,0.06);
}
```

### 2.3 全局点阵背景

```css
body {
  background-color: var(--bg);
  background-image: radial-gradient(var(--dot-grid-color) 1px, transparent 1px);
  background-size: var(--dot-grid-size) var(--dot-grid-size);
  color: var(--fg);
  font-family: var(--font-mono);
}
```

## 3. 字体系统

| 角色 | font | size | weight | line-height | letter-spacing |
|---|---|---|---|---|---|
| pixel-display（LED 时钟） | `var(--font-pixel)` | 56–96px | 400 | 1 | 2px |
| h1 | `var(--font-mono)` | 28px | 600 | 1.25 | 0 |
| h2 | `var(--font-mono)` | 20px | 600 | 1.3 | 0 |
| body | `var(--font-mono)` | 14px | 400 | 1.55 | 0 |
| caption | `var(--font-mono)` | 12px | 400 | 1.4 | 0.4px |
| label / 徽章 | `var(--font-mono)` | 11px | 600 | 1 | 1.2px (UPPERCASE) |

> 推荐 Google Fonts 引入：`JetBrains Mono` + `VT323`。

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=VT323&display=swap" rel="stylesheet">
```

## 4. 色彩系统

### 4.1 深色调色板

| Token | Hex | 用途 | 截图位置 |
|---|---|---|---|
| `--bg` | `#0A0E0A` | 全局底色 | 1.png 全局 |
| `--bg-elevated` | `#131913` | 卡片 / Modal | 5.png Profile |
| `--fg` | `#E8F5E9` | 主文字 | 全局 |
| `--fg-dim` | `#8FAA90` | 次级 caption | 1.png 时间戳 |
| `--accent` | `#4ADE80` | ON AIR / 高亮 / 主按钮 | 1.png ON AIR 圆点 |
| `--border` | `rgba(232,245,233,.08)` | 卡片边 / 分割 | 1.png Player 与 LIVE 间分割 |

### 4.2 浅色调色板

| Token | Hex | 用途 |
|---|---|---|
| `--bg` | `#F5F5F0` | 全局米白 |
| `--bg-elevated` | `#FFFFFF` | 卡片 |
| `--fg` | `#1A1A1A` | 主文字 |
| `--fg-dim` | `#5A6760` | 次级 |
| `--accent` | `#22C55E` | 高亮 |

## 5. 组件规范

### 5.1 Header

```html
<header class="claudio-header">
  <div class="claudio-header__brand">
    <img class="claudio-avatar" src="claudio.png" alt="Claudio"/>
    <span class="claudio-header__name">CLAUDIO</span>
  </div>
  <nav class="claudio-header__nav">
    <button class="claudio-btn claudio-btn--ghost">LOGIN</button>
    <div class="claudio-theme-toggle">
      <button data-theme-set="dark" class="is-active">DARK</button>
      <button data-theme-set="light">LIGHT</button>
    </div>
  </nav>
</header>
```

```css
.claudio-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px var(--border) dashed;
}
.claudio-avatar { width: 28px; height: 28px; border-radius: var(--radius-pill); border: 1px solid var(--accent); }
.claudio-header__name { letter-spacing: 2px; font-weight: 600; }
```

### 5.2 LED Clock

```html
<section class="claudio-clock">
  <div class="claudio-clock__time"><span>21</span><i class="claudio-clock__colon">:</i><span>11</span></div>
  <div class="claudio-clock__date">Monday 28 APR 2026</div>
  <div class="claudio-clock__onair">
    <span class="claudio-onair__dot"></span>
    <span>ON AIR</span>
  </div>
</section>
```

```css
.claudio-clock__time { font-family: var(--font-pixel); font-size: 96px; line-height: 1; color: var(--accent); text-shadow: var(--accent-glow); }
.claudio-clock__colon { animation: blink 1s steps(2,end) infinite; }
@keyframes blink { 50% { opacity: 0; } }

.claudio-onair__dot {
  display: inline-block; width: 10px; height: 10px; border-radius: var(--radius-pill);
  background: var(--accent); box-shadow: var(--accent-glow);
  animation: breathe 2s var(--ease-pulse) infinite;
}
@keyframes breathe { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.55;transform:scale(.8)} }
```

参照 [`../img/2.png`](../img/2.png)。

### 5.3 Player Bar

```html
<section class="claudio-player">
  <div class="claudio-player__art"><svg/* mini wave */></svg></div>
  <div class="claudio-player__meta">
    <div class="claudio-player__title">Sign of the Times</div>
    <div class="claudio-player__sub">Harry Styles · PLAYING</div>
  </div>
  <div class="claudio-player__controls">
    <button aria-label="prev">⏮</button>
    <button aria-label="play/pause" class="is-primary">⏸</button>
    <button aria-label="next">⏭</button>
    <button aria-label="stop">⏹</button>
    <button aria-label="favorite">♡</button>
    <button aria-label="hide-queue">HIDE</button>
    <button aria-label="fav-list">FAV</button>
  </div>
  <input type="range" class="claudio-player__progress" min="0" max="100"/>
  <input type="range" class="claudio-player__volume" min="0" max="100"/>
</section>
```

```css
.claudio-player {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  grid-template-areas: "art meta controls" "progress progress progress";
  gap: var(--sp-3);
  padding: var(--sp-4);
  background: var(--bg-elevated);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
}
.claudio-player__title { font-weight: 600; }
.claudio-player__sub   { color: var(--fg-dim); font-size: 12px; letter-spacing: 1px; text-transform: uppercase; }
.claudio-player__controls button { background: transparent; color: var(--fg); border: 0; padding: var(--sp-2); cursor: pointer; }
.claudio-player__controls .is-primary { color: var(--accent); }
.claudio-player__progress { grid-area: progress; appearance: none; height: 2px; background: var(--border-strong); }
.claudio-player__progress::-webkit-slider-thumb { appearance: none; width: 10px; height: 10px; border-radius: 50%; background: var(--accent); }
```

参照 [`../img/2.png`](../img/2.png)。

### 5.4 Queue List

```html
<section class="claudio-queue">
  <header class="claudio-queue__header">
    <span>QUEUE</span><span>5 TRACKS</span>
  </header>
  <ul>
    <li class="claudio-queue__item is-current">
      <span class="claudio-queue__num">01</span>
      <span class="claudio-queue__name">Sign of the Times</span>
      <span class="claudio-queue__artist">Harry Styles</span>
      <span class="claudio-queue__dur">5:41</span>
    </li>
    <!-- ... -->
  </ul>
</section>
```

```css
.claudio-queue__header { display: flex; justify-content: space-between; padding: var(--sp-3) var(--sp-4); border-bottom: 1px var(--border) dashed; font-size: 12px; letter-spacing: 1.2px; color: var(--fg-dim); }
.claudio-queue__item { display: grid; grid-template-columns: 32px 1fr 1fr 48px; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border-left: 2px solid transparent; }
.claudio-queue__item.is-current { border-left-color: var(--accent); background: var(--accent-soft); }
.claudio-queue__item:hover { background: rgba(255,255,255,0.02); cursor: pointer; }
```

参照 [`../img/3.png`](../img/3.png)。

### 5.5 Live Panel

```html
<section class="claudio-live">
  <header class="claudio-live__header">
    <span class="claudio-badge claudio-badge--live">LIVE</span>
    <span class="claudio-live__status">Connected to Claudio server</span>
  </header>
  <div class="claudio-live__list" role="log" aria-live="polite">
    <!-- message bubbles -->
  </div>
</section>
```

```css
.claudio-badge--live {
  display: inline-flex; align-items: center; gap: var(--sp-1);
  padding: 2px var(--sp-2); border-radius: var(--radius-pill);
  background: var(--accent-soft); color: var(--accent); font-size: 11px; letter-spacing: 1.5px;
}
.claudio-badge--live::before { content:""; width:6px; height:6px; border-radius:50%; background: var(--accent); animation: breathe 2s infinite; }
.claudio-live__status { color: var(--fg-dim); font-size: 12px; }
```

### 5.6 Message Bubble（Claudio）

```html
<article class="claudio-msg claudio-msg--bot">
  <img class="claudio-avatar" src="claudio.png"/>
  <div class="claudio-msg__body">
    <header class="claudio-msg__head">
      <strong>CLAUDIO</strong><time>21:09</time>
      <button class="claudio-msg__replay">REPLAY</button>
    </header>
    <p class="claudio-msg__text">早安，今天云层比较厚...</p>
    <footer class="claudio-msg__meta">Now playing: Sign of the Times — Harry Styles</footer>
  </div>
</article>
```

```css
.claudio-msg { display: grid; grid-template-columns: 32px 1fr; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); }
.claudio-msg__head { display: flex; align-items: center; gap: var(--sp-2); font-size: 12px; color: var(--fg-dim); }
.claudio-msg__head strong { color: var(--accent); letter-spacing: 1.5px; }
.claudio-msg__replay { margin-left: auto; background: transparent; border: 1px solid var(--border-strong); color: var(--fg-dim); padding: 2px var(--sp-2); border-radius: var(--radius-btn); cursor: pointer; }
.claudio-msg__text { margin: var(--sp-2) 0; }
.claudio-msg__meta { color: var(--fg-muted); font-size: 11px; letter-spacing: 1px; }
```

### 5.7 Message Bubble（User）

```css
.claudio-msg--user { grid-template-columns: 1fr 32px; text-align: right; }
.claudio-msg--user .claudio-msg__body { background: var(--accent-soft); border-radius: var(--radius-card); padding: var(--sp-3); }
.claudio-msg--user .claudio-msg__head strong { color: var(--fg); }
```

参照 [`../img/9.png`](../img/9.png)。

### 5.8 Track Suggestion Card

```html
<ul class="claudio-suggest">
  <li class="claudio-suggest__item is-pick">
    <span class="claudio-suggest__star">★</span>
    <button class="claudio-suggest__play">▶</button>
    <span class="claudio-suggest__name">Sign of the Times</span>
    <span class="claudio-suggest__artist">Harry Styles</span>
  </li>
  <!-- ... -->
</ul>
```

```css
.claudio-suggest__item {
  display: grid; grid-template-columns: 16px 28px 1fr auto;
  gap: var(--sp-3); align-items: center;
  padding: var(--sp-3); border: 1px solid var(--border); border-radius: var(--radius-btn);
}
.claudio-suggest__item.is-pick { border-color: var(--accent); background: var(--accent-soft); }
.claudio-suggest__star { color: var(--accent); }
```

参照 [`../img/9.png`](../img/9.png) 中候选曲列表。

### 5.9 Input Bar

```html
<form class="claudio-input">
  <button class="claudio-input__mic" aria-label="speak">🎙</button>
  <input type="text" placeholder="Say something to the DJ…"/>
  <button class="claudio-input__send" aria-label="send">→</button>
</form>
```

```css
.claudio-input {
  display: flex; align-items: center; gap: var(--sp-2);
  background: var(--bg-input); border: 1px solid var(--border);
  border-radius: var(--radius-pill); padding: var(--sp-2) var(--sp-3);
}
.claudio-input input { flex: 1; background: transparent; border: 0; color: var(--fg); font-family: inherit; outline: none; }
.claudio-input__mic, .claudio-input__send {
  width: 32px; height: 32px; border-radius: var(--radius-pill);
  background: var(--accent-soft); color: var(--accent); border: 0; cursor: pointer;
}
.claudio-input__send { background: var(--accent); color: var(--bg); }
```

### 5.10 Profile Modal

```html
<div class="claudio-modal" role="dialog" aria-modal="true">
  <div class="claudio-modal__backdrop"></div>
  <div class="claudio-modal__card">
    <img class="claudio-modal__avatar" src="claudio.png"/>
    <h2>Claudio</h2>
    <p class="claudio-modal__tagline">"一开机我就打碟"</p>
    <p class="claudio-modal__bio">Your mood is my prompt. I hate algorithm. I have taste.</p>
    <dl class="claudio-modal__stats">
      <div><dt>ON AIR</dt><dd>24-7</dd></div>
      <div><dt>GENRES</dt><dd>∞</dd></div>
      <div><dt>LISTENER</dt><dd>1</dd></div>
    </dl>
    <ul class="claudio-tags">
      <li>JAZZ-HIPHOP</li><li>NEO-CLASSICAL</li><li>90S 华语</li>
      <li>HIP-HOP</li><li>柴可夫斯基 + EMINEM</li><li>J-ROCK</li>
      <li>下雨白噪音</li><li>POST-PUNK</li><li>SHIBUYA-KEI</li>
    </ul>
  </div>
</div>
```

```css
.claudio-modal__backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(8px); }
.claudio-modal__card {
  position: fixed; left: 50%; top: 50%; transform: translate(-50%,-50%);
  background: var(--bg-elevated); padding: var(--sp-6); border-radius: var(--radius-card);
  box-shadow: var(--shadow-modal); width: min(480px, 92vw); text-align: center;
}
.claudio-modal__avatar { width: 96px; height: 96px; border-radius: var(--radius-pill); border: 2px solid var(--accent); }
.claudio-modal__stats { display: grid; grid-template-columns: repeat(3,1fr); margin: var(--sp-5) 0; }
.claudio-modal__stats dt { color: var(--fg-dim); font-size: 11px; letter-spacing: 1.5px; }
.claudio-modal__stats dd { color: var(--accent); font-size: 24px; font-family: var(--font-pixel); }
.claudio-tags { display: flex; flex-wrap: wrap; gap: var(--sp-2); justify-content: center; }
.claudio-tags li { padding: 4px var(--sp-3); border: 1px solid var(--border-strong); border-radius: var(--radius-pill); font-size: 11px; letter-spacing: 1px; }
```

参照 [`../img/5.png`](../img/5.png) [`../img/7.png`](../img/7.png)。

### 5.11 Speaking State（手机竖屏）

```html
<main class="claudio-speaking">
  <canvas class="claudio-speaking__wave"></canvas>
  <article class="claudio-speaking__card">
    <h3>Sign of the Times</h3>
    <p>Harry Styles · A Human Odyssey</p>
    <progress value="42" max="100"></progress>
  </article>
  <ol class="claudio-lyrics">
    <li class="is-past">…</li>
    <li class="is-current">…<mark>关键词</mark></li>
    <li class="is-future">…</li>
  </ol>
</main>
```

```css
.claudio-speaking { display: flex; flex-direction: column; gap: var(--sp-5); padding: var(--sp-5); min-height: 100vh; }
.claudio-speaking__wave { height: 160px; background: var(--bg-elevated); border-radius: var(--radius-card); }
.claudio-speaking__card { background: #FFFFFF; color: #111; padding: var(--sp-4); border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.claudio-lyrics { list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--sp-3); }
.claudio-lyrics .is-past    { opacity: 0.35; }
.claudio-lyrics .is-current { opacity: 1; font-size: 18px; }
.claudio-lyrics .is-current mark { background: var(--accent-soft); color: var(--accent); padding: 0 4px; border-radius: 4px; }
.claudio-lyrics .is-future  { opacity: 0.55; }
```

参照 [`../img/4.png`](../img/4.png) [`../img/6.png`](../img/6.png)。

### 5.12 Theme Toggle

```css
.claudio-theme-toggle { display: inline-flex; border: 1px solid var(--border-strong); border-radius: var(--radius-btn); overflow: hidden; }
.claudio-theme-toggle button { background: transparent; color: var(--fg-dim); border: 0; padding: 4px var(--sp-3); font-family: inherit; letter-spacing: 1.5px; cursor: pointer; }
.claudio-theme-toggle button.is-active { background: var(--accent); color: var(--bg); }
```

## 6. 布局与栅格

桌面主界面采用单列垂直流：

```
┌──────────────────────────────────────┐
│ Header（48px）                        │
├──────────────────────────────────────┤
│ LED Clock + ON AIR        （180px）   │
├──────────────────────────────────────┤
│ Player Bar               （96px）     │
├──────────────────────────────────────┤
│ Queue List              （flex）      │
├──────────────────────────────────────┤
│ LIVE Panel              （flex）      │
├──────────────────────────────────────┤
│ Input Bar               （56px）      │
└──────────────────────────────────────┘
```

容器最大宽度 `max-width: 1080px`，左右居中，外边距 `--sp-5`。

## 7. 响应式断点

| 断点 | 宽度 | 主要变化 |
|---|---|---|
| mobile | < 768px | LED Clock 缩到 56px，Player 控件折成 2 行；启用 Speaking 路由 `/speaking` |
| tablet | 768–1024px | 容器 `max-width: 720px`；Profile Modal 全宽 92vw |
| desktop | > 1024px | 容器 1080px；Queue 与 LIVE 可并排两列布局（可选） |

## 8. 交互动效清单

| # | 元素 | 触发 | duration | easing | 描述 |
|---|---|---|---|---|---|
| 1 | LED 冒号 | 常驻 | 1s | steps(2,end) | 50% 隐藏 / 50% 显示 |
| 2 | ON AIR 圆点 | 常驻 | 2s | ease-pulse | opacity 1→.55，scale 1→.8 |
| 3 | 波形可视化 | 播放/TTS 时 | real-time | — | requestAnimationFrame + AnalyserNode |
| 4 | 歌词逐行 | 时间戳到达 | 380ms | ease-out | translateY(8px) + opacity 0→1，关键词底色高亮 |
| 5 | LIVE 气泡入场 | 新消息 | 240ms | ease-out | translateY(8px) + opacity 0→1 |
| 6 | Modal 出现 | 打开 | 220ms | ease-out | backdrop opacity 0→1，card scale .96→1 |
| 7 | 主题切换 | 点击 | 300ms | ease-out | `transition: background .3s, color .3s` 全局 |
| 8 | 候选曲卡 hover | hover | 160ms | ease-out | border 颜色淡化为 accent |
| 9 | 队列项 hover | hover | 120ms | ease-out | background 0.02 alpha |
| 10 | 输入框 focus | focus | 180ms | ease-out | border 由 dim 转 accent |

## 9. 可访问性

- 全局对比度 ≥ AA：深色模式 `--fg` on `--bg` 计算对比度 13:1，`--fg-dim` 5.2:1，`--accent` 8:1
- 全局 `:focus-visible` 加 2px outline，颜色 `var(--accent)`，offset 2px
- 所有按钮有 `aria-label`
- LIVE 列表用 `role="log" aria-live="polite"`
- Modal 用 `role="dialog" aria-modal="true"`，trap focus；ESC 关闭
- 键盘快捷键：Space 播放/暂停、← / → 上下首、L 切主题、/ 聚焦输入框

## 10. 状态态规范

| 状态 | 视觉 |
|---|---|
| empty（无消息） | LIVE 区中央显示一行 caption `// silence is also a song` |
| loading | 骨架屏使用 `linear-gradient(90deg, var(--bg-elevated), rgba(255,255,255,.04), var(--bg-elevated))` shimmer 1.4s |
| error | 顶部贴一条 8px 高 `--error` 条 + 一行说明，可点击重试 |
| offline | Header `ON AIR` 变为 `OFF AIR`，圆点灰色不呼吸；底部弹一条 toast `Reconnecting…` |

## 11. 图标系统

优先使用 [Lucide](https://lucide.dev) 图标 + 少量 unicode：

| 用途 | 图标 |
|---|---|
| 上一首 | `lucide:skip-back` |
| 下一首 | `lucide:skip-forward` |
| 播放 | `lucide:play` |
| 暂停 | `lucide:pause` |
| 停止 | `lucide:square` |
| 收藏 | `lucide:heart` |
| 麦克风 | `lucide:mic` |
| 发送 | `lucide:arrow-right` |
| 队列 | `lucide:list-music` |
| 主题 | `lucide:sun` / `lucide:moon` |
| ★ 高亮 | unicode `★` |

## 12. 交付物清单

- [`/pwa/src/styles/tokens.css`](../pwa/src/styles/tokens.css)：本规范第 2 节 CSS 变量
- [`/pwa/src/styles/components.css`](../pwa/src/styles/components.css)：本规范第 5 节组件样式
- [`/pwa/public/fonts/`](../pwa/public/fonts/)：JetBrains Mono / VT323 自托管副本（避免依赖 Google Fonts CDN）
- [`/pwa/public/icons/`](../pwa/public/icons/)：Lucide SVG sprite

---

*[Contains Unverified Assumptions]：5.1 ~ 5.12 的具体 DOM 命名为参考实现，开发可在不破坏视觉的前提下调整；色值取自截图肉眼采样，存在 ±3 的偏差，开发完成后需对图复核。*
