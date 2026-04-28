import cron from 'node-cron';
import crypto from 'node:crypto';
import { config } from './config.js';
import { logger } from './logger.js';
import { broadcast } from './ws.js';
import { claude, safeParseBrainOutput } from './claude.js';
import { buildContext } from './context.js';
import { saveMessage, recentMessages } from './state.js';

const TASKS = [
  { cron: '0 7 * * *',  kind: 'morning_brief',  desc: '早间规划' },
  { cron: '0 9 * * *',  kind: 'first_track',    desc: '第一首歌' },
  { cron: '0 * * * *',  kind: 'hourly_mood',    desc: '整点情绪' },
  { cron: '0 22 * * *', kind: 'wrap_up',        desc: '收尾推荐' },
];

let _music = null;
export function setSchedulerMusic(controller) { _music = controller; }

export function startScheduler() {
  for (const t of TASKS) {
    cron.schedule(t.cron, () => triggerBrief(t.kind), { timezone: config.TZ });
    logger.info({ cron: t.cron, kind: t.kind, desc: t.desc, tz: config.TZ }, 'scheduler registered');
  }
}

async function triggerBrief(kind) {
  logger.info({ kind }, 'scheduler tick');
  const streamId = `sch-${crypto.randomUUID()}`;
  try {
    const ctx = await buildContext({
      userInput: `[scheduler:${kind}] 请按当前时间与 taste 主动播报一段，符合输出 schema`,
      recentMessages: recentMessages(10),
    });
    const raw = await claude.ask(ctx);
    const parsed = safeParseBrainOutput(raw);
    if (!parsed.say) return;

    // scheduler 推荐了歌曲：入队 + 自动播第一首（与 /api/chat/stream 同语义）
    let triggeredPlay = false;
    if (_music && parsed.play?.length) {
      try {
        await _music.enqueue(parsed.play);
        if (!_music.now()?.song || _music.now()?.state === 'idle') {
          const r = await _music.handle({ kind: 'control', op: 'next' });
          if (r?.song) {
            broadcast({ type: 'now_changed', song: r.song });
            triggeredPlay = true;
          }
          if (r?.queue) broadcast({ type: 'queue_changed', queue: r.queue });
        } else {
          broadcast({ type: 'queue_changed', queue: _music.queue() });
        }
      } catch (e) {
        logger.warn({ err: e?.message, kind }, 'scheduler enqueue failed');
      }
    }

    saveMessage('bot', parsed.say, { ...parsed, scheduler: kind });

    // 走 stream_start/end 链路，前端复用 needTtsIntro 走 TTS
    // （兼容：仍发一份旧 claudio_say 给只监听旧事件的客户端）
    broadcast({ type: 'claudio_stream_start', streamId, ts: Date.now(), scheduler: kind });
    broadcast({
      type: 'claudio_stream_end',
      streamId,
      scheduler: kind,
      final: { ...parsed, needTtsIntro: !!(triggeredPlay && parsed.say), scheduler: kind },
    });
  } catch (e) {
    logger.warn({ err: e?.message, kind }, 'scheduler trigger failed');
  }
}
