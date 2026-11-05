import { drawVideoCover, type ViewTransform } from '../core/signal';

export type DrawLayer = (ctx: CanvasRenderingContext2D) => void;

export interface CompositorFrame {
  video?: any | null;
  transform?: ViewTransform | null;
  /** 中层：游戏元素。 */
  game?: DrawLayer;
  /** 上层：文字 HUD。 */
  hud?: DrawLayer;
}

/** 从下往上：真人画面 → 游戏元素 → HUD。三层都画在同一个上屏 canvas。 */
export function renderFrame(ctx: CanvasRenderingContext2D, frame: CompositorFrame): void {
  ctx.save();
  if (frame.video && frame.transform) {
    drawVideoCover(ctx, frame.video, frame.transform);
  }
  frame.game?.(ctx);
  frame.hud?.(ctx);
  ctx.restore();
}

export function clearFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
}
