# lizi-jarvis · 私人 AI 电台 DJ

> Your mood is my prompt. I hate algorithm. I have taste.
>
> 一份会打碟的 `taste.md` —— 永远不停播的私人电台。

---

## 这是什么

一个本地优先的 PWA：左上是 LED 时钟和天气，下方是 Telegram 风格的 DJ 对话气泡，
中间是带卡拉OK歌词滚轴的播放器。Brain（Claude CLI 子进程）每天主动跟你说几句话、按你的心情挑歌、
配上自然真人感的中文 TTS 介绍。

- 🎙 **AI DJ**：基于 Claude CLI，按你的 `taste.md` 推荐音乐 + 主动播报
- 🎵 **QQ 音乐源**：直链播放、卡拉OK歌词、收藏管理
- 🌧 **天气联动**：按和风天气动态调整曲目情绪
- 🗣 **真人级 TTS**：SiliconFlow CosyVoice2，8 个预置音色任选
- ⏰ **节律调度**：早间播报 / 整点情绪 / 第一首歌 / 睡前收尾
- 📱 **PWA**：可装桌面图标、Service Worker 离线缓存、深色/浅色主题

---

## 快速开始

```bash
# 1. 配置密钥（一份文件搞定全部）
cp .env.example .env
# 用编辑器打开 .env，按文件内备注逐项填写
# 必填：BRAIN_CLI_CMD、QWEATHER_KEY
# 选填但推荐：QQ_MUSIC_COOKIE（不填会用 Mock 模式）、SILICONFLOW_KEY（不填用 Edge TTS）

# 2. 安装依赖
cd server && npm install
cd ../pwa  && npm install

# 3. 启动开发模式（开两个终端）
# 终端 1：后端（首次启动会自动创建 user/ 目录和默认语料文件）
cd server && npm run dev
# 终端 2：前端
cd pwa && npm run dev

# 浏览器打开 http://127.0.0.1:5174
```

启动后建议立刻去 `user/taste.md` 改成你自己的音乐品味，效果会立刻不同。

---

## 必备外部依赖

| 项 | 必填 | 获取 |
|---|---|---|
| **Claude CLI** | 是 | 本机安装 `claude` 命令；推荐配 `claude-code-router` 走任意 LLM |
| **QWeather Key** | 是 | https://dev.qweather.com 注册 → Web API Key |
| **QQ 音乐 Cookie** | 否 | 浏览器登录 y.qq.com → F12 拷 Cookie；不填则用 Mock 模式 |
| **SiliconFlow Key** | 否 | https://cloud.siliconflow.cn 微信扫码注册送 ¥14；不填用 Edge TTS |

---

## 项目结构

```
lizi-jarvis/
├── docs/             # 五份核心文档（PRD/设计/架构/测试/路线图）
├── img/              # 设计参考截图（设计稿、效果图）
├── server/           # Node.js 本地大脑
│   ├── src/
│   │   ├── index.js          # 入口
│   │   ├── router.js         # HTTP/WS 路由
│   │   ├── scheduler.js      # cron 节律调度
│   │   ├── claude.js         # Brain CLI adapter
│   │   ├── context.js        # 上下文注入
│   │   └── providers/        # music / tts provider 抽象
│   ├── prompts/
│   │   └── dj-persona.md     # DJ 人格设定
│   └── data/         # 运行时数据（gitignore）
├── pwa/              # 前端 PWA（Vite + 原生 Web Components）
│   ├── src/
│   │   ├── main.js
│   │   ├── store.js          # 全局状态
│   │   ├── api.js            # HTTP 封装
│   │   ├── audio.js          # 播放器
│   │   ├── components/       # web components
│   │   └── pages/            # 页面布局
│   └── dist/         # 构建产物（gitignore）
├── user/             # 个人语料（gitignore，自己写）
├── .env.example      # 密钥配置范本（已脱敏）
└── README.md
```

---

## 文档

| 文档 | 说明 |
|---|---|
| [docs/PRD.md](docs/PRD.md) | 产品需求文档 |
| [docs/DESIGN.md](docs/DESIGN.md) | UI/UX 设计规范 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 技术架构与开发方案 |
| [docs/TEST_PLAN.md](docs/TEST_PLAN.md) | 测试计划 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | 里程碑与进度 |
| [.env.example](.env.example) | 统一密钥配置范本（含逐项备注） |

---

## TTS 音色（SiliconFlow CosyVoice2）

8 个预置音色，可在抽屉 → 设置 → 音色下拉切换，▶ 试听：

| 男声 | 女声 |
|---|---|
| alex（沉稳） | anna（沉稳） |
| benjamin（低沉） | bella（激情） |
| charles（磁性） | claire（温柔，默认） |
| david（欢快） | diana（欢快） |

---

## 安全说明

- 所有密钥文件（`.env`、`.env.*.local`）已加入 `.gitignore`
- 提交前请确认：`git status` 不应出现任何 `.env` 文件
- 个人语料 `user/` 目录全部忽略，因为可能含个人偏好/PII
- `server/data/` 运行时数据（SQLite、TTS 缓存）全部忽略
