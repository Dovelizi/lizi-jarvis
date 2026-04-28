import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { EdgeTTS } from '@andresaya/edge-tts';
import express from 'express';
import { config } from '../../config.js';
import { logger } from '../../logger.js';

/**
 * TTS Provider 抽象 + 多引擎实现
 *
 * 引擎选择（按 TTS_PROVIDER）：
 *   - 'siliconflow' → SiliconFlow CosyVoice2（OpenAI 兼容，需 SILICONFLOW_KEY；失败回 Edge）
 *   - 'edge-tts' / 'webspeech' / 其他 → Edge TTS（默认）
 *
 * 缓存：所有引擎统一缓存到 server/data/tts/<sha256>.mp3
 * HTTP：GET /api/tts?text=...&voice=... → { url, hash, hit }
 *       GET /api/tts/voices              → { voices, default, provider }
 */

const EDGE_DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';
const TTS_DIR = path.join(config.DATA_DIR, 'tts');
fs.mkdirSync(TTS_DIR, { recursive: true });

// SiliconFlow 8 个预置音色（CosyVoice2-0.5B）
const SF_VOICES = [
  { shortName: 'alex',     gender: 'Male',   locale: 'zh-CN', friendly: '沉稳男声' },
  { shortName: 'benjamin', gender: 'Male',   locale: 'zh-CN', friendly: '低沉男声' },
  { shortName: 'charles',  gender: 'Male',   locale: 'zh-CN', friendly: '磁性男声' },
  { shortName: 'david',    gender: 'Male',   locale: 'zh-CN', friendly: '欢快男声' },
  { shortName: 'anna',     gender: 'Female', locale: 'zh-CN', friendly: '沉稳女声' },
  { shortName: 'bella',    gender: 'Female', locale: 'zh-CN', friendly: '激情女声' },
  { shortName: 'claire',   gender: 'Female', locale: 'zh-CN', friendly: '温柔女声' },
  { shortName: 'diana',    gender: 'Female', locale: 'zh-CN', friendly: '欢快女声' },
];
const SF_VOICE_SET = new Set(SF_VOICES.map(v => v.shortName));

function hashKey(text, voice, opts) {
  const h = crypto.createHash('sha256');
  h.update(JSON.stringify({ text, voice, ...opts }));
  return h.digest('hex').slice(0, 32);
}

/**
 * Edge TTS 合成（旧实现，保留为 fallback）
 */
async function synthesizeEdge(text, { voice = EDGE_DEFAULT_VOICE, rate, pitch, volume } = {}) {
  const opts = {};
  if (rate)   opts.rate   = rate;
  if (pitch)  opts.pitch  = pitch;
  if (volume) opts.volume = volume;

  const hash = hashKey(text, voice, { engine: 'edge', ...opts });
  const file = path.join(TTS_DIR, `${hash}.mp3`);
  if (fs.existsSync(file)) return { hash, path: file, hit: true, engine: 'edge' };

  const tts = new EdgeTTS();
  await tts.synthesize(text, voice, opts);
  await tts.toFile(path.join(TTS_DIR, hash));   // toFile 自带 .mp3 后缀
  logger.info({ hash, len: text.length, voice, engine: 'edge' }, 'tts synthesized');
  return { hash, path: file, hit: false, engine: 'edge' };
}

/**
 * SiliconFlow CosyVoice2 合成（OpenAI 兼容，POST 二进制 mp3）
 * 失败抛异常（由 synthesize 上层降级 Edge）
 */
