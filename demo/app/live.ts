import type { Tunables } from '../../src/config';
import {
  createViewTransform,
  drawVideoCover,
  type ViewTransform,
} from '../../src/core/signal';
import type { DemoCameraSource } from '../platform/DemoCameraSource';
import type { DemoFaceSource } from '../platform/DemoFaceSource';
import { COLORS } from './canvas';

export function buildView(
  camera: DemoCameraSource,
  config: Tunables,
  width: number,
  height: number,
): ViewTransform | null {
  const video = camera.getVideo();
  if (!video) return null;
  const videoWidth = Number(video.videoWidth ?? video.width ?? width);
  const videoHeight = Number(video.videoHeight ?? video.height ?? height);
  return createViewTransform(
    videoWidth,
    videoHeight,
    width,
    height,
    config.view.VIDEO_PREMIRRORED,
  );
}

/** 下层：真人画面。没有相机时画明确的占位底色，不伪造摄像头画面。 */
export function drawCameraLayer(
  ctx: CanvasRenderingContext2D,
  camera: DemoCameraSource,
  config: Tunables,
  width: number,
  height: number,
): ViewTransform | null {
  const view = buildView(camera, config, width, height);
  if (view) {
    drawVideoCover(ctx, camera.getVideo(), view);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#162033');
    gradient.addColorStop(1, '#080d16');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  return view;
}

export interface FaceOverlayOptions {
  showMouthPoints?: boolean;
  bboxColor?: string;
  bboxAlpha?: number;
  label?: string;
}

/** 中层调试：假 bbox + 几何合成的 20 点 mouth。 */
export function drawFaceOverlay(
  ctx: CanvasRenderingContext2D,
  faceSource: DemoFaceSource,
  width: number,
  height: number,
  options: FaceOverlayOptions = {},
): void {
  const bbox = faceSource.getBBox(width, height);
  const centerX = bbox.x + bbox.w / 2;
  const centerY = bbox.y + bbox.h / 2;
  const color = options.bboxColor ?? 'rgba(255,255,255,0.7)';
  const alpha = options.bboxAlpha ?? 0.8;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, bbox.w / 2, bbox.h / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (options.showMouthPoints !== false) {
    const mouth = faceSource.getLastFrame()?.mouth ?? [];
    ctx.fillStyle = '#5eead4';
    ctx.strokeStyle = 'rgba(94,234,212,0.65)';
    ctx.lineWidth = 1;
    for (const point of mouth) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (mouth.length > 0) {
      ctx.globalAlpha = alpha * 0.45;
      ctx.beginPath();
      mouth.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.stroke();
    }
  }

  if (options.label) {
    ctx.globalAlpha = 1;
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = color;
    ctx.fillText(options.label, centerX, bbox.y - 6);
  }
  ctx.restore();
}

export function drawTargetOval(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color = 'rgba(255,255,255,0.55)',
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.ellipse(width / 2, height * 0.46, width * 0.3, height * 0.34, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawCameraPlaceholder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  message: string,
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, COLORS.bgTop);
  gradient.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, width - 24, height - 24);
  ctx.fillStyle = COLORS.muted;
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, width / 2, height * 0.24);
  ctx.font = '14px sans-serif';
  ctx.fillText('H5 demo：没有拿到摄像头画面', width / 2, height * 0.24 + 28);
  ctx.restore();
}
