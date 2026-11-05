import type { FaceFrame } from '../types';

export type DebugTriggerSource = 'mouth' | 'pitch' | 'tap';

export interface DebugNumbers {
  rRaw?: number | null;
  o?: number | null;
  detectHz?: number;
  valid?: boolean;
  reason?: string;
}

/** 只在调试版/探针启用；正式版不要创建。 */
export class DebugOverlay {
  enabled = true;
  showMouthPoints = true;
  triggerSource: DebugTriggerSource = 'mouth';

  cycleTriggerSource(): DebugTriggerSource {
    this.triggerSource =
      this.triggerSource === 'mouth'
        ? 'pitch'
        : this.triggerSource === 'pitch'
          ? 'tap'
          : 'mouth';
    return this.triggerSource;
  }

  drawMouthPoints(ctx: CanvasRenderingContext2D, frame: FaceFrame): void {
    if (!this.enabled || !this.showMouthPoints || !frame.found || frame.mouth.length === 0) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = '#00e5ff';
    ctx.fillStyle = '#00e5ff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (let index = 0; index < frame.mouth.length; index += 1) {
      const point = frame.mouth[index]!;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(String(index), point.x + 4, point.y - 4);
    }
    ctx.restore();
  }

  drawNumbers(
    ctx: CanvasRenderingContext2D,
    frame: FaceFrame | null,
    numbers: DebugNumbers,
    x = 12,
    y = 12,
  ): void {
    if (!this.enabled) return;
    const lines = [
      'PROBE / DEBUG',
      `found=${frame?.found ? 1 : 0} score=${fmt(frame?.score)}`,
      `yaw=${fmt(frame?.yaw)} pitch=${fmt(frame?.pitch)} roll=${fmt(frame?.roll)}`,
      `bbox=${frame ? `${fmt(frame.bbox.x)},${fmt(frame.bbox.y)},${fmt(frame.bbox.w)},${fmt(frame.bbox.h)}` : '-'}`,
      `r_raw=${fmt(numbers.rRaw)} o=${fmt(numbers.o)}`,
      `valid=${numbers.valid ? 1 : 0}${numbers.reason ? ` (${numbers.reason})` : ''}`,
      `detectHz=${fmt(numbers.detectHz, 1)}`,
      `trigger=${this.triggerSource}`,
    ];

    ctx.save();
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const width = Math.max(...lines.map((line) => ctx.measureText(line).width)) + 16;
    const height = lines.length * 16 + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(x - 6, y - 6, width, height);
    ctx.fillStyle = '#d7ffd7';
    lines.forEach((line, index) => ctx.fillText(line, x, y + index * 16));
    ctx.restore();
  }
}

function fmt(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return value.toFixed(digits);
}