async function synthesizeSiliconFlow(text, { voice } = {}) {
  if (!config.SILICONFLOW_KEY) throw new Error('SILICONFLOW_KEY not configured');
  // voice 参数容错：
  //   1) 空 → 用 .env 默认
  //   2) 不在 SF 8 个音色白名单（例如前端残留的 Edge 音色名 zh-CN-XiaoxiaoNeural）→ 回退默认
  //   3) 命中白名单 → 使用
  const fallback = config.SILICONFLOW_VOICE || 'claire';
  let v = (voice && voice.trim()) || fallback;
  if (!SF_VOICE_SET.has(v)) {
    logger.warn({ requested: v, fallback }, 'siliconflow: invalid voice, fallback to default');
    v = fallback;
  }
  const fullVoice = `${config.SILICONFLOW_MODEL}:${v}`;

  const hash = hashKey(text, fullVoice, { engine: 'siliconflow' });
  const file = path.join(TTS_DIR, `${hash}.mp3`);
  if (fs.existsSync(file)) return { hash, path: file, hit: true, engine: 'siliconflow' };

  const r = await fetch('https://api.siliconflow.cn/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.SILICONFLOW_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model: config.SILICONFLOW_MODEL,
      input: text,
      voice: fullVoice,
      response_format: 'mp3',
      sample_rate: 32000,
      speed: 1.0,
      gain: 0.0,
    }),
  });

  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    throw new Error(`siliconflow http ${r.status}: ${errText.slice(0, 200)}`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  if (!buf.length) throw new Error('siliconflow returned empty body');
  await fs.promises.writeFile(file, buf);
  logger.info({ hash, len: text.length, voice: v, bytes: buf.length, engine: 'siliconflow' }, 'tts synthesized');
  return { hash, path: file, hit: false, engine: 'siliconflow' };
}

/**
 * 统一入口：按 TTS_PROVIDER 调度，失败自动降级 Edge
 */
export async function synthesize(text, opts = {}) {
  if (!text || typeof text !== 'string') throw new Error('text required');
  const provider = (config.TTS_PROVIDER || '').toLowerCase();

  if (provider === 'siliconflow') {
    try {
      return await synthesizeSiliconFlow(text, opts);
    } catch (e) {
      logger.warn({ err: e?.message }, 'siliconflow tts failed, fallback to edge');
      return await synthesizeEdge(text, opts);
    }
  }
  return await synthesizeEdge(text, opts);
}

/** Edge voices 缓存 */
let _edgeVoicesCache = null;
async function listEdgeVoices() {
  if (_edgeVoicesCache) return _edgeVoicesCache;
  try {
    const tts = new EdgeTTS();
    const all = await tts.getVoices();
    const filtered = all.filter(v =>
      v.Locale?.startsWith('zh-') ||
      ['en-US', 'en-GB', 'ja-JP'].includes(v.Locale)
    );
    _edgeVoicesCache = filtered.map(v => ({
      shortName: v.ShortName,
      gender:    v.Gender,
      locale:    v.Locale,
      friendly:  v.FriendlyName,
    }));
    return _edgeVoicesCache;
  } catch (e) {
    logger.warn({ err: e?.message }, 'tts listVoices (edge) failed');
    return [];
  }
}

/** 列 voices：按当前 provider 返回不同列表 */
export async function listVoices() {
  const provider = (config.TTS_PROVIDER || '').toLowerCase();
  if (provider === 'siliconflow') {
    return { voices: SF_VOICES, default: config.SILICONFLOW_VOICE || 'claire', provider };
  }
  return { voices: await listEdgeVoices(), default: EDGE_DEFAULT_VOICE, provider: 'edge' };
}

/**
 * 挂载到 Express
 *  - GET  /api/tts?text=...&voice=...  → { url, hash, hit, engine }
 *  - GET  /api/tts/voices              → { voices, default, provider }
 *  - GET  /tts/<hash>.mp3              → 静态 mp3
 */
export function mountTtsRoutes(app) {
  app.use('/tts', express.static(TTS_DIR, {
    maxAge: '7d',
    setHeaders: (res) => res.setHeader('Content-Type', 'audio/mpeg'),
  }));

  app.get('/api/tts', async (req, res) => {
    const text = String(req.query.text || '').trim();
    if (!text) return res.status(400).json({ error: 'text required' });
    if (text.length > 500) return res.status(400).json({ error: 'text too long (max 500)' });
    const voice = req.query.voice ? String(req.query.voice) : undefined;
    try {
      const { hash, hit, engine } = await synthesize(text, { voice });
      res.json({ url: `/tts/${hash}.mp3`, hash, hit, engine });
    } catch (e) {
      logger.error({ err: e?.message }, 'tts synth failed');
      res.status(500).json({ error: 'tts failed' });
    }
  });

  app.get('/api/tts/voices', async (_req, res) => {
    res.json(await listVoices());
  });

  logger.info(
    { dir: TTS_DIR, provider: config.TTS_PROVIDER },
    'TTS routes mounted'
  );
}
