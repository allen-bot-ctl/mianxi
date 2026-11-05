export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FaceFrame {
  /** 调用 detectFaces 的时刻，毫秒。 */
  t: number;
  found: boolean;
  /** DetectData.score，0..1。 */
  score: number;
  /** 已换算到画布坐标，并做过与画面相同的镜像/裁剪变换。 */
  bbox: Rect;
  /** DetectData.mouth，20 点，已换算到画布坐标。 */
  mouth: Point[];
  pitch: number;
  yaw: number;
  roll: number;
  /** 本采样周期是否收到 onMouthAh；仅在 mouth 缺失或无效时作为触发源。 */
  mouthAhEvent?: boolean;
}

export interface Calibration {
  base: number;
  peak: number;
}

export interface Size {
  width: number;
  height: number;
}

export function emptyRect(): Rect {
  return { x: 0, y: 0, w: 0, h: 0 };
}

export function isFinitePoint(point: Point | null | undefined): point is Point {
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.y);
}
