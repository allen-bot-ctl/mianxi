import { describe, expect, it } from 'vitest';
import { tunables } from '../src/config';
import {
  createCreatureSchedule,
  mulberry32,
  timeScaleForDetectRate,
} from '../src/game/houtui/schedule';

const creatures = tunables.schedule.creatures;
const straight = creatures[0]!;
const pause = creatures[1]!;
const feint = creatures[2]!;

describe('schedule §3.3', () => {
  it('1 号直冲：3.0s ease-in quad 到 1', () => {
    const schedule = createCreatureSchedule(straight, 1, mulberry32(1));
    expect(schedule.pAt(0)).toBe(0);
    expect(schedule.pAt(1500)).toBeCloseTo(0.25, 10);
    expect(schedule.pAt(2999)).toBeLessThan(1);
    expect(schedule.pAt(3000)).toBe(1);
    expect(schedule.pAt(5000)).toBe(1);
  });

  it('2 号停顿：1.4s 到 0.55，随机停顿后 0.9s 到 1', () => {
    const schedule = createCreatureSchedule(pause, 1, () => 0.5);
    expect(schedule.pAt(1400)).toBeCloseTo(0.55, 10);
    expect(schedule.pAt(1850)).toBeCloseTo(0.55, 10);
    expect(schedule.pAt(2299)).toBeCloseTo(0.55, 10);
    expect(schedule.pAt(2300)).toBeCloseTo(0.55, 10);
    expect(schedule.pAt(3199)).toBeLessThan(1);
    expect(schedule.pAt(3200)).toBe(1);
    expect(schedule.pause?.durationMs).toBe(900);
  });

  it('3 号假动作：0.45 → 0.66 假冲 → 0.50 → 随机停 → 1', () => {
    const schedule = createCreatureSchedule(feint, 1, () => 0.5);
    expect(schedule.pAt(1200)).toBeCloseTo(0.45, 10);
    expect(schedule.pAt(1450)).toBeCloseTo(0.66, 10);
    expect(schedule.pAt(1850)).toBeCloseTo(0.5, 10);
    expect(schedule.pAt(2400)).toBeCloseTo(0.5, 10);
    expect(schedule.pAt(3200)).toBe(1);
    expect(schedule.pause?.durationMs).toBe(550);
  });

  it('固定随机种子时停顿仍落在配置区间内', () => {
    const schedule = createCreatureSchedule(pause, 1, mulberry32(42));
    expect(schedule.pause).toBeDefined();
    expect(schedule.pause!.durationMs).toBeGreaterThanOrEqual(600);
    expect(schedule.pause!.durationMs).toBeLessThanOrEqual(1200);
    expect(schedule.keyframes.some((frame) => frame.p === 0.55)).toBe(true);
  });

  it('慢速倍率 1.3 作用于所有时长', () => {
    const slow = createCreatureSchedule(straight, 1.3, mulberry32(1));
    expect(slow.durationMs).toBeCloseTo(3900, 10);
    expect(slow.pAt(1950)).toBeCloseTo(0.25, 10);
    expect(slow.pAt(3900)).toBe(1);
    expect(timeScaleForDetectRate(9.9, tunables.slow)).toBe(1.3);
    expect(timeScaleForDetectRate(10, tunables.slow)).toBe(1);
  });
});
