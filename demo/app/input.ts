/** demo 的合成嘴输入：按住 ↑/W/鼠标 = 张嘴；Space/点击 = 注入一次「吼」脉冲。 */
export class DemoInput {
  private readonly heldKeys = new Set<string>();
  private pointerHeld = false;
  private pulseUntil = 0;

  setKey(code: string, down: boolean): void {
    if (down) this.heldKeys.add(code);
    else this.heldKeys.delete(code);
  }

  setPointerHeld(down: boolean): void {
    this.pointerHeld = down;
  }

  /** 注入一次约 220ms 的「吼」；IntentEngine 会按 ROAR_HOLD_MS/MIN_SAMPLES 确认。 */
  pulse(now: number, durationMs = 220): void {
    this.pulseUntil = Math.max(this.pulseUntil, now + durationMs);
  }

  levelAt(now: number): number {
    if (now < this.pulseUntil) return 1;
    if (this.pointerHeld || this.heldKeys.size > 0) return 1;
    return 0;
  }

  get holding(): boolean {
    return this.pointerHeld || this.heldKeys.size > 0;
  }

  reset(): void {
    this.heldKeys.clear();
    this.pointerHeld = false;
    this.pulseUntil = 0;
  }
}
