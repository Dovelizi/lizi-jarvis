import { player } from '../audio.js';
import { store } from '../store.js';

/**
 * ClaudioLightCurtain — 页面氛围光 + 聚光灯（设计版 · v6 · Ambient）
 * ---------------------------------------------------
 * 核心设计理念：
 *   "不是一个边框，而是从屏幕外渗进来的光。"
 *
 * 两个独立视觉层：
 *   ① 氛围雾光 (ambient fog) —— 四团大型径向渐变在屏幕四条边中央附近，
 *      向屏幕中心柔和衰减。没有清晰轮廓，像 HDR 照片窗外溢出的强光或
 *      舞台大幕的散射光。每团有独立呼吸 + 有机漂移，四团重叠在角落
 *      形成自然的暖角。
 *
 *   ② 页面聚光灯 (page spotlight) —— 一个大型径向光斑（半径 ~260px），
 *      只在音乐高能量段（副歌、鼓点密集段）出现。沿一条缓慢移动的曲线
 *      扫过屏幕内部，像真正的舞台射灯在画面上划过。
 *
 * 时机控制：
 *   - 氛围雾光：随着 state=playing 出现，能量越大越饱满
 *   - 聚光灯：仅当能量 > 高阈值（0.10）时触发一次扫过，扫过周期 45s
 *             扫过结束后进入"冷却"状态（至少 6s），等待下一次高能量段
 *
 * 色彩：
 *   氛围雾光    #FF6B1A ~ #FFAA64（品牌橙 → 琥珀），暖色调
 *   聚光灯芯    #FFD9B8（暖白），聚光灯外晕 #FF8C3C
 *
 * 仪式感：
 *   入场：氛围雾光从四角同时渐入（~1.2s）
 *   退场：所有光一起柔和淡出（~0.8s）
 *
 * 绘制实现：
 *   纯 canvas 径向渐变 fillRect，零边框，零描边，零拼接缝。
 *   四团雾光 + 一个聚光灯 = 每帧 5 次 fill，性能开销极小。
 */

// ===== 品牌色 =====
const COLOR_WARM_ORANGE = '255, 107, 26';     // #FF6B1A 主橙
const COLOR_AMBER = '255, 170, 100';          // 琥珀
const COLOR_SPOTLIGHT_CORE = '255, 217, 184'; // 聚光灯芯（暖白）
const COLOR_SPOTLIGHT_HALO = '255, 140, 60';  // 聚光灯外晕

// ===== 氛围雾光 =====
// 每团雾光的基础半径 = min(视口宽高) × 该系数 → 自适应尺寸
const FOG_RADIUS_RATIO = 0.42;
// 半径的呼吸振幅：0.12 = 基础半径的 ±12%
const FOG_RADIUS_BREATH = 0.12;
// 雾光 alpha 的峰值（单团在"最亮"时达到）
const FOG_ALPHA_PEAK = 0.28;
// 四团雾光的独立呼吸周期（秒）—— 互素，永不同步
const FOG_PERIODS = [7.3, 5.9, 9.1, 6.7];
// 位置沿边缘的漂移幅度（归一化到边长的比例）—— 让雾光中心左右慢移
const FOG_DRIFT_AMP = 0.22;
// 位置漂移周期（秒）
const FOG_DRIFT_PERIODS = [18, 23, 15, 21];
// 静默（能量 < SILENCE_ENERGY_THRESHOLD）时完全隐藏
const SILENCE_ENERGY_THRESHOLD = 0.008;
// 能量 EMA 平滑时间常数（秒）
const ENERGY_EMA_TAU = 0.8;

