/**
 * 全局单例 <audio>
 * - 所有路由共享同一个 HTMLAudioElement
 * - player-bar 只是"遥控器"，不持有 audio 实例
 * - 切换视图（Profile / Settings）时，播放状态与进度不中断
 * - prefetch 10s：当 duration - currentTime < 10 时，提前 fetch 下一首的 URL 到 link rel=prefetch
 */
import { store } from './store.js';

const audio = new Audio();
audio.preload = 'auto';
audio.crossOrigin = 'anonymous';  // 让 AnalyserNode 能读到跨域音频频谱（前提服务器返 CORS 头）

let _prefetchedSongId = null;

// ───── Web Audio API 频谱分析 ─────
let _audioCtx = null;
let _analyser = null;
let _source = null;
let _freqData = null;

/**
 * 第一次用户交互时初始化 AudioContext + AnalyserNode
 * （浏览器要求必须 user gesture 后才能 resume）
 */
function ensureAnalyser() {
  if (_analyser) return _analyser;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    _audioCtx = new Ctx();
    _source = _audioCtx.createMediaElementSource(audio);
    _analyser = _audioCtx.createAnalyser();
    _analyser.fftSize = 128;          // 64 个频段，足够画 mini 波形
    _analyser.smoothingTimeConstant = 0.7;
    _source.connect(_analyser);
    _analyser.connect(_audioCtx.destination);
    _freqData = new Uint8Array(_analyser.frequencyBinCount);
    return _analyser;
  } catch (e) {
    console.warn('AudioContext init failed (CORS or autoplay policy):', e);
    return null;
  }
}

audio.addEventListener('timeupdate', () => {
  _emit('position', { currentTime: audio.currentTime, duration: audio.duration });
  if (audio.duration && audio.duration - audio.currentTime < 10) {
    const next = store.state.queue?.[0];
    if (next?.songId && next.songId !== _prefetchedSongId) {
      _prefetchSong(next);
      _prefetchedSongId = next.songId;
    }
  }
});

audio.addEventListener('ended',          () => _emit('ended'));
audio.addEventListener('play',           () => { _audioCtx?.resume(); _emit('state', 'playing'); });
audio.addEventListener('pause',          () => _emit('state', 'paused'));
audio.addEventListener('loadedmetadata', () => _emit('loaded'));
audio.addEventListener('error',          () => _emit('error', audio.error));

const listeners = new Map();
function _emit(evt, data) {
  const set = listeners.get(evt);
  if (set) set.forEach(fn => { try { fn(data); } catch (_) {} });
}

function _prefetchSong(song) {
  if (!song?.url && !song?.songId) return;
  try {
    const url = song.url || '';
    if (!url) return;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'audio';
    link.href = url;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
    setTimeout(() => link.remove(), 10_000);
  } catch (_) {}
}

export const player = {
  el: audio,

  load(url) {
    if (!url) return;
    if (audio.src !== url) {
      audio.src = url;
      _prefetchedSongId = null;
    }
  },

  play()   {
    ensureAnalyser();   // 用户点击播放是 gesture，此时才初始化
    return audio.play().catch(() => {});
  },
  pause()  { audio.pause(); },
  stop()   { audio.pause(); audio.removeAttribute('src'); audio.load(); },
  seek(pct) {
    if (audio.duration) audio.currentTime = (pct / 100) * audio.duration;
  },
  setVolume(v) { audio.volume = Math.max(0, Math.min(1, v / 100)); },
  get paused()      { return audio.paused; },
  get currentTime() { return audio.currentTime; },
  get duration()    { return audio.duration || 0; },

  /**
   * 取实时频谱（0-255 的 Uint8Array，长度 64）
   * AnalyserNode 未就绪时返回 null
   */
  getFrequencyData() {
    if (!_analyser || !_freqData) return null;
    _analyser.getByteFrequencyData(_freqData);
    return _freqData;
  },

  on(evt, fn) {
    if (!listeners.has(evt)) listeners.set(evt, new Set());
    listeners.get(evt).add(fn);
    return () => listeners.get(evt).delete(fn);
  },
};

if (typeof window !== 'undefined') window.__claudio_player = player;
