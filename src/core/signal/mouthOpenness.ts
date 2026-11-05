import type { Calibration, Point } from '../../types';
import { isFinitePoint } from '../../types';

export const MOUTH_POINT_COUNT = 20;
export const MAX_OPENNESS = 1.5;

/** §4.4 兜底判定：mouth 必须恰好 20 点且全部有限。 */
export function isValidMouth(mouth: readonly Point[] | null | undefined): mouth is Point[] {
  return (
    !!mouth &&
    mouth.length === MOUTH_POINT_COUNT &&
    mouth.every((point) => isFinitePoint(point))
  );
}

/** r_raw = 嘴部 20 点包围盒高 / 包围盒宽。无效输入返回 null。 */
export function mouthRatio(mouth: readonly Point[] | null | undefined): number | null {
  if (!isValidMouth(mouth)) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of mouth) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0) return null;
  return height / width;
}

/** o = (r_raw - base) / (peak - base)，截断到 [0, 1.5]。 */
export function normalizeOpenness(rRaw: number, calibration: Calibration): number {
  const denominator = calibration.peak - calibration.base;
  if (!Number.isFinite(rRaw) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  const value = (rRaw - calibration.base) / denominator;
  return Math.min(MAX_OPENNESS, Math.max(0, value));
}

export interface MouthMeasurement {
  valid: boolean;
  rRaw: number | null;
  o: number | null;
}

export function measureMouth(
  mouth: readonly Point[] | null | undefined,
  calibration: Calibration,
): MouthMeasurement {
  const rRaw = mouthRatio(mouth);
  if (rRaw === null) return { valid: false, rRaw: null, o: null };
  return { valid: true, rRaw, o: normalizeOpenness(rRaw, calibration) };
}
