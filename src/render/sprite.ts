/** 轻量色块精灵，只用于本轮占位美术。 */
export class Sprite {
  x = 0;
  y = 0;
  radius = 10;
  color = '#f6b26b';
  visible = true;

  constructor(options?: { x?: number; y?: number; radius?: number; color?: string }) {
    if (options) Object.assign(this, options);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) return;
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
