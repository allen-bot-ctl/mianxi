import type { ViewTransform } from '../../core/signal';
import type { FaceFrame, Point } from '../../types';
import type { FaceSource, VideoLike } from '../types';

/**
 * 本地假 FaceFrame 序列。用于无摄像头环境跑通状态机、探针 HUD 与日志导出。
 * 注意：它只产生数值，不会画出任何“假装真实”的相机画面。
 */
export class MockFaceSource implements FaceSource {
  start(): void {
    // no-op
  }

  async detect(
    video: VideoLike | null,
    view: ViewTransform,
    tCall: number,
  ): Promise<FaceFrame> {
    const videoWidth = video?.videoWidth ?? view.videoWidth;
    const videoHeight = video?.videoHeight ?? view.videoHeight;
    const centerX = videoWidth * 0.5;
    const centerY = videoHeight * 0.53;

    // 0..1 缓慢张嘴，保证 r_raw / o 在探针 HUD 上有变化。
    const cycle = (Math.sin(tCall / 420) + 1) / 2;
    const mouthWidth = videoWidth * 0.18;
    const mouthHeight = mouthWidth * (0.14 + 0.62 * cycle);

    const rawMouth: Point[] = [];
    for (let index = 0; index < 20; index += 1) {
      const angle = (index / 20) * Math.PI * 2;
      rawMouth.push({
        x: centerX + Math.cos(angle) * mouthWidth * 0.5,
        y: centerY + Math.sin(angle) * mouthHeight * 0.5,
      });
    }

    const rawBBox = {
      x: centerX - videoWidth * 0.21,
      y: centerY - videoHeight * 0.28,
      w: videoWidth * 0.42,
      h: videoHeight * 0.56,
    };

    return {
      t: tCall,
      found: true,
      score: 0.95,
      bbox: view.mapRect(rawBBox),
      mouth: rawMouth.map((point) => view.mapPoint(point)),
      pitch: Math.sin(tCall / 900) * 4,
      yaw: Math.cos(tCall / 1100) * 5,
      roll: 0,
      mouthAhEvent: false,
    };
  }

  stop(): void {
    // no-op
  }
}
