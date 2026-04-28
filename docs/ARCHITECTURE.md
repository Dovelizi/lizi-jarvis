# Claudio · 技术架构与开发方案（ARCHITECTURE v1.0）

| 项 | 内容 |
|---|---|
| 文档版本 | v1.0 |
| 作者 | 开发专家（虚拟角色） |
| 日期 | 2026-04-27 |
| 关联文档 | [`./PRD.md`](./PRD.md) [`./DESIGN.md`](./DESIGN.md) |
| 关联施工图 | [`../img/main.png`](../img/main.png) |

## 目录

- [1. 总体架构](#1-总体架构)
- [2. 技术栈选型](#2-技术栈选型)
- [3. 目录结构](#3-目录结构)
- [4. 后端模块设计](#4-后端模块设计)
- [5. 前端模块设计](#5-前端模块设计)
- [6. 数据库设计](#6-数据库设计)
- [7. HTTP / WS 契约实现](#7-http--ws-契约实现)
- [8. Brain Adapter 详细设计](#8-brain-adapter-详细设计)
- [9. MusicProvider 抽象与 QQ 音乐实现](#9-musicprovider-抽象与-qq-音乐实现)
- [10. 调度器 scheduler.js](#10-调度器-schedulerjs)
- [11. 配置文件 .env.example](#11-配置文件-envexample)
- [12. 启动与运行](#12-启动与运行)
- [13. 边界与降级](#13-边界与降级)
- [14. 扩展点](#14-扩展点)

---

## 1. 总体架构

完全对齐 [`../img/main.png`](../img/main.png) 四层施工图：

```
┌──────────────── 第四层：PWA 前端 ────────────────┐
│   Vite + 原生 Web Components + Service Worker    │
└────────────┬─────────────────────────────────────┘
             │ HTTP × 5  +  WS × 1
┌────────────▼─────────────────────────────────────┐
│   第二层：本地大脑（Node.js Express + ws）        │
│   router · context · claude · scheduler · tts    │
│   ─────────────────────────────────────────      │
│   第三层：Context Window（claude 调用前组装）     │
└────────────┬─────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────┐
│   第一层：外部上下文                              │
│   Claude CLI (子进程)  ·  QQ 音乐 (Cookie)        │
│   QWeather  ·  Web Speech / Fish TTS  ·  飞书    │
└──────────────────────────────────────────────────┘
```

## 2. 技术栈选型

| 层 | 技术 | 理由 |
|---|---|---|
| 后端运行时 | Node.js ≥ 20 | 支持原生 fetch / structuredClone / `node:test` |
| Web 框架 | `express` v4 + `ws` v8 | 轻、稳、生态成熟，单机本地服务无需重型框架 |
| 持久化 | `better-sqlite3` v11 | 同步 API、零依赖、单文件、足够满足本地单用户 |
| 子进程 | `node:child_process` 内置 | spawn `claude -p --output-format json` |
| 调度 | `node-cron` | 支持 cron 表达式 + 时区 |
| 日志 | `pino` + `pino-pretty`(dev) | 结构化、低开销 |
| 配置 | `dotenv` | 集中读 `.env` |
| 前端构建 | `vite` v5 | 快、HMR、PWA 插件完善 |
| 前端框架 | 原生 ESM + Web Components | 体量极小，符合"本地单用户 PWA"定位；如需 React 可在二期切换 |
| PWA | `vite-plugin-pwa` | Service Worker、manifest 自动生成 |
| 样式 | 原生 CSS 变量（已在 DESIGN.md 定义） | 无运行时开销，与 token 系统对齐 |
| 前端测试 | `vitest` + `@playwright/test` | 单测 + e2e |
| 后端测试 | `node:test` 内置 | 零依赖 |

> 不引入 React/Vue/Tailwind 等重型依赖，符合规则 §工程技术基线 "禁止引入非必要第三方依赖"。

## 3. 目录结构

```
liziJarvis/
├─ docs/                      # 五份文档
│  ├─ PRD.md
│  ├─ DESIGN.md
│  ├─ ARCHITECTURE.md         # 本文件
│  ├─ TEST_PLAN.md
│  └─ ROADMAP.md
├─ img/                       # 设计参考截图
├─ server/
│  ├─ package.json
│  ├─ src/
│  │  ├─ index.js             # 入口：Express + WS 启动
│  │  ├─ router.js            # 意图分流 + HTTP 路由
│  │  ├─ context.js           # 上下文窗口组装（6 片）
│  │  ├─ claude.js            # Brain Adapter（CLI 子进程）
│  │  ├─ scheduler.js         # 节律调度（cron）
│  │  ├─ tts.js               # 语音合成调度（前端 / Fish）
│  │  ├─ state.js             # SQLite 封装
│  │  ├─ logger.js            # pino 实例
│  │  ├─ config.js            # 读 .env + 校验
│  │  ├─ providers/
│  │  │  ├─ music/
│  │  │  │  ├─ index.js       # MusicProvider 抽象 + 工厂
│  │  │  │  ├─ qq.js          # QQ 音乐（Cookie）
│  │  │  │  └─ mock.js        # 本地 mp3
│  │  │  └─ weather/
│  │  │     └─ qweather.js
│  │  └─ ws.js                # WS 广播总线
│  ├─ data/
│  │  ├─ state.db             # 运行时生成（gitignore）
│  │  └─ mock/                # Mock provider 的样曲
│  └─ test/
│     ├─ router.test.js
│     ├─ claude.test.js
│     └─ providers.test.js
├─ pwa/
│  ├─ package.json
│  ├─ vite.config.js
│  ├─ index.html
│  ├─ public/
│  │  ├─ manifest.webmanifest
│  │  ├─ icons/
│  │  └─ fonts/
│  └─ src/
│     ├─ main.js              # 应用入口
│     ├─ api.js               # fetch + WS 客户端
│     ├─ store.js             # 简易状态总线（pub/sub）
│     ├─ styles/
│     │  ├─ tokens.css        # DESIGN.md §2
│     │  └─ components.css    # DESIGN.md §5
│     ├─ components/
│     │  ├─ led-clock.js
│     │  ├─ player-bar.js
│     │  ├─ queue-list.js
│     │  ├─ live-panel.js
│     │  ├─ msg-bubble.js
│     │  ├─ input-bar.js
│     │  ├─ profile-modal.js
│     │  ├─ theme-toggle.js
│     │  └─ speaking-view.js
│     └─ pages/
│        ├─ home.js
│        └─ speaking.js
├─ user/                      # 用户品味语料（gitignore，模板由后端首启生成）
│  ├─ taste.md
│  ├─ routines.md
│  ├─ playlists.json
│  └─ mood-rules.md
├─ .env.example               # 全部密钥的统一配置范本
├─ .gitignore
└─ README.md
```

## 4. 后端模块设计

### 4.1 `index.js` 入口

```js
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { logger } from './logger.js';
import { initState } from './state.js';
import { mountRoutes } from './router.js';
import { startScheduler } from './scheduler.js';
import { attachWS } from './ws.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static('../pwa/dist'));   // 生产模式直接吐 PWA build

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/stream' });

await initState();
mountRoutes(app);
attachWS(wss);
startScheduler();

server.listen(config.PORT, '127.0.0.1', () => {
  logger.info({ port: config.PORT }, 'Claudio is on air');
});
```

### 4.2 `router.js` 意图分流

```js
const PLAY_PATTERNS = [
  /^播放\s*(.+)/i, /^来一首\s*(.+)/, /^换一首/, /^下一首/, /^上一首/,
  /^暂停/, /^继续/, /^停止/, /^收藏/, /^音量\s*(\d+)/
];

export function classifyIntent(text) {
  for (const p of PLAY_PATTERNS) {
    const m = text.match(p);
    if (m) return { kind: 'control', pattern: p.source, args: m.slice(1) };
  }
  return { kind: 'chat' };
}
```

`mountRoutes(app)` 注册 6 条接口（详见 §7）。

### 4.3 `context.js` 上下文窗口（6 片）

```js
export async function buildContext({ userInput, recentMessages }) {
  return {
    system:    await loadSystemPrompt(),         // P1 系统提示词
    taste:     await loadUserCorpus(),           // P2 用户语料
    env:       await loadEnv(),                  // P3 时间 + 天气 + 当前播放
    memory:    await retrieveMemory(userInput),  // P4 SQLite 检索相关历史
    input:     userInput,                        // P5 用户输入
    trace:     recentMessages,                   // P6 最近 N 条对话
  };
}
```

`loadEnv` 读 `providers/weather/qweather.js` 的缓存（5 分钟 TTL，避免每次调用都打 QWeather）。

### 4.4 `claude.js` Brain Adapter

详见 §8。

### 4.5 `state.js` SQLite 封装

```js
import Database from 'better-sqlite3';
const db = new Database('./data/state.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY, ts INTEGER, role TEXT, text TEXT, meta TEXT
  );
  CREATE TABLE IF NOT EXISTS plays (
    id INTEGER PRIMARY KEY, ts INTEGER, song_id TEXT, name TEXT, artist TEXT, source TEXT, dur_played INTEGER, liked INTEGER
  );
  CREATE TABLE IF NOT EXISTS plan (
    date TEXT PRIMARY KEY, blocks TEXT
  );
  CREATE TABLE IF NOT EXISTS prefs (
    k TEXT PRIMARY KEY, v TEXT
  );
`);

// 全部使用 prepared statement，对齐 security_rules Rule 1
export const insertMessage = db.prepare('INSERT INTO messages (ts,role,text,meta) VALUES (?,?,?,?)');
export const listMessages  = db.prepare('SELECT * FROM messages ORDER BY ts DESC LIMIT ?');
// ... 其余 CRUD
```

## 5. 前端模块设计

### 5.1 `main.js`

```js
import './styles/tokens.css';
import './styles/components.css';
import './components/led-clock.js';
import './components/player-bar.js';
// ...
import { router } from './router.js';

router.start();   // 监听 hashchange，渲染 home / speaking
```

### 5.2 Web Components 约定

每个组件一个文件，`customElements.define('claudio-xxx', class extends HTMLElement)`，shadow DOM 关闭（继承全局 token）。

```js
// components/led-clock.js
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
    this.innerHTML = `
      <div class="claudio-clock">
        <div class="claudio-clock__time"><span>${hh}</span><i class="claudio-clock__colon">:</i><span>${mm}</span></div>
        <div class="claudio-clock__date">${d.toDateString().toUpperCase()}</div>
        <div class="claudio-clock__onair"><span class="claudio-onair__dot"></span><span>ON AIR</span></div>
      </div>`;
  }
}
customElements.define('claudio-led-clock', ClaudioLedClock);
```

### 5.3 `api.js` 客户端

```js
const BASE = location.origin;
export const api = {
  chat: (text) => fetch(`${BASE}/api/chat`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text}) }).then(r => r.json()),
  now:  () => fetch(`${BASE}/api/now`).then(r => r.json()),
  next: () => fetch(`${BASE}/api/next`).then(r => r.json()),
  taste:() => fetch(`${BASE}/api/taste`).then(r => r.json()),
  plan: () => fetch(`${BASE}/api/plan/today`).then(r => r.json()),
};

export function openStream(onMsg) {
  const ws = new WebSocket(`ws://${location.host}/stream`);
  ws.onmessage = (e) => onMsg(JSON.parse(e.data));
  ws.onclose = () => setTimeout(() => openStream(onMsg), 2000);  // 简易重连
  return ws;
}
```

### 5.4 `store.js`

```js
const subs = new Map();
export const store = {
  state: { now: null, queue: [], messages: [], theme: localStorage.getItem('theme') || 'dark' },
  set(patch) { Object.assign(this.state, patch); subs.forEach(fn => fn(this.state)); },
  subscribe(fn) { const k = Symbol(); subs.set(k, fn); return () => subs.delete(k); }
};
```

## 6. 数据库设计

| 表 | 字段 | 说明 |
|---|---|---|
| `messages` | id, ts, role(`user`/`bot`/`system`), text, meta(JSON) | 对话流持久化 |
| `plays` | id, ts, song_id, name, artist, source, dur_played, liked | 播放历史，供"已检索记忆" |
| `plan` | date(PK), blocks(JSON 数组) | `/api/plan/today` 返回值 |
| `prefs` | k(PK), v | 主题、音量、最近一次队列等键值 |

> SQL 全部使用 `db.prepare(...).run(...)` 参数化，**严禁字符串拼接**（security_rules Rule 1）。

## 7. HTTP / WS 契约实现

### 7.1 `POST /api/chat`

```js
app.post('/api/chat', async (req, res) => {
  const { text } = req.body;
  if (typeof text !== 'string' || text.length > 2000) return res.status(400).json({ error: 'invalid text' });

  insertMessage.run(Date.now(), 'user', text, null);

  const intent = classifyIntent(text);
  if (intent.kind === 'control') {
    const r = await musicProvider.handle(intent);
    broadcast({ type: 'now_changed', song: r.song });
    return res.json({ say: r.say, play: [r.song] });
  }

  const ctx = await buildContext({ userInput: text, recentMessages: lastN(20) });
  const brain = await claude.ask(ctx);                  // §8
  const parsed = safeParseBrainOutput(brain);           // 容错解析
  insertMessage.run(Date.now(), 'bot', parsed.say, JSON.stringify(parsed));

  if (parsed.play?.length) await musicProvider.enqueue(parsed.play);
  broadcast({ type: 'claudio_say', ts: Date.now(), text: parsed.say });
  res.json(parsed);
});
```

### 7.2 `GET /api/now` / `GET /api/next`

直接读 `musicProvider.current()` / `musicProvider.queue()`。

### 7.3 `GET /api/taste`

```js
app.get('/api/taste', async (_, res) => {
  const [taste, routines, playlists, moodRules] = await Promise.all([
    fs.readFile('../user/taste.md', 'utf8').catch(() => ''),
    fs.readFile('../user/routines.md', 'utf8').catch(() => ''),
    fs.readFile('../user/playlists.json', 'utf8').catch(() => '[]').then(JSON.parse),
    fs.readFile('../user/mood-rules.md', 'utf8').catch(() => ''),
  ]);
  res.json({ taste, routines, playlists, moodRules });
});
```

### 7.4 `GET /api/plan/today`

```js
app.get('/api/plan/today', (_, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const row = db.prepare('SELECT blocks FROM plan WHERE date = ?').get(today);
  res.json({ date: today, blocks: row ? JSON.parse(row.blocks) : [] });
});
```

### 7.5 `WS /stream`

```js
// ws.js
const clients = new Set();
export function attachWS(wss) {
  wss.on('connection', (ws) => { clients.add(ws); ws.on('close', () => clients.delete(ws)); });
}
export function broadcast(evt) {
  const data = JSON.stringify(evt);
  for (const c of clients) if (c.readyState === 1) c.send(data);
}
```

事件类型与 PRD §8.6 一致。

## 8. Brain Adapter 详细设计

```js
// claude.js
import { spawn } from 'node:child_process';
import { config } from './config.js';
import { logger } from './logger.js';

export const claude = {
  ask(ctx, { timeoutMs = 30_000 } = {}) {
    return new Promise((resolve, reject) => {
      const cmd  = config.BRAIN_CLI_CMD;                                  // 默认 "claude"
      const args = config.BRAIN_CLI_ARGS.split(/\s+/);                    // 默认 "-p --output-format json"
      const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });

      const prompt = renderPrompt(ctx);  // 把 6 片拼成 markdown 块塞 stdin
      child.stdin.write(prompt);
      child.stdin.end();

      let stdout = '', stderr = '';
      child.stdout.on('data', d => stdout += d);
      child.stderr.on('data', d => stderr += d);

      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('brain timeout')); }, timeoutMs);

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          logger.warn({ code, stderr }, 'brain exited non-zero');
          return resolve({ say: '我在打盹，稍后再聊', play: [], reason: 'brain unavailable' });
        }
        resolve({ raw: stdout });
      });
    });
  }
};

