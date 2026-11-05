export interface UiRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ButtonKind = 'primary' | 'secondary' | 'ghost';

export interface DemoButton {
  id: string;
  label: string;
  rect: UiRect;
  kind?: ButtonKind;
}

export const COLORS = {
  bgTop: '#111a2d',
  bgBottom: '#070b13',
  ink: '#eef3ff',
  muted: '#9aa8c4',
  dim: '#6d7c99',
  gold: '#ffcf7a',
  goldInk: '#241a08',
  green: '#6ee7a8',
  red: '#ff8c8c',
  panel: 'rgba(10, 16, 28, 0.82)',
  panelLine: 'rgba(255,255,255,0.14)',
  cameraShade: 'rgba(4, 8, 16, 0.38)',
} as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * clamp(t, 0, 1);
}

export function hitRect(rect: UiRect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function findButton(
  buttons: readonly DemoButton[],
  x: number,
  y: number,
): DemoButton | null {
  for (const button of buttons) {
    if (hitRect(button.rect, x, y)) return button;
  }
  return null;
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function drawButton(ctx: CanvasRenderingContext2D, button: DemoButton): void {
  const { rect } = button;
  const kind = button.kind ?? 'secondary';
  ctx.save();
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);
  if (kind === 'primary') {
    ctx.fillStyle = COLORS.gold;
  } else if (kind === 'ghost') {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
  }
  ctx.fill();
  ctx.strokeStyle = kind === 'primary' ? 'rgba(255,255,255,0.3)' : COLORS.panelLine;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = kind === 'primary' ? COLORS.goldInk : COLORS.ink;
  ctx.font = kind === 'primary' ? 'bold 19px sans-serif' : 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(button.label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
  ctx.restore();
}

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  rect: UiRect,
  radius = 20,
): void {
  ctx.save();
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.strokeStyle = COLORS.panelLine;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

export function drawBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, COLORS.bgTop);
  gradient.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = 'rgba(246,178,107,0.22)';
  ctx.beginPath();
  ctx.arc(width * 0.18, height * 0.2, width * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(110,231,168,0.12)';
  ctx.beginPath();
  ctx.arc(width * 0.86, height * 0.32, width * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const char of paragraph) {
      const test = line + char;
      if (line.length > 0 && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = char;
      } else {
        line = test;
      }
    }
    if (line.length > 0) lines.push(line);
  }
  return lines;
}

export function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 100,
): number {
  const lines = wrapText(ctx, text, maxWidth).slice(0, maxLines);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
}

export function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font = '16px sans-serif',
  color: string = COLORS.ink,
): void {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function drawDebugHud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lines: readonly string[],
): void {
  if (lines.length === 0) return;
  ctx.save();
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const width = Math.max(...lines.map((line) => ctx.measureText(line).width)) + 16;
  const height = lines.length * 16 + 12;
  roundRect(ctx, x - 6, y - 6, width, height, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  ctx.fillStyle = '#c7ffd8';
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * 16));
  ctx.restore();
}

export function drawProgressBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  progress: number,
  color: string = COLORS.gold,
): void {
  const value = clamp(progress, 0, 1);
  ctx.save();
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fill();
  if (value > 0) {
    roundRect(ctx, x, y, Math.max(height, width * value), height, height / 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}

export function fmt(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return value.toFixed(digits);
}
