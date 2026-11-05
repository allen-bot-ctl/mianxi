import type { FaceConfig } from '../../config';
import type { FaceFrame } from '../../types';

export type FaceInvalidReason =
  | 'not_found'
  | 'low_score'
  | 'too_small'
  | 'too_large'
  | 'bad_bbox'
  | 'yaw'
  | 'pitch';

export interface FaceValidity {
  valid: boolean;
  reason?: FaceInvalidReason;
  widthRatio: number;
}

/** §4.3 人脸有效性。所有阈值都来自 config.face。 */
export function evaluateFaceValidity(
  frame: FaceFrame,
  canvasWidth: number,
  config: FaceConfig,
): FaceValidity {
  if (!frame.found) return { valid: false, reason: 'not_found', widthRatio: 0 };
  if (!(frame.score >= config.minScore)) {
    return { valid: false, reason: 'low_score', widthRatio: 0 };
  }
  if (
    !Number.isFinite(frame.bbox.w) ||
    !Number.isFinite(frame.bbox.x) ||
    frame.bbox.w <= 0 ||
    canvasWidth <= 0
  ) {
    return { valid: false, reason: 'bad_bbox', widthRatio: 0 };
  }

  const widthRatio = frame.bbox.w / canvasWidth;
  if (widthRatio < config.minWidthRatio) {
    return { valid: false, reason: 'too_small', widthRatio };
  }
  if (widthRatio > config.maxWidthRatio) {
    return { valid: false, reason: 'too_large', widthRatio };
  }
  if (Math.abs(frame.yaw) > config.maxAbsYaw) {
    return { valid: false, reason: 'yaw', widthRatio };
  }
  if (Math.abs(frame.pitch) > config.maxAbsPitch) {
    return { valid: false, reason: 'pitch', widthRatio };
  }
  return { valid: true, widthRatio };
}