export function safeParseBrainOutput({ raw }) {
  if (!raw) return { say: '...', play: [] };
  // 1) 优先尝试整体 JSON.parse（DeepSeek/Claude 都可能直接返回 JSON）
  try { return normalize(JSON.parse(raw)); } catch (_) {}
  // 2) 提取 ```json ... ``` 代码块
  const m = raw.match(/```json\s*([\s\S]*?)```/);
  if (m) { try { return normalize(JSON.parse(m[1])); } catch (_) {} }
  // 3) 兜底：把整段文本作为 say
  return { say: raw.trim(), play: [], reason: 'plain-text fallback' };
}

function normalize(o) {
  return {
    say:    typeof o.say === 'string' ? o.say : '',
    play:   Array.isArray(o.play) ? o.play : [],
    reason: o.reason ?? '',
    segue:  o.segue  ?? '',
  };
}
```

> 注：用户已声明"本机 claude CLI 配置的是 DeepSeek 密钥"。`safeParseBrainOutput` 三层兜底保证即使 DeepSeek 输出 schema 与 Anthropic 官方略有差异也能容错。

## 9. MusicProvider 抽象与 QQ 音乐实现

### 9.1 抽象接口

```js
// providers/music/index.js
export class MusicProvider {
  async search(keyword)  { throw new Error('not impl'); }   // → [{songId,name,artist,duration,album}]
  async getUrl(songId)   { throw new Error('not impl'); }   // → string (mp3 url)
  async getLyric(songId) { throw new Error('not impl'); }   // → string (LRC)
  async recommend(seed)  { throw new Error('not impl'); }   // → [...]
}
```

工厂：

```js
import { QQMusicProvider } from './qq.js';
import { MockProvider }    from './mock.js';
import { config }          from '../../config.js';

