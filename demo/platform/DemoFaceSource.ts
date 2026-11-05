import type { Tunables } from '../../src/config';
import type { ViewTransform } from '../../src/core/signal';
import type { FaceSource, VideoLike } from '../../src/platform';
import type { FaceFrame, Point, Rect } from '../../src/types';

export const DEMO_SOURCE_LABEL = 'demo-synth';

interface Ratio {
  x: number;
  y: number;
}

/**
 * H5 没有人脸 20 点检测器，也不允许引入 MediaPipe / TF.js / Human / Jeeliz / face-api。
 *
 * 这里的适配策略（交接 §5.3 调试触发 + §4.2 FaceFrame）：
 * - 默认在画布中央生成一个可拖动的假脸框（宽约画布 45%）。
 * - 根据当前「合成张嘴」level，用假 bbox 的几何生成一组合法 20 点 mouth（上下唇分开）。
 * - 真实的 mouthOpenness / faceValidity / IntentEngine 仍然走根目录实现，demo 不复制算法。
 * - 若环境恰好有原生 Shape Detection API FaceDetector，只用它更新 bbox 中心/大小；
 *   mouth 仍然几何合成。没有就完全用手动 bbox。
 */
export class DemoFaceSource implements FaceSource {
  private readonly config: Tunables;
  private started = false;
  private mouthLevel = 0;
  private widthRatio = 0.45;
  private centerRatio: Ratio = { x: 0.5, y: 0.46 };
  private manualUntil = 0;
  private lastFrame: FaceFrame | null = null;
  private lastRaw: number | null = null;
  private nativeDetector: any = null;
  private nativeInFlight = false;
  private nativeAttempted = false;
  private nativeCooldown = 0;

  constructor(config: Tunables) {
    this.config = config;
  }

  start(): void {
    this.started = true;
    this.tryCreateNativeDetector();
  }

  stop(): void {
    this.started = false;
    this.nativeDetector = null;
    this.nativeInFlight = false;
    this.nativeAttempted = false;
  }

  async detect(
    video: VideoLike | null,
    view: ViewTransform,
    tCall: number,
  ): Promise<FaceFrame> {
    if (this.started && video) {
      await this.maybeNativeDetect(video, view);
    }

    if (!this.started || !video) {
      return {
        t: tCall,
        found: false,
        score: 0,
        bbox: { x: 0, y: 0, w: 0, h: 0 },
        mouth: [],
        pitch: 0,
        yaw: 0,
        roll: 0,
        mouthAhEvent: false,
      };
    }

    const bbox = this.getBBox(view.canvasWidth, view.canvasHeight);
    const raw = this.rawAt(this.mouthLevel);
    const mouth = synthMouth(bbox, raw);
    const frame: FaceFrame = {
      t: tCall,
      found: true,
      score: 0.95,
      bbox,
      mouth,
      pitch: 0,
      yaw: 0,
      roll: 0,
      mouthAhEvent: false,
    };
    this.lastFrame = frame;
    this.lastRaw = raw;
    return frame;
  }

  setMouthLevel(level: number): void {
    this.mouthLevel = clamp01(level);
  }

  getMouthLevel(): number {
    return this.mouthLevel;
  }

  getLastFrame(): FaceFrame | null {
    return this.lastFrame;
  }

  getLastRaw(): number | null {
    return this.lastRaw;
  }

  getBBox(canvasWidth: number, canvasHeight: number): Rect {
    const width = Math.max(1, canvasWidth * this.widthRatio);
    const height = Math.max(1, width * 1.25);
    const centerX = canvasWidth * this.centerRatio.x;
    const centerY = canvasHeight * this.centerRatio.y;
    return {
      x: centerX - width / 2,
      y: centerY - height / 2,
      w: width,
      h: height,
    };
  }

  getCenter(canvasWidth: number, canvasHeight: number): Point {
    return {
      x: canvasWidth * this.centerRatio.x,
      y: canvasHeight * this.centerRatio.y,
    };
  }

  getMouthCenter(canvasWidth: number, canvasHeight: number): Point {
    const bbox = this.getBBox(canvasWidth, canvasHeight);
    return {
      x: bbox.x + bbox.w / 2,
      y: bbox.y + bbox.h * 0.62,
    };
  }

