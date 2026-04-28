import { config } from '../../config.js';
import { logger } from '../../logger.js';

export async function fetchWeather() {
  if (!config.QWEATHER_KEY) return null;
  const url = `https://${config.QWEATHER_HOST}/v7/weather/now?location=${encodeURIComponent(config.QWEATHER_LOCATION)}&key=${encodeURIComponent(config.QWEATHER_KEY)}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) {
      logger.warn({ status: r.status }, 'qweather non-ok');
      return null;
    }
    const j = await r.json();
    if (j.code !== '200') {
      logger.warn({ code: j.code }, 'qweather logical error');
      return null;
    }
    const n = j.now || {};
    return {
      temp: n.temp,
      feels: n.feelsLike,
      text: n.text,
      wind: `${n.windDir} ${n.windScale}级`,
      humidity: n.humidity,
      updated: j.updateTime,
    };
  } catch (e) {
    logger.warn({ err: e?.message }, 'qweather fetch failed');
    return null;
  }
}
