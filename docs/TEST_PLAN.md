# Claudio · 测试计划与验收报告（TEST_PLAN v1.0）

| 项 | 内容 |
|---|---|
| 文档版本 | v1.0 |
| 作者 | 测试专家（虚拟角色） |
| 日期 | 2026-04-27 |
| 关联文档 | [`./PRD.md`](./PRD.md) [`./ARCHITECTURE.md`](./ARCHITECTURE.md) |

## 目录

- [1. 测试策略](#1-测试策略)
- [2. 测试范围](#2-测试范围)
- [3. 测试环境](#3-测试环境)
- [4. 功能测试用例](#4-功能测试用例)
- [5. UI / 视觉一致性测试](#5-ui--视觉一致性测试)
- [6. 接口契约测试](#6-接口契约测试)
- [7. 性能 / 边界 / 异常测试](#7-性能--边界--异常测试)
- [8. 安全测试](#8-安全测试)
- [9. 回归与冒烟](#9-回归与冒烟)
- [10. 缺陷分级与回流流程](#10-缺陷分级与回流流程)
- [11. 验收清单](#11-验收清单)
- [12. 测试报告模板](#12-测试报告模板)

---

## 1. 测试策略

| 层 | 工具 | 覆盖目标 |
|---|---|---|
| 单元测试 | `node:test`（后端）/ `vitest`（前端） | router 意图识别、safeParseBrainOutput、SQLite CRUD、Web Components 渲染 |
| 接口测试 | `supertest` + `node:test` | 6 条 HTTP/WS 契约 |
| 端到端 | `@playwright/test` | 主页面交互、Profile、Speaking、主题切换 |
| 视觉回归 | Playwright `toHaveScreenshot` | 与 `img/2.png` `img/3.png` 等参考图像素级对比 |
| 手工探索 | 测试同学按用例表逐项执行 | 真机移动端 Speaking 态、TTS 听感、节律调度真实触发 |

测试金字塔比例（按用例数）：单元 60% / 接口 25% / E2E 12% / 手工 3%。

## 2. 测试范围

✅ 包含：

- PRD §5 全部 P0 功能（F-001 ~ F-015）
- ARCHITECTURE §7 全部 6 条接口
- DESIGN.md 全部 12 个组件的视觉与交互
- 边界与异常（PRD §10、ARCHITECTURE §13）

❌ 不包含本期：

- Fish Audio TTS（P1）
- 飞书日历（P1）
- ~~UPnP（P2）~~ — 已确认不做
- 多用户场景

## 3. 测试环境

| 环境 | 配置 |
|---|---|
| 操作系统 | macOS 14+ / Windows 11 / Ubuntu 22.04 |
| 浏览器 | Chrome 124+ / Edge 124+ / Safari 17+ |
| 移动端真机 | iPhone 15 Safari / Pixel 8 Chrome |
| Node 版本 | 20.x LTS |
| Brain CLI | 用户本机 `claude`（DeepSeek 后端） |
| 测试数据 | `server/data/mock/` 提供 3 首 CC0 mp3 + LRC |

## 4. 功能测试用例

> 编号 `TC-Fxxx-yy` 对应 PRD F-xxx；G/W/T 对齐 PRD 验收标准。

### 4.1 F-001 LED 时钟

| 用例 | 步骤 | 预期 | 优先级 |
|---|---|---|---|
| TC-F001-01 | 打开主页 | 时钟显示当前 hh:mm，秒位冒号每秒闪 | P0 |
| TC-F001-02 | 等待 1 分钟 | 数字滚动到下一分钟 | P0 |
| TC-F001-03 | 切换浅色 | 时钟保持点阵字体，颜色切到 `--accent` 浅色版 | P0 |

### 4.2 F-002 播放器条

| 用例 | 步骤 | 预期 |
|---|---|---|
| TC-F002-01 | 点击播放/暂停 | `audio.paused` 状态切换；按钮 icon 切换 |
| TC-F002-02 | 拖拽进度条到 50% | `audio.currentTime` 变到时长一半 ±0.5s |
| TC-F002-03 | 点击下一首 | 队列前进一格，`/api/now` 返回新曲 |
| TC-F002-04 | 调音量到 0 | 听不到声音；UI 显示静音图标 |
| TC-F002-05 | 点击收藏 | `plays.liked` 写入 1；FAV 列表出现该曲 |
| TC-F002-06 | 点击 HIDE | QUEUE 列表收起；再点回来恢复 |

### 4.3 F-003 QUEUE

| 用例 | 步骤 | 预期 |
|---|---|---|
| TC-F003-01 | 队列含 5 曲 | 列表显示 5 行，当前曲左侧竖条高亮 |
| TC-F003-02 | 点击第 3 曲 | 立即切到第 3 曲；竖条移动到第 3 行 |
| TC-F003-03 | 删除当前播放曲 | 自动跳到下一曲；不出现白屏 |

### 4.4 F-004 LIVE 对话流

| 用例 | 步骤 | 预期 |
|---|---|---|
| TC-F004-01 | 发送 "hi" | 1s 内 LIVE 区追加用户消息；后续追加 Claudio 回复 |
| TC-F004-02 | 点击某条 Claudio 消息的 REPLAY | 触发 TTS 重读该文本 |
| TC-F004-03 | WS 断开 | 状态行变 `Reconnecting…`；恢复后自动转回 `Connected` |

### 4.5 F-005 输入框

| 用例 | 步骤 | 预期 |
|---|---|---|
| TC-F005-01 | 文本回车发送 | 触发 `POST /api/chat` |
| TC-F005-02 | 点击 🎙 录音 | 浏览器请求麦克风权限；识别后填入输入框 |
| TC-F005-03 | 输入超过 2000 字 | 客户端截断或服务端 400 |

### 4.6 F-006 Profile 弹层

| 用例 | 步骤 | 预期 |
|---|---|---|
| TC-F006-01 | 点击头像 | Modal 出现（背景毛玻璃，card scale 动画） |
| TC-F006-02 | 按 ESC | Modal 关闭 |
| TC-F006-03 | 点击遮罩 | Modal 关闭 |
| TC-F006-04 | Tab 键导航 | Focus 在 Modal 内循环 |

### 4.7 F-007 主题切换

| 用例 | 步骤 | 预期 |
|---|---|---|
| TC-F007-01 | 点 LIGHT | 全局 CSS 变量切换；localStorage `theme=light` |
| TC-F007-02 | 刷新页面 | 主题保持 |

### 4.8 F-008 登录

| 用例 | 步骤 | 预期 |
|---|---|---|
| TC-F008-01 | 点 LOGIN | 弹出 "本地单用户" 提示；自动登录为 mmguo |

### 4.9 F-009 Speaking 态

| 用例 | 步骤 | 预期 |
|---|---|---|
| TC-F009-01 | 手机 viewport < 768 + 进入 `/speaking` | 波形可视化 + 歌名卡 + 歌词流 |
| TC-F009-02 | 歌词时间戳到达 | 当前行渐入；前行降透明度；关键词底色高亮 |
| TC-F009-03 | 横竖屏切换 | 布局响应式调整不破版 |

### 4.10 F-010 节律调度

| 用例 | 步骤 | 预期 |
|---|---|---|
| TC-F010-01 | 修改系统时间到 06:59:55 | 07:00:00 时 LIVE 区追加 morning_brief 播报 |
| TC-F010-02 | 整点 | 触发 hourly_mood 检查 |

### 4.11 F-011 意图分流

| 用例 | 输入 | 预期 |
|---|---|---|
| TC-F011-01 | "播放 周杰伦" | 走 MusicProvider，不调用 Brain |
| TC-F011-02 | "今天有点累" | 走 Brain |
| TC-F011-03 | "暂停" | 直接控制播放器 |

### 4.12 F-012 品味语料

| 用例 | 步骤 | 预期 |
|---|---|---|
| TC-F012-01 | 修改 `taste.md` 后调 `/api/taste` | 返回最新内容（无需重启） |
| TC-F012-02 | 删除 `taste.md` 启动后端 | 自动生成模板，服务正常起 |

### 4.13 F-013 QQ 音乐

| 用例 | 步骤 | 预期 |
|---|---|---|
| TC-F013-01 | 配 Cookie + 搜 "周杰伦" | 返回 ≥ 5 条结果，含 songId/name/artist |
| TC-F013-02 | 取直链 | 返回 mp3 URL，浏览器可直接播放 |
| TC-F013-03 | 取歌词 | 返回 LRC 格式 |
| TC-F013-04 | Cookie 置空 | provider 切到 Mock；前端 LIVE 出现一条系统提示 |
| TC-F013-05 | Cookie 失效（手动伪造过期） | 自动 fallback；不抛 5xx |

### 4.14 F-014 天气注入

| 用例 | 步骤 | 预期 |
|---|---|---|
| TC-F014-01 | 配 QWEATHER_KEY | `/api/now` 调用前 context.env 含天气；Brain 回复可引用 |
| TC-F014-02 | Key 错误 | 跳过天气；不阻塞 Brain |

### 4.15 F-015 持久化

| 用例 | 步骤 | 预期 |
|---|---|---|
| TC-F015-01 | 产生 5 条对话后 kill 服务 | 重启后 LIVE 区恢复 5 条 |
| TC-F015-02 | 收藏 1 首 | 重启后 FAV 仍含该曲 |

## 5. UI / 视觉一致性测试

| 用例 | 参照图 | 校验点 |
|---|---|---|
| TC-UI-01 | [`../img/2.png`](../img/2.png) | 深色主界面整体（时钟/播放器/LIVE/输入框） |
| TC-UI-02 | [`../img/3.png`](../img/3.png) | 浅色 + QUEUE 展开 |
| TC-UI-03 | [`../img/5.png`](../img/5.png) | Profile Modal 三列统计 + 标签云排版 |
| TC-UI-04 | [`../img/6.png`](../img/6.png) | Speaking 波形 + 白卡 + 歌词布局 |
| TC-UI-05 | [`../img/9.png`](../img/9.png) | 候选曲列表首项 ★ 高亮 |

视觉回归用 Playwright：

```js
test('home dark matches reference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page).toHaveScreenshot('home-dark.png', { maxDiffPixelRatio: 0.02 });
});
```

> 阈值 2% 像素差，允许字体抗锯齿与时钟数字差异。

## 6. 接口契约测试

| 用例 | 接口 | 校验 |
|---|---|---|
| TC-API-01 | `POST /api/chat` text 缺失 | 返回 400 + `{ error }` |
| TC-API-02 | `POST /api/chat` 正常 | 返回包含 `say`/`play`/`reason` 字段 |
| TC-API-03 | `GET /api/now` 无播放 | 返回 `{ song: null, state: "idle" }` |
| TC-API-04 | `GET /api/next` | 返回 `queue` 数组 |
| TC-API-05 | `GET /api/taste` 无文件 | 返回空字符串 + 默认 playlists `[]` |
| TC-API-06 | `GET /api/plan/today` | 日期为今天；blocks 为数组 |
| TC-API-07 | `WS /stream` 连接 | 收到 `claudio_say` / `now_changed` 等事件 |

## 7. 性能 / 边界 / 异常测试

| 用例 | 场景 | 预期 |
|---|---|---|
| TC-PERF-01 | 主页首屏 | TTI < 2s（M2 MacBook 本机） |
| TC-PERF-02 | WS 端到端往返 | < 200ms |
| TC-PERF-03 | Brain 响应 P95 | < 4s |
| TC-PERF-04 | 100 条 LIVE 消息 | 滚动 ≥ 60fps，无卡顿 |
| TC-EDGE-01 | Brain CLI 杀进程 | 30s 内返回兜底 say |
| TC-EDGE-02 | 网络断开 | UI 切 OFF AIR；本地播放不停 |
| TC-EDGE-03 | 音频 404 | 跳下一曲；连续 3 次失败后停止 |
| TC-EDGE-04 | 本地时区错乱（UTC） | 调度仍按 `Asia/Shanghai` 触发（cron 配置 timezone） |

## 8. 安全测试

| 用例 | 校验点 |
|---|---|
| TC-SEC-01 | `.env` 文件不出现在 `pwa/dist/` | 构建产物 grep `QQ_MUSIC_COOKIE` 无命中 |
| TC-SEC-02 | SQL 注入测试：消息 text = `'); DROP TABLE messages; --` | messages 表完整、记录正常入库（参数化查询生效） |
| TC-SEC-03 | XSS：消息 text = `<img src=x onerror=alert(1)>` | LIVE 区以纯文本展示，不执行脚本 |
| TC-SEC-04 | CSRF：第三方页跨域 POST `/api/chat` | 因 127.0.0.1 监听，外部不可达 |
| TC-SEC-05 | 日志脱敏 | Cookie / API Key 不落日志 |

## 9. 回归与冒烟

每次合主干前自动跑：

```bash
npm run test:smoke    # 5 分钟内：API 健康 + 主页加载 + chat 一轮
npm run test:full     # 30 分钟：所有 unit + integration + e2e
```

冒烟用例：TC-F001-01 / TC-F002-01 / TC-F004-01 / TC-API-02 / TC-EDGE-01。

## 10. 缺陷分级与回流流程

| 等级 | 定义 | SLA |
|---|---|---|
| 阻塞 P0 | 主流程不可用、数据丢失、崩溃 | 当天修 |
| 严重 P1 | 单个 P0 功能局部失效 | 24h |
| 一般 P2 | 视觉偏差、非主路径 | 一周 |
| 建议 P3 | 优化项 | 入 backlog |

回流：测试 → 提 issue → 开发标 fix commit → 测试验回 → close。

## 11. 验收清单

| # | 项 | 通过条件 |
|---|---|---|
| 1 | 五份文档齐备 | docs/ 下 PRD/DESIGN/ARCHITECTURE/TEST_PLAN/ROADMAP 全部 ≥ v1.0 |
| 2 | `.env.example` 备注完整 | 每个变量有用途/来源/必填/默认值四要素 |
| 3 | 后端 `npm start` | 0 报错启动，监听 5173 |
| 4 | PWA 主页加载 | 无控制台 error，截图与 [`../img/2.png`](../img/2.png) 偏差 < 2% |
| 5 | 输入 "hi" 走通链路 | LIVE 出现回复（Brain or 兜底） |
| 6 | 输入 "播放 xxx" | 走 MusicProvider，QQ 配 Cookie 时能出声 |
| 7 | 节律调度可触发 | 修改 cron 为每分钟，能看到推送 |
| 8 | SQLite 持久化 | 重启后历史可见 |
| 9 | 全部 P0 用例通过率 ≥ 95% | 失败用例须 P2 及以下 |
| 10 | 安全测试 0 高危 | 无 SQL 注入 / XSS / 密钥泄露 |

## 12. 测试报告模板

> 测试完成后由测试专家填写并提交至 `docs/TEST_REPORT_v1.0.md`。

```markdown
# Claudio v1.0 测试报告

| 项 | 结果 |
|---|---|
| 测试周期 | YYYY-MM-DD ~ YYYY-MM-DD |
| 用例总数 | NN |
| 通过 | NN |
| 失败 | NN |
| 阻塞 | NN |
| 通过率 | NN% |

## 缺陷分布

| 等级 | 数量 | 已修 | 遗留 |
|---|---|---|---|
| P0 | … | … | … |
| P1 | … | … | … |
| P2 | … | … | … |

## 性能数据

| 指标 | 实测 | 目标 | 是否达标 |
|---|---|---|---|
| 首屏 TTI | … | < 2s | ✅/❌ |
| Brain P95 | … | < 4s | … |

## 风险与建议

- …

## 验收结论

☐ 通过 ☐ 有条件通过 ☐ 不通过
```

---

*[Boundary Warnings]*
- F-013 测试依赖真实 QQ 音乐 Cookie，CI 环境无法跑，需在本地 manual case 标注
- F-009 Speaking 态歌词同步精度依赖 LRC 时间戳准确性，与第三方接口数据质量绑定
- 视觉回归对字体加载顺序敏感，CI 需先 `await fonts.ready` 再截图
