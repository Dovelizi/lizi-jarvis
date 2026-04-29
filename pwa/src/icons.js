/* ═══════════════════════════════════════════
   Lucide-style SVG 图标集（monoline / 1.5px stroke）
   遵循 Nothing 设计规范：无 filled、无 multi-color
   ═══════════════════════════════════════════ */

const SZ = 16;

function attr(w) {
  return `width="${w??SZ}" height="${w??SZ}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`;
}

export const ICON_PLAY = `<svg ${attr()}><polygon points="6 3 20 12 6 21 6 3"/></svg>`;
export const ICON_PAUSE = `<svg ${attr()}><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/></svg>`;
export const ICON_SKIP_BACK = `<svg ${attr()}><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="4" x2="5" y2="20"/></svg>`;
export const ICON_SKIP_FORWARD = `<svg ${attr()}><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="4" x2="19" y2="20"/></svg>`;
export const ICON_STOP = `<svg ${attr()}><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;
export const ICON_HEART = `<svg ${attr()}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;
export const ICON_HEART_FILLED = `<svg ${attr()} fill="currentColor" stroke="none"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;
export const ICON_MIC = `<svg ${attr()}><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`;
export const ICON_ARROW_RIGHT = `<svg ${attr()}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
export const ICON_X = `<svg ${attr()}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
export const ICON_REFRESH = `<svg ${attr()}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`;
export const ICON_LIST_MUSIC = `<svg ${attr()}><path d="M21 15V6"/><path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/></svg>`;
export const ICON_VOLUME = `<svg ${attr()}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
export const ICON_CHEVRON_LEFT = `<svg ${attr()}><polyline points="15 18 9 12 15 6"/></svg>`;
export const ICON_CHEVRON_RIGHT = `<svg ${attr()}><polyline points="9 18 15 12 9 6"/></svg>`;
