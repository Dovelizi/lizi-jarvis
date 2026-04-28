import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PERSONA_PATH = path.resolve(__dirname, '../prompts/dj-persona.md');

// 启动时读一次；文件不存在则用兜底
let SYSTEM_PROMPT = '';
function loadPersona() {
  try {
    SYSTEM_PROMPT = fs.readFileSync(PERSONA_PATH, 'utf8');
    logger.info({ path: PERSONA_PATH, len: SYSTEM_PROMPT.length }, 'persona loaded');
  } catch (e) {
    SYSTEM_PROMPT = `你是 Claudio，lizi 的私人 AI 电台 DJ。
输出必须是合法 JSON: {"say":"","play":[],"reason":"","segue":""}`;
    logger.warn({ err: e?.message }, 'persona file missing, using fallback');
  }
}
loadPersona();
// 热更新：文件改动时重载（fs.watchFile 兼容性最好）
try {
  fs.watchFile(PERSONA_PATH, { interval: 2000 }, () => {
    logger.info('persona changed, reloading');
    loadPersona();
  });
} catch (_) {}

function renderPrompt(ctx) {
  const lines = [];
  lines.push('## SYSTEM');
  lines.push(SYSTEM_PROMPT);
  if (ctx.taste)  { lines.push('## USER TASTE'); lines.push(ctx.taste); }
  if (ctx.env)    { lines.push('## ENVIRONMENT'); lines.push(JSON.stringify(ctx.env, null, 2)); }
  if (ctx.memory) { lines.push('## MEMORY'); lines.push(ctx.memory); }
  if (ctx.trace?.length) {
    lines.push('## RECENT DIALOGUE');
    for (const m of ctx.trace) lines.push(`[${m.role}] ${m.text}`);
  }
  lines.push('## USER INPUT');
  lines.push(ctx.input);
  lines.push('\n请仅以上述 JSON schema 回复，不要任何额外文本。');
  return lines.join('\n\n');
}

/**
 * 非流式调用（兼容老路径）
 */
export const claude = {
  ask(ctx) {
    return new Promise((resolve) => {
      const cmd = config.BRAIN_CLI_CMD;
      const args = config.BRAIN_CLI_ARGS.split(/\s+/).filter(Boolean);
      const prompt = renderPrompt(ctx);

      let child;
      try {
        child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (e) {
        logger.error({ err: e?.message, cmd }, 'spawn failed');
        return resolve({ raw: '' });
      }

      let stdout = '', stderr = '';
      const timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch (_) {}
        logger.warn({ timeoutMs: config.BRAIN_TIMEOUT_MS }, 'brain timeout');
        resolve({ raw: '' });
      }, config.BRAIN_TIMEOUT_MS);

      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });

      child.on('error', (err) => {
        clearTimeout(timer);
        logger.error({ err: err?.message }, 'brain spawn error');
        resolve({ raw: '' });
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) logger.warn({ code, stderr: stderr.slice(0, 200) }, 'brain non-zero exit');
        resolve({ raw: stdout });
      });

      try {
        child.stdin.write(prompt);
        child.stdin.end();
      } catch (e) {
        logger.error({ err: e?.message }, 'brain stdin write failed');
      }
    });
  },

  /**
   * 流式调用：每收到一段 text token 就触发 onDelta
   * 结束时 resolve 最终 parsed 结构
   *
   * @param {object} ctx   上下文
   * @param {function} onDelta  (textDelta: string) => void
   * @returns Promise<{say,play,reason,segue}>
   */
  askStream(ctx, onDelta) {
    return new Promise((resolve) => {
      const cmd = config.BRAIN_CLI_CMD;
      // stream-json 必须搭配 --verbose
      const args = ['-p', '--output-format', 'stream-json', '--verbose'];
      const prompt = renderPrompt(ctx);

      let child;
      try {
        child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (e) {
        logger.error({ err: e?.message, cmd }, 'stream spawn failed');
        return resolve(defaults(''));
      }

      let buffer = '';
      let fullText = '';

      const timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch (_) {}
        resolve(defaults(fullText));
      }, config.BRAIN_TIMEOUT_MS);

      child.stdout.on('data', (chunk) => {
        buffer += chunk.toString();
        // NDJSON: 按行切
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const ev = JSON.parse(trimmed);
            if (ev.type === 'assistant' && Array.isArray(ev.message?.content)) {
              for (const part of ev.message.content) {
                if (part.type === 'text' && typeof part.text === 'string') {
                  // DeepSeek/Claude 的 assistant 事件每次都是整段文本（非 token 级）
                  // 计算增量：新文本 - 已发送
                  const delta = part.text.slice(fullText.length);
                  if (delta) {
                    fullText = part.text;
                    try { onDelta?.(delta, fullText); } catch (_) {}
                  }
                }
              }
            }
            if (ev.type === 'result' && typeof ev.result === 'string') {
              // 终态：用 result 覆盖 fullText（更完整）
              if (ev.result.length > fullText.length) {
                const delta = ev.result.slice(fullText.length);
                fullText = ev.result;
                try { onDelta?.(delta, fullText); } catch (_) {}
              }
            }
          } catch (e) {
            logger.debug({ line: trimmed.slice(0, 80) }, 'stream parse skip');
          }
        }
      });

      child.stderr.on('data', (d) => logger.debug({ err: d.toString().slice(0, 100) }, 'brain stream stderr'));

      child.on('error', () => { clearTimeout(timer); resolve(defaults('')); });
      child.on('close', () => {
        clearTimeout(timer);
        resolve(parseBusiness(fullText));
      });

      try {
        child.stdin.write(prompt);
        child.stdin.end();
      } catch (e) {
        logger.error({ err: e?.message }, 'brain stream stdin failed');
      }
    });
  },
};

// ====== 解析工具 ======

export function safeParseBrainOutput({ raw }) {
  if (!raw || typeof raw !== 'string') return defaults('');
  const trimmed = raw.trim();
  if (!trimmed) return defaults('');

  try { return adaptCliEnvelope(JSON.parse(trimmed)); } catch (_) {}

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return adaptCliEnvelope(JSON.parse(fence[1])); } catch (_) {} }

  const brace = trimmed.match(/\{[\s\S]*\}/);
  if (brace) { try { return adaptCliEnvelope(JSON.parse(brace[0])); } catch (_) {} }

  return defaults(trimmed);
}

function adaptCliEnvelope(o) {
  if (o && typeof o === 'object' && typeof o.result === 'string') {
    return parseBusiness(o.result);
  }
  return normalize(o);
}

function parseBusiness(text) {
  if (!text) return defaults('');
  const inner = text.trim();
  try { return normalize(JSON.parse(inner)); } catch (_) {}
  const fence = inner.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return normalize(JSON.parse(fence[1])); } catch (_) {} }
  const brace = inner.match(/\{[\s\S]*\}/);
  if (brace) { try { return normalize(JSON.parse(brace[0])); } catch (_) {} }
  return defaults(inner);
}

function normalize(o) {
  if (!o || typeof o !== 'object') return defaults('');
  return {
    say:    typeof o.say === 'string' ? o.say : '',
    play:   Array.isArray(o.play) ? o.play.slice(0, 5).map(s => ({
              songId: s.songId ?? s.id ?? null,
              name:   String(s.name ?? ''),
              artist: String(s.artist ?? ''),
            })) : [],
    reason: typeof o.reason === 'string' ? o.reason : '',
    segue:  typeof o.segue  === 'string' ? o.segue  : '',
  };
}

function defaults(text) {
  return { say: text || '...', play: [], reason: '', segue: '' };
}
