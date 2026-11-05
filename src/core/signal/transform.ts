import type { Point, Rect, Size } from '../../types';

/**
 * 画面与关键点共用的唯一坐标变换。
 *
 * 画面采用 cover：等比放大到铺满画布并居中裁剪。
 * 若视频未预镜像（VIDEO_PREMIRRORED=false），上屏画面和坐标都围绕画布中心水平镜像。
 */
export interface ViewTransform {
  videoWidth: number;
  videoHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  premirrored: boolean;
  scale: number;
  dx: number;
  dy: number;
  mapPoint(point: Point): Point;
  mapRect(rect: Rect): Rect;
}

export function createViewTransform(
  videoWidth: number,
  videoHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  premirrored: boolean,
): ViewTransform {
  const safeVideoWidth = videoWidth > 0 ? videoWidth : canvasWidth;
  const safeVideoHeight = videoHeight > 0 ? videoHeight : canvasHeight;
  const scale = Math.max(canvasWidth / safeVideoWidth, canvasHeight / safeVideoHeight);
  const dx = (canvasWidth - safeVideoWidth * scale) / 2;
  const dy = (canvasHeight - safeVideoHeight * scale) / 2;

  const transform: ViewTransform = {
    videoWidth: safeVideoWidth,
    videoHeight: safeVideoHeight,
    canvasWidth,
    canvasHeight,
    premirrored,
    scale,
    dx,
    dy,
    mapPoint(point: Point): Point {
      const x = dx + point.x * scale;
      return {
        x: premirrored ? x : canvasWidth - x,
        y: dy + point.y * scale,
      };
    },
    mapRect(rect: Rect): Rect {
      const x = dx + rect.x * scale;
      return {
        x: premirrored ? x : canvasWidth - dx - (rect.x + rect.w) * scale,
        y: dy + rect.y * scale,
        w: rect.w * scale,
        h: rect.h * scale,
      };
    },
  };

  return transform;
}

/** 用同一套 cover + 镜像规则把相机画到上屏 canvas。 */
export function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  video: any,
  transform: ViewTransform,
): void {
  if (!video) return;
  const { canvasWidth, dx, dy, scale, videoWidth, videoHeight, premirrored } = transform;
  ctx.save();
  if (!premirrored) {
    ctx.translate(canvasWidth, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, dx, dy, videoWidth * scale, videoHeight * scale);
  ctx.restore();
}

export function viewSizeOf(transform: ViewTransform): Size {
  return { width: transform.canvasWidth, height: transform.canvasHeight };
}
