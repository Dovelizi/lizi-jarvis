import { store, setTheme } from './store.js';
import { api, openStream } from './api.js';
import { player } from './audio.js';
import { renderApp } from './pages/app.js';

// 注册 Web Components
import './components/led-clock.js';
import './components/player-bar.js';
import './components/live-panel.js';
import './components/input-bar.js';
import './components/weather-card.js';
import './components/daily-card.js';
import './components/theme-toggle.js';
import './components/menu-drawer.js';
import './components/on-air-bar.js';
import './components/lyric-scroll.js';

setTheme(store.state.theme);

const rootEl = document.getElementById('app');

// 单一渲染入口
function mount() { renderApp(rootEl); }
store.subscribe(() => mount());
mount();

// 初始化数据
(async () => {
  try {
    const [now, next, msgs, cfg, seeds] = await Promise.all([
      api.now(),
      api.next(),
      api.messages(50),
      api.configGet().catch(() => null),
      api.seedList().catch(() => ({ songs: [] })),
    ]);
    store.set({
      now:       { ...store.state.now, ...now },
      queue:     next.queue || [],
      messages:  msgs.messages || [],
      config:    cfg,
      seedSongs: seeds.songs || [],
    });
    // 初始曲目若有 url → 载入 audio（不自动播放，等用户点）
    if (now?.song?.url) player.load(now.song.url);
  } catch (e) {
    console.warn('initial load failed', e);
  }
})();

// ───── TTS 介绍 + 延迟播音乐 ─────
// 状态：当 stream_end 标记 needTtsIntro 时，缓存待播 song；
// 收到 now_changed 不立即播，等 TTS 念完触发 player.play()
let _pendingPlay = null;       // { song, source: 'now_changed' }
let _ttsAudioEl  = null;       // 当前在播的 TTS 音频元素

/**
 * 用当前用户选定的音色合成并播放一段文本。
 * @param {string} text  待念文本
 * @param {object} opts  { onEnd?: () => void, voiceOverride?: string }
 */
export async function speakOnly(text, opts = {}) {
  const onEnd = opts.onEnd || (() => {});
  if (!text) { onEnd(); return; }
  try {
    const voice = opts.voiceOverride ?? (store.state.config?.prefs?.ttsVoice || '');
    const url = `/api/tts?text=${encodeURIComponent(text.slice(0, 500))}${voice ? '&voice=' + encodeURIComponent(voice) : ''}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('tts http ' + r.status);
    const { url: mp3 } = await r.json();
    if (_ttsAudioEl) { try { _ttsAudioEl.pause(); } catch (_) {} }
    _ttsAudioEl = new Audio(mp3);
    _ttsAudioEl.addEventListener('ended', onEnd, { once: true });
    _ttsAudioEl.addEventListener('error', onEnd, { once: true });
    await _ttsAudioEl.play().catch(() => onEnd());
  } catch (_) {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.onend = onEnd;
      u.onerror = onEnd;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } else {
      onEnd();
    }
  }
}

async function speakAndPlay(text) {
  // 播完 TTS 介绍后，触发待播音乐
  const startMusic = () => {
    if (_pendingPlay?.song?.url) {
      player.load(_pendingPlay.song.url);
      player.play();
    }
    _pendingPlay = null;
  };
  if (!text) { startMusic(); return; }
  await speakOnly(text, { onEnd: startMusic });
}

// WS 流式事件接入
openStream((evt) => {
  switch (evt.type) {
    case '__open__':  store.set({ connected: true });  break;
    case '__close__': store.set({ connected: false }); break;

    case 'claudio_say': {
      // 兼容非流式旧事件
      store.push('messages', { ts: evt.ts, role: 'bot', text: evt.text, meta: { play: evt.play } });
      break;
    }

    case 'claudio_stream_start': {
      // 新建一条占位 bot 消息
      store.push('messages', { ts: evt.ts, role: 'bot', text: '', streamId: evt.streamId, streaming: true });
      store.set({ activeStream: { streamId: evt.streamId, text: '' } });
      break;
    }
    case 'claudio_stream_delta': {
      store.appendStreamDelta(evt.streamId, evt.delta, evt.full);
      break;
    }
    case 'claudio_stream_end': {
      const final = evt.final || {};
      // control intent 标记 silent → 不写入聊天，直接清掉占位
      if (final.silent) {
        store.dropStream(evt.streamId);
      } else {
        store.finishStream(evt.streamId, final);
      }
      // 推荐场景：先 TTS 介绍，再播音乐
      if (final.needTtsIntro && _pendingPlay) {
        speakAndPlay(final.say);
      } else if (
        // 闲聊场景：开关 prefs.ttsChat=true && 有 say 文本 && 不是推荐（不会被上面分支覆盖）
        !final.silent &&
        !final.needTtsIntro &&
        final.say &&
        store.state.config?.prefs?.ttsChat
      ) {
        speakOnly(final.say);
      }
      break;
    }
    case 'claudio_stream_error': {
      store.finishStream(evt.streamId, { say: '[ERROR] brain stream failed', play: [] });
      break;
    }

    case 'now_changed': {
      // 总是更新 store（让 UI 显示当前歌信息）
      store.set({ now: { song: evt.song, state: 'idle', volume: store.state.now.volume } });
      if (!evt.song?.url) break;

      // 如果即将到来的 stream_end 会带 needTtsIntro，则延迟播放
      // 简化判断：只要 _pendingPlay 还没设过、当前在等待 stream_end → 暂存
      // 这里用"500ms 内到来 stream_end 就算同一批推荐"作为启发式
      _pendingPlay = { song: evt.song, source: 'now_changed' };
      setTimeout(() => {
        // 超时仍未被 stream_end 处理（说明不是 TTS 推荐场景，例如 scheduler 自动推送）
        if (_pendingPlay && _pendingPlay.song === evt.song) {
          player.load(evt.song.url);
          player.play();
          _pendingPlay = null;
        }
      }, 500);
      break;
    }
    case 'queue_changed': {
      store.set({ queue: evt.queue || [] });
      break;
    }
  }
});

// audio → store 回写：播放状态
player.on('state', (s) => store.set({ now: { ...store.state.now, state: s } }));
player.on('ended', () => { import('./api.js').then(({ api }) => api.chat('下一首').catch(() => {})); });
