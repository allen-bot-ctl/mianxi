import type { CreatureConfig, TitleConfig } from '../../config';

/** 可复现的固定种子随机数（同一 seed 处理暂停时长）。 */
export type RandomFn = () => number;

export function mulberry32(seed: number): RandomFn {
  let a = seed >>> 0;
  return function random(): number {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function linear(t: number): number {
  return Math.min(1, Math.max(0, t));
}

export function easeInQuad(t: number): number {
  const clamped = linear(t);
  return clamped * clamped;
}

export interface Keyframe {
  t: number;
  p: number;
}

export interface CreatureSchedule {
  id: number;
  kind: CreatureConfig['kind'];
  durationMs: number;
  keyframes: readonly Keyframe[];
  pause?: { startMs: number; endMs: number; durationMs: number };
  pAt(elapsedMs: number): number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * linear(t);
}

function durationBetween(min: number, max: number, random: RandomFn): number {
  return min + (max - min) * Math.min(1, Math.max(0, random()));
}

/** §3.3 单只扑扑的 p(t) 曲线。timeScale=1.3 即慢速难度。 */
export function createCreatureSchedule(
  config: CreatureConfig,
  timeScale = 1,
  random: RandomFn = mulberry32(1),
): CreatureSchedule {
  const scale = timeScale > 0 ? timeScale : 1;
  const ms = (value: number): number => value * scale;

  if (config.kind === 'straight') {
    const total = ms(config.durationMs);
    const easing = config.easing === 'easeInQuad' ? easeInQuad : linear;
    return {
      id: config.id,
      kind: config.kind,
      durationMs: total,
      keyframes: [
        { t: 0, p: 0 },
        { t: total, p: 1 },
      ],
      pAt(elapsedMs: number): number {
        if (elapsedMs <= 0) return 0;
        if (elapsedMs >= total) return 1;
        return easing(elapsedMs / total);
      },
    };
  }

  if (config.kind === 'pause') {
    const firstMs = ms(config.firstPhaseMs);
    const pauseMs = ms(durationBetween(config.pauseMsMin, config.pauseMsMax, random));
    const finalMs = ms(config.finalPhaseMs);
    const pauseStart = firstMs;
    const pauseEnd = pauseStart + pauseMs;
    const total = pauseEnd + finalMs;

    return {
      id: config.id,
      kind: config.kind,
      durationMs: total,
      pause: { startMs: pauseStart, endMs: pauseEnd, durationMs: pauseMs },
      keyframes: [
        { t: 0, p: 0 },
        { t: firstMs, p: config.firstPhaseP },
        { t: pauseEnd, p: config.firstPhaseP },
        { t: total, p: 1 },
      ],
      pAt(elapsedMs: number): number {
        if (elapsedMs <= 0) return 0;
        if (elapsedMs < firstMs) {
          return lerp(0, config.firstPhaseP, elapsedMs / firstMs);
        }
        if (elapsedMs <= pauseEnd) return config.firstPhaseP;
        if (elapsedMs >= total) return 1;
        return lerp(config.firstPhaseP, 1, (elapsedMs - pauseEnd) / finalMs);
      },
    };
  }

  const firstMs = ms(config.firstPhaseMs);
  const riseMs = ms(config.feintRiseMs);
  const returnMs = ms(config.feintReturnMs);
  const pauseMs = ms(durationBetween(config.pauseMsMin, config.pauseMsMax, random));
  const finalMs = ms(config.finalPhaseMs);

  const riseEnd = firstMs + riseMs;
  const returnEnd = riseEnd + returnMs;
  const pauseEnd = returnEnd + pauseMs;
  const total = pauseEnd + finalMs;

  return {
    id: config.id,
    kind: config.kind,
    durationMs: total,
    pause: { startMs: returnEnd, endMs: pauseEnd, durationMs: pauseMs },
    keyframes: [
      { t: 0, p: 0 },
      { t: firstMs, p: config.firstPhaseP },
      { t: riseEnd, p: config.feintPeakP },
      { t: returnEnd, p: config.feintReturnP },
      { t: pauseEnd, p: config.feintReturnP },
      { t: total, p: 1 },
    ],
    pAt(elapsedMs: number): number {
      if (elapsedMs <= 0) return 0;
      if (elapsedMs < firstMs) return lerp(0, config.firstPhaseP, elapsedMs / firstMs);
      if (elapsedMs < riseEnd) {
        return lerp(config.firstPhaseP, config.feintPeakP, (elapsedMs - firstMs) / riseMs);
      }
      if (elapsedMs < returnEnd) {
        return lerp(config.feintPeakP, config.feintReturnP, (elapsedMs - riseEnd) / returnMs);
      }
      if (elapsedMs <= pauseEnd) return config.feintReturnP;
      if (elapsedMs >= total) return 1;
      return lerp(config.feintReturnP, 1, (elapsedMs - pauseEnd) / finalMs);
    },
  };
}

export function createHoutuiSchedules(
  creatures: readonly CreatureConfig[],
  timeScale = 1,
  random: RandomFn = mulberry32(1),
): CreatureSchedule[] {
  return creatures.map((creature) => createCreatureSchedule(creature, timeScale, random));
}

/** 检测频率低于阈值则用慢速倍率。 */
export function timeScaleForDetectRate(
  detectHz: number,
  config: { detectHzThreshold: number; timeScale: number },
): number {
  return detectHz < config.detectHzThreshold ? config.timeScale : 1;
}

/** §3.5 称号，文案只在 config 中维护。 */
export function getTitle(score: number, titles: readonly TitleConfig[]): string {
  const matched = titles.find((title) => score >= title.min && score <= title.max);
  return matched ? matched.label : titles[titles.length - 1]?.label ?? '';
}