// ===== 聚光灯 =====
// 聚光灯芯半径（px）—— 适度扩大，让中心的"亮区"更柔和地铺开
const SPOT_CORE_RADIUS = 160;
// 聚光灯外晕半径（px）—— 加大半径，让衰减距离更长 → 边缘无痕迹融入背景
const SPOT_HALO_RADIUS = 340;
// 聚光灯核心 alpha —— 降低峰值亮度，去掉"刺眼"的感觉
const SPOT_CORE_ALPHA = 0.22;
// 聚光灯外晕 alpha —— 进一步压低，让外围只是淡淡的暖色雾
const SPOT_HALO_ALPHA = 0.08;
// 高斯衰减的"陡峭度"—— k 越大中心越集中，k 越小过渡越平滑
// k=3 意味着 r=0.58 处亮度降到 exp(-3*0.58²)≈0.36，边缘早已消散无形
const SPOT_GAUSS_K = 3.2;
// 触发聚光灯的能量阈值（高于此才会启动一次扫过）
const SPOT_TRIGGER_ENERGY = 0.10;
// 一次扫过的时长（秒）
const SPOT_SWEEP_DURATION = 5.5;
// 扫过结束后的冷却时间（秒）—— 即使持续高能量，也要等这么久才能再扫
const SPOT_COOLDOWN = 6.0;
// 扫过时的淡入 / 淡出占总时长的比例
const SPOT_FADE_PORTION = 0.18;

// ===== 仪式过渡 =====
const RITUAL_ENTER_SEC = 1.2;
const RITUAL_EXIT_SEC = 0.8;