export function createMusicProvider() {
  if (config.QQ_MUSIC_COOKIE) {
    try { return new QQMusicProvider(config.QQ_MUSIC_COOKIE); }
    catch (e) { logger.error({ e }, 'QQ provider init failed, fallback to mock'); }
  }
  logger.warn('QQ_MUSIC_COOKIE 未配置，使用 MockProvider');
  return new MockProvider();
}
```

### 9.2 QQ 音乐 Cookie 实现要点

```js
// providers/music/qq.js
const BASE = 'https://u.y.qq.com/cgi-bin/musicu.fcg';

export class QQMusicProvider extends MusicProvider {
  constructor(cookie) { super(); this.cookie = cookie; }

  async search(keyword) {
    const body = { /* 搜索接口 payload，对应 music.search.SearchCgiService */ };
    const r = await fetch(BASE, {
      method: 'POST',
      headers: { 'Cookie': this.cookie, 'Content-Type': 'application/json', 'Referer': 'https://y.qq.com/' },
      body: JSON.stringify(body),
    });
    const json = await r.json();
    return parseSearch(json);
  }

  async getUrl(songId) {
    // 调用 vkey 接口换取播放直链
    // ...
  }

  async getLyric(songId) {
    // 调用 lyric.fcg
  }

  async recommend(seed) {
    // 走相似歌曲接口
  }
}
```

> ⚠️ **法律与稳定性提示**（对应 PRD §14 开放问题）：QQ 音乐接口非官方公开，仅限个人本地非商业使用。Cookie 失效后会自动 fallback 到 MockProvider，不阻塞产品启动。

### 9.3 MockProvider

读取 `server/data/mock/*.mp3` + 同名 `.json`（含 name/artist/lyric），用于无 Cookie 场景与离线测试。

## 10. 调度器 scheduler.js

```js
import cron from 'node-cron';
import { broadcast } from './ws.js';
import { claude } from './claude.js';
import { buildContext } from './context.js';

export function startScheduler() {
  // 07:00 早间规划
  cron.schedule('0 7 * * *', () => triggerBrief('morning'), { timezone: 'Asia/Shanghai' });
  // 09:00 单曲推荐
  cron.schedule('0 9 * * *', () => triggerBrief('first_track'), { timezone: 'Asia/Shanghai' });
  // 整点情绪检查
  cron.schedule('0 * * * *', () => triggerBrief('hourly_mood'), { timezone: 'Asia/Shanghai' });
  // 22:00 收尾
  cron.schedule('0 22 * * *', () => triggerBrief('wrap_up'), { timezone: 'Asia/Shanghai' });
}

async function triggerBrief(kind) {
  const ctx = await buildContext({ userInput: `[scheduler:${kind}]`, recentMessages: [] });
  const r = await claude.ask(ctx);
  // 解析 + 推送略
}
```

> 节律时间作为 `routines.md` 配置项的实现位预留，本期硬编码。

## 11. 配置文件 .env.example

> **统一密钥配置范本**——用户复制为 `.env` 后集中填写。

详见仓库根目录：[`../.env.example`](../.env.example)

涵盖：

| 分组 | 变量 |
|---|---|
| 服务 | `PORT` `LOG_LEVEL` `HOST` |
| Brain | `BRAIN_CLI_CMD` `BRAIN_CLI_ARGS` `BRAIN_TIMEOUT_MS` |
| 音乐 | `QQ_MUSIC_COOKIE` `MUSIC_PROVIDER`(`qq`/`mock`) |
| 天气 | `QWEATHER_KEY` `QWEATHER_LOCATION` |
| TTS | `TTS_PROVIDER`(`webspeech`/`fish`) `FISH_AUDIO_KEY` |
| 飞书 | `FEISHU_APP_ID` `FEISHU_APP_SECRET` |

## 12. 启动与运行

```bash
# 1) 安装依赖
cd server && npm i
cd ../pwa && npm i

# 2) 配置密钥
cp .env.example .env
# 编辑 .env 填入 QQ_MUSIC_COOKIE / QWEATHER_KEY 等

# 3) 开发模式（后端 + 前端 HMR）
cd server && npm run dev      # http://127.0.0.1:5173 提供 API + WS
cd pwa    && npm run dev      # http://127.0.0.1:5174 vite HMR，proxy /api 到 5173

# 4) 生产构建
cd pwa && npm run build       # 产物输出到 pwa/dist
cd server && npm start        # express 直接吐 pwa/dist 静态资源
```

## 13. 边界与降级

| 场景 | 实现位置 | 行为 |
|---|---|---|
| Claude CLI 不存在 | `claude.js` spawn ENOENT | 立即返回兜底 say，不阻塞 |
| Claude 超时 | `claude.js` 30s timer | SIGKILL + 兜底 say |
| QQ Cookie 失效 | `providers/music/qq.js` 401/300 | 抛出后由工厂捕获并切 Mock |
| QWeather 4xx | `providers/weather/qweather.js` | 跳过环境注入天气片段 |
| WS 断开 | `pwa/api.js` onclose | 2s 后重连 |
| SQLite 损坏 | `state.js` init 检测 | 重命名旧库 + 重建空库 |

## 14. 扩展点

- **新增音乐源**：实现 `MusicProvider` 接口，注册到工厂即可
- **新增 TTS 引擎**：实现 `TTSProvider`（`speak(text, voice)`）
- **新增日历源**：实现 `CalendarProvider`（`listToday()`），由 `context.js` 选择性注入
- **替换 Brain**：修改 `BRAIN_CLI_CMD` 即可指向 `claude-router` / `gemini-cli` 等

---

*[Boundary Warnings]*
- Brain 调用为子进程 IO，在 Claude CLI 冷启动场景首次响应可能 > 5s，需在前端 `LIVE` 区显示"thinking" 占位
- QQ 音乐 Cookie 域绑定，跨地区 IP 切换可能触发风控
- 节律调度依赖系统时区，若用户机器时区错误会导致播报时间漂移；后端启动时打印 `process.env.TZ` 与 `new Date().toString()` 便于排查

*[Contains Unverified Assumptions]*
- QQ 音乐接口签名细节需在编码阶段对照社区库（如 `QQMusicApi`）实现
- Claude CLI（用户自述指向 DeepSeek）的 `--output-format json` 字段名需在第一次联调时校准