  setCenterFromCanvas(x: number, y: number, canvasWidth: number, canvasHeight: number): void {
    const faceWidth = Math.max(1, canvasWidth * this.widthRatio);
    const faceHeight = faceWidth * 1.25;
    const minX = Math.min(canvasWidth, faceWidth * 0.3);
    const maxX = Math.max(0, canvasWidth - faceWidth * 0.3);
    const minY = Math.min(canvasHeight, faceHeight * 0.3);
    const maxY = Math.max(0, canvasHeight - faceHeight * 0.3);
    const safeX = Math.min(maxX, Math.max(minX, x));
    const safeY = Math.min(maxY, Math.max(minY, y));
    this.centerRatio = {
      x: canvasWidth > 0 ? safeX / canvasWidth : 0.5,
      y: canvasHeight > 0 ? safeY / canvasHeight : 0.5,
    };
    // 手动拖动后 2 秒内不让原生检测抢回中心。
    this.manualUntil = performance.now() + 2000;
  }

  get width(): number {
    return this.widthRatio;
  }

  get sourceLabel(): string {
    return DEMO_SOURCE_LABEL;
  }

  private rawAt(level: number): number {
    const min = this.config.calibration.defaultBase;
    const max = Math.max(
      this.config.calibration.defaultPeak,
      min + this.config.calibration.minDelta,
    );
    return min + clamp01(level) * (max - min);
  }

  private tryCreateNativeDetector(): void {
    if (this.nativeAttempted) return;
    this.nativeAttempted = true;
    const Detector = (window as any).FaceDetector;
    if (typeof Detector !== 'function') return;
    try {
      this.nativeDetector = new Detector({ fastMode: true, maxDetectedFaces: 1 });
    } catch {
      this.nativeDetector = null;
    }
  }

  private async maybeNativeDetect(video: VideoLike, view: ViewTransform): Promise<void> {
    if (!this.nativeDetector || this.nativeInFlight || !(video instanceof HTMLVideoElement)) return;
    if (performance.now() < this.manualUntil) return;
    if (performance.now() < this.nativeCooldown) return;
    this.nativeCooldown = performance.now() + 120;

    this.nativeInFlight = true;
    try {
      const faces = await this.nativeDetector.detect(video);
      const face = Array.isArray(faces) ? faces[0] : null;
      const box = face?.boundingBox;
      if (!box) return;

      const mapped = view.mapRect({
        x: Number(box.x ?? 0),
        y: Number(box.y ?? 0),
        w: Number(box.width ?? box.w ?? 0),
        h: Number(box.height ?? box.h ?? 0),
      });
      if (!(mapped.w > 0) || !(mapped.h > 0)) return;

      const targetRatio = clamp(mapped.w / Math.max(1, view.canvasWidth), 0.3, 0.72);
      this.widthRatio = this.widthRatio * 0.7 + targetRatio * 0.3;
      const targetCenter = {
        x: (mapped.x + mapped.w / 2) / Math.max(1, view.canvasWidth),
        y: (mapped.y + mapped.h / 2) / Math.max(1, view.canvasHeight),
      };
      this.centerRatio = {
        x: this.centerRatio.x * 0.7 + targetCenter.x * 0.3,
        y: this.centerRatio.y * 0.7 + targetCenter.y * 0.3,
      };
    } catch {
      // 原生 FaceDetector 不稳定时直接放弃，回到手动 bbox。
      this.nativeDetector = null;
    } finally {
      this.nativeInFlight = false;
    }
  }
}

/**
 * 由假 bbox + r_raw 生成 20 点嘴形。
 * 20 个点均匀落在椭圆环上，bbox 高/宽严格等于 r_raw；上下半环就是上下唇。
 */
function synthMouth(bbox: Rect, raw: number): Point[] {
  const width = Math.max(2, bbox.w * 0.34);
  const rx = width / 2;
  const ry = Math.max(0.5, rx * Math.max(0, raw));
  const centerX = bbox.x + bbox.w / 2;
  const centerY = bbox.y + bbox.h * 0.62;
  const points: Point[] = [];
  for (let index = 0; index < 20; index += 1) {
    const angle = (index / 20) * Math.PI * 2;
    points.push({
      x: centerX + Math.cos(angle) * rx,
      y: centerY + Math.sin(angle) * ry,
    });
  }
  return points;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