class ClaudioLightCurtain extends HTMLElement {
  connectedCallback() {
    this._canvas = document.createElement('canvas');
    Object.assign(this._canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '90',
      willChange: 'opacity',
    });
    this._canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this._canvas);
    this._ctx = this._canvas.getContext('2d');
    this._dpr = Math.min(window.devicePixelRatio || 1, 2);

    this._resize();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);

    // 平滑状态
    this._smoothEnergy = 0;
    // 仪式过渡进度（0=未开始，1=完成）
    this._ritualProgress = 0;
    this._isShowing = false;
    this._lastStateChangeAt = 0;

    // 聚光灯状态机：'idle' | 'sweeping' | 'cooldown'
    this._spotState = 'idle';
    // 聚光灯进度：sweep 时 0→1，cooldown 时 0→1 累计
    this._spotPhaseStart = 0;
    // 本次扫过的起点角度和目标角度（控制扫过轨迹）
    this._spotAngleStart = 0;
    this._spotAngleEnd = 0;

    this._lastFrameT = performance.now() / 1000;
    this._anim();
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this._onResize);
    if (this._raf) {
      cancelAnimationFrame(this._raf);
    }
    this._canvas?.remove();
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === this._w && h === this._h) {
      return;
    }
    this._w = w;
    this._h = h;
    const dpr = this._dpr;
    this._canvas.width = w * dpr;
    this._canvas.height = h * dpr;
  }

  _anim() {
    this._raf = requestAnimationFrame(() => this._anim());
    const nowSec = performance.now() / 1000;
    const dt = Math.max(0, Math.min(0.05, nowSec - (this._lastFrameT || nowSec)));
    this._lastFrameT = nowSec;

    const state = store.state.now?.state;
    const freq = player.getFrequencyData();

    // 瞬时能量
    let instantEnergy = 0;
    if (freq && freq.length > 0) {
      let sum = 0;
      for (let i = 0; i < freq.length; i++) {
        sum += freq[i];
      }
      instantEnergy = sum / freq.length / 255;
    }

    // EMA 平滑
    const emaAlpha = 1 - Math.exp(-dt / ENERGY_EMA_TAU);
    this._smoothEnergy += (instantEnergy - this._smoothEnergy) * emaAlpha;

    // 可见性状态
    const shouldShow = state === 'playing'
      && this._smoothEnergy > SILENCE_ENERGY_THRESHOLD;
    if (shouldShow !== this._isShowing) {
      this._isShowing = shouldShow;
      this._lastStateChangeAt = nowSec;
    }

    const timeSinceChange = nowSec - this._lastStateChangeAt;
    if (this._isShowing) {
      this._ritualProgress = Math.min(1, timeSinceChange / RITUAL_ENTER_SEC);
    } else {
      this._ritualProgress = Math.max(0, 1 - timeSinceChange / RITUAL_EXIT_SEC);
    }

    // 聚光灯状态机：在音乐高能量段触发扫过
    this._updateSpotlightState(nowSec);

    if (!this._loggedOnce) {
      this._loggedOnce = true;
      // eslint-disable-next-line no-console
      console.info('[light-curtain v6 ambient] ready', {
        state,
        dpr: this._dpr,
        viewport: [this._w, this._h],
      });
    }

    if (this._ritualProgress < 1e-3) {
      this._clear();
      return;
    }

    this._drawFrame(nowSec);
  }

  /**
   * 聚光灯状态机：根据能量触发扫过，管理 cooldown。
   *
   * idle     → 能量超过阈值 → sweeping（持续 SPOT_SWEEP_DURATION）
   * sweeping → 扫过完成    → cooldown（持续 SPOT_COOLDOWN）
   * cooldown → 冷却结束    → idle
   */
  _updateSpotlightState(nowSec) {
    const elapsed = nowSec - this._spotPhaseStart;
    if (this._spotState === 'sweeping') {
      if (elapsed >= SPOT_SWEEP_DURATION) {
        this._spotState = 'cooldown';
        this._spotPhaseStart = nowSec;
      }
    } else if (this._spotState === 'cooldown') {
      if (elapsed >= SPOT_COOLDOWN) {
        this._spotState = 'idle';
      }
    } else if (this._spotState === 'idle') {
      // 只在真正播放 + 高能量时触发
      if (this._isShowing && this._smoothEnergy > SPOT_TRIGGER_ENERGY) {
        this._spotState = 'sweeping';
        this._spotPhaseStart = nowSec;
        // 随机选择一条扫过路径：从屏幕某条边附近扫到对侧附近
        // 用屏幕的四个区域（TL/TR/BR/BL）随机配对，形成多样化的扫过轨迹
        const starts = [
          { x: -0.1, y: 0.3 },  // 左侧偏上
          { x: -0.1, y: 0.7 },  // 左侧偏下
          { x: 0.3, y: -0.1 },  // 顶部偏左
          { x: 0.7, y: -0.1 },  // 顶部偏右
        ];
        const ends = [
          { x: 1.1, y: 0.7 },   // 右侧偏下
          { x: 1.1, y: 0.3 },   // 右侧偏上
          { x: 0.7, y: 1.1 },   // 底部偏右
          { x: 0.3, y: 1.1 },   // 底部偏左
        ];
        const startIdx = Math.floor(Math.random() * starts.length);
        const endIdx = Math.floor(Math.random() * ends.length);
        this._spotStartNorm = starts[startIdx];
        this._spotEndNorm = ends[endIdx];
        // 曲线"鼓起"方向（Bezier 控制点的偏移）—— 让扫过路径有弧度
        this._spotCurveOffset = (Math.random() - 0.5) * 0.4;
      }
    }

    // 如果播放停止，立即退出聚光灯
    if (!this._isShowing && this._spotState !== 'idle') {
      this._spotState = 'idle';
    }
  }

  _clear() {
    const ctx = this._ctx;
    const dpr = this._dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this._w, this._h);
  }

  _drawFrame(tSec) {
    const ctx = this._ctx;
    const dpr = this._dpr;
    const w = this._w;
    const h = this._h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'lighter';  // 多层叠加用 lighter，形成真正的"光"

    const ritual = this._ritualProgress;
    const easedRitual = easeOutCubic(ritual);
    // 能量激活：低音量时氛围淡、高音量时饱满
    const energyActivation = smoothstep(
      SILENCE_ENERGY_THRESHOLD,
      SILENCE_ENERGY_THRESHOLD + 0.08,
      this._smoothEnergy,
    );

    // ===== 层 1：氛围雾光 · 四团大型径向渐变沿四边 =====
    this._drawAmbientFog(ctx, tSec, easedRitual, energyActivation);

    // ===== 层 2：页面聚光灯 · 仅在 sweeping 状态绘制 =====
    if (this._spotState === 'sweeping') {
      this._drawSpotlight(ctx, tSec);
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * 绘制四团氛围雾光：顶、右、底、左，各自独立呼吸 + 位置漂移。
   * 使用 radial-gradient fillRect，填满整个画布 —— 四个渐变在中间重叠时
   * 由 composite=lighter 叠加产生柔和的过渡。
   */
  _drawAmbientFog(ctx, tSec, easedRitual, energyActivation) {
    const w = this._w;
    const h = this._h;
    const baseRadius = Math.min(w, h) * FOG_RADIUS_RATIO;

    // 四个"边中心锚点"的基础位置（归一化）
    // [锚点位置函数（返回 x, y）, 呼吸周期, 漂移周期, 色调倾向]
    const fogs = [
      {
        // 顶边：锚点在顶部外侧（y 为负，让光团中心在屏幕外）
        anchor: (drift) => ({ x: w * (0.5 + drift), y: -h * 0.05 }),
        periodIdx: 0, driftIdx: 0,
        color: COLOR_WARM_ORANGE, hueWeight: 0.5,
      },
      {
        // 右边
        anchor: (drift) => ({ x: w * 1.05, y: h * (0.5 + drift) }),
        periodIdx: 1, driftIdx: 1,
        color: COLOR_AMBER, hueWeight: 0.6,
      },
      {
        // 底边
        anchor: (drift) => ({ x: w * (0.5 - drift), y: h * 1.05 }),
        periodIdx: 2, driftIdx: 2,
        color: COLOR_WARM_ORANGE, hueWeight: 0.55,
      },
      {
        // 左边
        anchor: (drift) => ({ x: -w * 0.05, y: h * (0.5 - drift) }),
        periodIdx: 3, driftIdx: 3,
        color: COLOR_AMBER, hueWeight: 0.5,
      },
    ];

    for (const fog of fogs) {
      // 呼吸波（0~1）
      const breath = 0.5 + 0.5 * Math.sin(
        (2 * Math.PI * tSec) / FOG_PERIODS[fog.periodIdx],
      );
      // 位置漂移（-FOG_DRIFT_AMP ~ +FOG_DRIFT_AMP）
      const drift = FOG_DRIFT_AMP * Math.sin(
        (2 * Math.PI * tSec) / FOG_DRIFT_PERIODS[fog.driftIdx],
      );
      // 锚点位置（有意让其中心在屏幕外 → 光从外溢进屏幕）
      const { x: cx, y: cy } = fog.anchor(drift);
      // 半径随呼吸轻微膨胀/收缩
      const radius = baseRadius * (1 + (breath - 0.5) * FOG_RADIUS_BREATH * 2);
      // 单团雾光的 alpha：受能量激活 + 仪式过渡 + 呼吸共同调制
      const alpha = FOG_ALPHA_PEAK
        * energyActivation
        * easedRitual
        * (0.6 + 0.4 * breath)
        * fog.hueWeight;

      if (alpha < 0.003) {
        continue;
      }

      // 径向渐变：中心亮 → 边缘透明
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, `rgba(${fog.color}, ${alpha.toFixed(3)})`);
      grad.addColorStop(0.45, `rgba(${fog.color}, ${(alpha * 0.35).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${fog.color}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }

  /**
   * 绘制聚光灯：沿 Bezier 曲线从起点扫到终点，带淡入淡出。
   * 两层径向渐变：外晕（大半径暖色） + 芯（小半径暖白）。
   */
  _drawSpotlight(ctx, tSec) {
    const w = this._w;
    const h = this._h;
    const elapsed = tSec - this._spotPhaseStart;
    // 扫过进度 u ∈ [0, 1]
    const u = Math.max(0, Math.min(1, elapsed / SPOT_SWEEP_DURATION));
    // 用 easeInOutCubic 让"出发慢、中段快、到达慢" —— 舞台灯光的真实感
    const easedU = easeInOutCubic(u);

    // 淡入淡出：两端各占 SPOT_FADE_PORTION
    let fade;
    if (u < SPOT_FADE_PORTION) {
      fade = u / SPOT_FADE_PORTION;
    } else if (u > 1 - SPOT_FADE_PORTION) {
      fade = (1 - u) / SPOT_FADE_PORTION;
    } else {
      fade = 1;
    }
    fade = easeOutCubic(fade);

    // Bezier 控制点（让路径有弧度，弧度方向由 _spotCurveOffset 决定）
    const p0 = this._spotStartNorm;
    const p1 = this._spotEndNorm;
    const mid = {
      x: (p0.x + p1.x) / 2 + this._spotCurveOffset,
      y: (p0.y + p1.y) / 2 - Math.abs(this._spotCurveOffset) * 0.6,
    };
    // 二次 Bezier：(1-t)² p0 + 2(1-t)t mid + t² p1
    const omt = 1 - easedU;
    const xNorm = omt * omt * p0.x + 2 * omt * easedU * mid.x + easedU * easedU * p1.x;
    const yNorm = omt * omt * p0.y + 2 * omt * easedU * mid.y + easedU * easedU * p1.y;
    const cx = xNorm * w;
    const cy = yNorm * h;

    // 外晕层 —— 高斯衰减曲线：中心亮，向外指数级衰减，边缘完全消散，无可见轮廓
    const haloGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, SPOT_HALO_RADIUS);
    applyGaussianGradient(haloGrad, COLOR_SPOTLIGHT_HALO, SPOT_HALO_ALPHA * fade);
    ctx.fillStyle = haloGrad;
    ctx.fillRect(0, 0, w, h);

    // 芯层 —— 同样用高斯衰减，半径更小、峰值稍高，但都非常柔和
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, SPOT_CORE_RADIUS);
    applyGaussianGradient(coreGrad, COLOR_SPOTLIGHT_CORE, SPOT_CORE_ALPHA * fade);
    ctx.fillStyle = coreGrad;
    ctx.fillRect(0, 0, w, h);
  }
}

// ========== 工具函数 ==========

/**
 * smoothstep：在 [edge0, edge1] 平滑插值（Hermite），区间外 clamp。
 */
function smoothstep(edge0, edge1, x) {
  if (edge1 <= edge0) {
    return x >= edge0 ? 1 : 0;
  }
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * easeOutCubic：缓出三次方曲线。
 */
function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

/**
 * easeInOutCubic：先慢后快再慢的三次方曲线（舞台灯光的运动曲线）。
 */
function easeInOutCubic(x) {
  return x < 0.5
    ? 4 * x * x * x
    : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * 给径向渐变应用"高斯衰减"曲线。核心思想：
 *   alpha(r) = peakAlpha * exp(-k * r²)
 * 其中 r 是归一化半径（0=中心, 1=边缘）。由于 exp 函数是光滑单调下降的，
 * 从中心到边缘没有任何拐点 / 可见轮廓，视觉上就是"中心亮、向四周柔和扩散"。
 *
 * 通过 10 个密集采样点把这条曲线灌入 canvas 的 addColorStop，得到
 * 肉眼难以察觉分段的平滑渐变（真实效果等同于计算着色器的连续衰减）。
 *
 * @param {CanvasGradient} grad      目标径向渐变
 * @param {string} rgbColor           'r, g, b' 格式的颜色字符串
 * @param {number} peakAlpha          中心峰值 alpha（0~1）
 */
function applyGaussianGradient(grad, rgbColor, peakAlpha) {
  // 10 个采样点：r=0, 0.1, 0.2, ..., 0.9, 1.0
  const samples = 10;
  for (let i = 0; i <= samples; i++) {
    const r = i / samples;
    // 高斯衰减：alpha = peak * exp(-k * r²)
    // 边界处 (r=1) 强制为 0，避免浮点误差留下极小的 alpha
    const a = i === samples
      ? 0
      : peakAlpha * Math.exp(-SPOT_GAUSS_K * r * r);
    grad.addColorStop(r, `rgba(${rgbColor}, ${a.toFixed(4)})`);
  }
}

if (!customElements.get('claudio-light-curtain')) {
  customElements.define('claudio-light-curtain', ClaudioLightCurtain);
}
