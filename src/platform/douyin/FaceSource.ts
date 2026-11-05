import type { ViewTransform } from '../../core/signal';
import type { FaceFrame, Point, Rect } from '../../types';
import type { FaceSource, VideoLike } from '../types';
import { getTT } from './runtime';

interface RawDetectData {
  score?: number;
  boundingBox?: any;
  mouth?: any[];
  pitch?: number;
  yaw?: number;
  roll?: number;
}

/** DetectData → FaceFrame。最大面积优先，统一走 ViewTransform。 */
export class DouyinFaceSource implements FaceSource {
  private detector: any = null;
  private mouthAhEvent = false;

  start(): void {
    if (this.detector) return;
    const tt = getTT();
    this.detector = tt.createFaceDetector();
    try {
      this.detector.onMouthAh?.(() => {
        this.mouthAhEvent = true;
      });
    } catch (error) {
      console.warn('[FaceSource] onMouthAh unavailable', error);
    }
  }

  async detect(
    video: VideoLike | null,
    view: ViewTransform,
    tCall: number,
  ): Promise<FaceFrame> {
    const mouthAhEvent = this.mouthAhEvent;
    this.mouthAhEvent = false;

    if (!this.detector || !video) {
      return emptyFrame(tCall, mouthAhEvent);
    }

    try {
      const raw = await this.detector.detectFaces(video);
      const list: RawDetectData[] = Array.isArray(raw) ? raw : [];
      if (list.length === 0) return emptyFrame(tCall, mouthAhEvent);

      const best = list.reduce((current, candidate) =>
        rawArea(candidate) > rawArea(current) ? candidate : current,
      );

      const bbox = toRect(best.boundingBox);
      const mouth: Point[] = Array.isArray(best.mouth)
        ? best.mouth.map((point) => view.mapPoint({ x: Number(point.x), y: Number(point.y) }))
        : [];

      return {
        t: tCall,
        found: true,
        score: Number(best.score ?? 0),
        bbox: view.mapRect(bbox),
        mouth,
        pitch: Number(best.pitch ?? 0),
        yaw: Number(best.yaw ?? 0),
        roll: Number(best.roll ?? 0),
        mouthAhEvent,
      };
    } catch (error) {
      console.warn('[FaceSource] detectFaces failed', error);
      return emptyFrame(tCall, mouthAhEvent);
    }
  }

  stop(): void {
    try {
      this.detector?.destroy?.();
    } catch {
      // 忽略销毁异常
    }
    this.detector = null;
  }
}

function toRect(box: any): Rect {
  if (!box) return { x: 0, y: 0, w: 0, h: 0 };
  return {
    x: Number(box.x ?? 0),
    y: Number(box.y ?? 0),
    w: Number(box.w ?? box.width ?? 0),
    h: Number(box.h ?? box.height ?? 0),
  };
}

function rawArea(data: RawDetectData): number {
  const box = toRect(data.boundingBox);
  return box.w * box.h;
}

function emptyFrame(t: number, mouthAhEvent: boolean): FaceFrame {
  return {
    t,
    found: false,
    score: 0,
    bbox: { x: 0, y: 0, w: 0, h: 0 },
    mouth: [],
    pitch: 0,
    yaw: 0,
    roll: 0,
    mouthAhEvent,
  };
}
