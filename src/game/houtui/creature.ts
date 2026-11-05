export interface CreatureVisual {
  x: number;
  y: number;
  radius: number;
  color: string;
}

/** 占位扑扑：从画面上方中间朝脸中心放大。 */
export function createCreatureVisual(
  p: number,
  width: number,
  height: number,
  maxRadius: number,
): CreatureVisual {
  const clamped = Math.min(1, Math.max(0, p));
  const centerX = width / 2;
  const centerY = height * 0.45;
  return {
    x: centerX,
    y: height * 0.18 + (centerY - height * 0.18) * clamped,
    radius: Math.max(6, maxRadius * Math.max(0.12, clamped)),
    color: '#f6b26b',
  };
}

export function drawCreature(ctx: CanvasRenderingContext2D, visual: CreatureVisual): void {
  const { x, y, radius, color } = visual;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath();
  ctx.arc(x - radius * 0.3, y - radius * 0.2, radius * 0.1, 0, Math.PI * 2);
  ctx.arc(x + radius * 0.3, y - radius * 0.2, radius * 0.1, 0, Math.PI * 2);
  ctx.fill();
}
