import { config as dotenvConfig } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 显式指定项目根的 .env，避免 cwd 不在根目录时读不到
dotenvConfig({ path: path.resolve(__dirname, '../../.env') });

function pick(name, fallback) {
  let v = process.env[name];
  if (v == null || v === '') return fallback;
  // 自动剥离用户在 .env 里包裹的成对单/双引号（dotenv 不会脱引号，
  // 但 QQ Cookie 等长字符串用户习惯加引号防止 shell 转义）
  if (v.length >= 2) {
    const first = v[0], last = v[v.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      v = v.slice(1, -1);
    }
  }
  return v;
}

export const config = {
  PORT: Number(pick('PORT', 5173)),
  HOST: pick('HOST', '127.0.0.1'),
  LOG_LEVEL: pick('LOG_LEVEL', 'info'),
  TZ: pick('TZ', 'Asia/Shanghai'),

  BRAIN_CLI_CMD: pick('BRAIN_CLI_CMD', 'claude'),
  BRAIN_CLI_ARGS: pick('BRAIN_CLI_ARGS', '-p --output-format json'),
  BRAIN_TIMEOUT_MS: Number(pick('BRAIN_TIMEOUT_MS', 30000)),

  MUSIC_PROVIDER: pick('MUSIC_PROVIDER', 'qq'),
  QQ_MUSIC_COOKIE: pick('QQ_MUSIC_COOKIE', ''),

  QWEATHER_KEY: pick('QWEATHER_KEY', ''),
  QWEATHER_LOCATION: pick('QWEATHER_LOCATION', '101010100'),
  QWEATHER_HOST: pick('QWEATHER_HOST', 'devapi.qweather.com'),

  TTS_PROVIDER: pick('TTS_PROVIDER', 'webspeech'),
  FISH_AUDIO_KEY: pick('FISH_AUDIO_KEY', ''),

  // SiliconFlow（OpenAI 兼容 TTS）
  SILICONFLOW_KEY:   pick('SILICONFLOW_KEY', ''),
  SILICONFLOW_MODEL: pick('SILICONFLOW_MODEL', 'FunAudioLLM/CosyVoice2-0.5B'),
  SILICONFLOW_VOICE: pick('SILICONFLOW_VOICE', 'claire'),

  FEISHU_APP_ID: pick('FEISHU_APP_ID', ''),
  FEISHU_APP_SECRET: pick('FEISHU_APP_SECRET', ''),

  PRINT_CONFIG_SUMMARY: pick('PRINT_CONFIG_SUMMARY', 'true') === 'true',

  // 路径常量
  PROJECT_ROOT: path.resolve(__dirname, '../../'),
  USER_DIR: path.resolve(__dirname, '../../user'),
  DATA_DIR: path.resolve(__dirname, '../data'),
  PWA_DIST: path.resolve(__dirname, '../../pwa/dist'),
};

export function summarizeConfig() {
  if (!config.PRINT_CONFIG_SUMMARY) return;
  const mask = (k) => (config[k] ? '✓' : '✗');
  // eslint-disable-next-line no-console
  console.log(
    [
      '\n[Claudio] Config summary',
      `  PORT=${config.PORT} HOST=${config.HOST} TZ=${config.TZ}`,
      `  Brain CLI:        ${config.BRAIN_CLI_CMD} ${config.BRAIN_CLI_ARGS}`,
      `  Music Provider:   ${config.MUSIC_PROVIDER} (Cookie ${mask('QQ_MUSIC_COOKIE')})`,
      `  Weather Key:      ${mask('QWEATHER_KEY')}  Location=${config.QWEATHER_LOCATION}`,
      `  TTS Provider:     ${config.TTS_PROVIDER} (Fish ${mask('FISH_AUDIO_KEY')} · SiliconFlow ${mask('SILICONFLOW_KEY')} voice=${config.SILICONFLOW_VOICE})`,
      `  Feishu:           AppID ${mask('FEISHU_APP_ID')}  Secret ${mask('FEISHU_APP_SECRET')}`,
      '',
    ].join('\n')
  );
}
