const subs = new Set();

export const store = {
  state: {
    route: 'player',                    // player | profile | settings
    theme: localStorage.getItem('theme') || 'dark',
    now: { song: null, state: 'idle', volume: 80 },
    queue: [],
    messages: [],                       // [{ ts, role, text, meta, streamId?, streaming? }]
    activeStream: null,                 // { streamId, text } 当前正在流式接收的消息
    connected: false,
    queueOpen: false,                   // D 卡内的队列 popover 是否展开
    chatVisible: localStorage.getItem('chatVisible') === 'true',   // E 区抽屉默认收起
    menuOpen:   false,                  // 右侧菜单抽屉（资料 + 设置合并）
    menuTab:   'profile',               // profile | settings
    config: null,                       // /api/config 返回
    weather: null,                      // B 区
    daily: null,                        // C 区
    seedSongs: [],                      // [{name, artist, addedAt}] 用户种子歌单
  },

  set(patch) {
    Object.assign(this.state, patch);
    subs.forEach((fn) => { try { fn(this.state); } catch (_) {} });
  },

  push(key, item) {
    const arr = this.state[key];
    if (!Array.isArray(arr)) return;
    this.set({ [key]: [...arr, item] });
  },

  // 流式消息：前端不展示原始 JSON delta，仅维持 streaming 占位；
  // stream_end 时用 parsed.say 一次性填充最终文本。
  // 注：delta/full 仅用于保留未来需要"渐进式提取 say"时的接入点。
  appendStreamDelta(streamId, _delta, _full) {
    const msgs = this.state.messages.slice();
    const last = msgs[msgs.length - 1];
    if (!last || last.streamId !== streamId) {
      // 首个 delta 到达但 stream_start 未建占位 → 补建一条空占位
      msgs.push({ ts: Date.now(), role: 'bot', text: '', streamId, streaming: true });
      this.set({ messages: msgs, activeStream: { streamId, text: '' } });
    }
    // 其余 delta 忽略（保持占位，等 stream_end 一次性填）
  },

  finishStream(streamId, finalMsg) {
    const msgs = this.state.messages.slice();
    const last = msgs[msgs.length - 1];
    if (last && last.streamId === streamId) {
      last.text = finalMsg?.say || last.text || '[空响应]';
      last.meta = finalMsg;
      last.streaming = false;
    }
    this.set({ messages: msgs, activeStream: null });
  },

  // 清掉指定 streamId 的占位消息（用于 silent control intent，不写入聊天历史）
  dropStream(streamId) {
    const msgs = this.state.messages.filter(m => m.streamId !== streamId);
    this.set({ messages: msgs, activeStream: null });
  },

  subscribe(fn) {
    subs.add(fn);
    fn(this.state);
    return () => subs.delete(fn);
  },
};

export function setTheme(t) {
  store.set({ theme: t });
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('theme', t);
}

export function setRoute(r) {
  if (!['player', 'profile', 'settings'].includes(r)) return;
  store.set({ route: r });
  // 同步到 hash（方便分享/刷新保留）
  if (location.hash !== `#/${r}`) location.hash = `/${r}`;
}

export function toggleChat() {
  const v = !store.state.chatVisible;
  store.set({ chatVisible: v });
  localStorage.setItem('chatVisible', String(v));
}

export function openMenu(tab = 'profile') {
  store.set({ menuOpen: true, menuTab: tab });
}
export function closeMenu() {
  store.set({ menuOpen: false });
}

export function toggleQueue() {
  store.set({ queueOpen: !store.state.queueOpen });
}

// ───── seed-songs 收藏 helpers ─────
export function normalizeSeedKey(name, artist) {
  const norm = (s) => String(s ?? '')
    .toLowerCase()
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\s+/g, '')
    .trim();
  return norm(name) + '|' + norm(artist);
}

export function isSongLiked(song, seedSongs = store.state.seedSongs) {
  if (!song?.name) return false;
  const k = normalizeSeedKey(song.name, song.artist);
  return seedSongs.some(s => normalizeSeedKey(s.name, s.artist) === k);
}
