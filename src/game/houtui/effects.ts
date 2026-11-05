/** 占位特效：成功/完美时从嘴部或画面中心炸开的冲击波。 */
export function drawRoarBurst(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number,
  color = '#ffd166',
): void {
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText('嗷！', x, y);
  ctx.restore();
}

/** 占位扑脸：一个压扁的圆，后续替换为美术。 */
export function drawPounce(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(246,178,107,0.9)';
  ctx.beginPath();
  ctx.ellipse(x, y, width * 0.35, width * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
