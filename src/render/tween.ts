export type Easing = 'linear' | 'easeInQuad';

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * clamp01(t);
}

export function easeInQuad(t: number): number {
  const value = clamp01(t);
  return value * value;
}

export class Tween {
  private elapsed = 0;
  private finished = false;

  constructor(
    public from: number,
    public to: number,
    public durationMs: number,
    public easing: Easing = 'linear',
  ) {}

  reset(): void {
    this.elapsed = 0;
    this.finished = false;
  }

  update(dtMs: number): number {
    if (this.finished) return this.to;
    this.elapsed += dtMs;
    const t = this.durationMs <= 0 ? 1 : clamp01(this.elapsed / this.durationMs);
    if (t >= 1) this.finished = true;
    return lerp(this.from, this.to, this.easing === 'easeInQuad' ? easeInQuad(t) : t);
  }

  get value(): number {
    return this.update(0);
  }

  get done(): boolean {
    return this.finished;
  }
}
