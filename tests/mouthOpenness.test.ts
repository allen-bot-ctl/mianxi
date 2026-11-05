import { describe, expect, it } from 'vitest';
import {
  MAX_OPENNESS,
  measureMouth,
  mouthRatio,
  normalizeOpenness,
} from '../src/core/signal/mouthOpenness';
import type { Point } from '../src/types';

function rectMouth(x0: number, y0: number, x1: number, y1: number): Point[] {
  const corners: Point[] = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  return Array.from({ length: 20 }, (_value, index) => corners[index % 4]!);
}

describe('mouthOpenness', () => {
  it('用 20 点包围盒计算 r_raw', () => {
    const mouth = rectMouth(0, 0, 100, 20);
    expect(mouth).toHaveLength(20);
    expect(mouthRatio(mouth)).toBeCloseTo(0.2, 10);
  });

  it('个人归一化并把 o 截断到 [0, 1.5]', () => {
    const calibration = { base: 0.1, peak: 0.6 };

    expect(normalizeOpenness(0.2, calibration)).toBeCloseTo(0.2, 10);
    expect(normalizeOpenness(0.02, calibration)).toBe(0);
    expect(normalizeOpenness(1.0, calibration)).toBe(MAX_OPENNESS);
  });

  it('测量结果同时给出 r_raw 与 o', () => {
    const result = measureMouth(rectMouth(0, 0, 100, 30), { base: 0.1, peak: 0.6 });
    expect(result.valid).toBe(true);
    expect(result.rRaw).toBeCloseTo(0.3, 10);
    expect(result.o).toBeCloseTo(0.4, 10);
  });

  it('点数不足/含非法坐标时判为无效', () => {
    const short = rectMouth(0, 0, 100, 20).slice(0, 19);
    expect(mouthRatio(short)).toBeNull();

    const bad = rectMouth(0, 0, 100, 20);
    bad[5] = { x: Number.NaN, y: 1 };
    expect(mouthRatio(bad)).toBeNull();

    const degenerate = rectMouth(50, 0, 50, 20);
    expect(mouthRatio(degenerate)).toBeNull();
  });
});
