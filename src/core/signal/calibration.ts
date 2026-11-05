import type { Calibration } from '../../types';

export function median(values: readonly number[]): number {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return 0;
  const middle = Math.floor(finite.length / 2);
  if (finite.length % 2 === 1) return finite[middle]!;
  return (finite[middle - 1]! + finite[middle]!) / 2;
}

/** 最近秩百分位，p ∈ [0,1]。用于 peak 的第 90 百分位。 */
export function percentile(values: readonly number[], p: number): number {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return 0;
  const clamped = Math.min(1, Math.max(0, p));
  const rank = Math.ceil(clamped * finite.length) - 1;
  return finite[Math.max(0, Math.min(finite.length - 1, rank))]!;
}

export interface CalibrationResult {
  base: number;
  peak: number;
  delta: number;
  valid: boolean;
}

/** §6：闭嘴 1s 取中位数作 base；张嘴 1.5s 取第 90 百分位作 peak。 */
export function computeCalibration(
  closedSamples: readonly number[],
  openSamples: readonly number[],
  minDelta: number,
  peakPercentile = 0.9,
): CalibrationResult {
  const base = median(closedSamples);
  const peak = percentile(openSamples, peakPercentile);
  const delta = peak - base;
  return { base, peak, delta, valid: delta >= minDelta };
}

export function defaultCalibration(
  config: { defaultBase: number; defaultPeak: number },
): Calibration {
  return { base: config.defaultBase, peak: config.defaultPeak };
}
