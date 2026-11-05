import type { Recorder, RecordingStartOptions } from '../types';
import { getTT } from './runtime';

/** tt.getGameRecorderManager 的薄封装；回调在 start 前绑定即可。 */
export class DouyinRecorder implements Recorder {
  private manager: any = null;
  private startCallback: (() => void) | null = null;
  private stopCallback: ((videoPath: string) => void) | null = null;
  private errorCallback: ((error: unknown) => void) | null = null;
  private interruptionBeginCallback: (() => void) | null = null;
  private interruptionEndCallback: (() => void) | null = null;

  private ensureManager(): any {
    if (this.manager) return this.manager;
    const tt = getTT();
    this.manager = tt.getGameRecorderManager();
    this.manager.onStart?.(() => this.startCallback?.());
    this.manager.onStop?.((result: any) => this.stopCallback?.(result?.videoPath ?? ''));
    this.manager.onError?.((error: unknown) => this.errorCallback?.(error));
    this.manager.onInterruptionBegin?.(() => this.interruptionBeginCallback?.());
    this.manager.onInterruptionEnd?.(() => this.interruptionEndCallback?.());
    return this.manager;
  }

  onStart(callback: () => void): void {
    this.startCallback = callback;
  }

  onStop(callback: (videoPath: string) => void): void {
    this.stopCallback = callback;
  }

  onError(callback: (error: unknown) => void): void {
    this.errorCallback = callback;
  }

  onInterruptionBegin(callback: () => void): void {
    this.interruptionBeginCallback = callback;
  }

  onInterruptionEnd(callback: () => void): void {
    this.interruptionEndCallback = callback;
  }

  start(options: RecordingStartOptions): void {
    const manager = this.ensureManager();
    manager.start?.({
      duration: options.durationS,
      isMarkOpen: options.isMarkOpen,
      frameRate: options.frameRate,
      locLeft: options.locLeft ?? 0,
      locTop: options.locTop ?? 0,
    });
  }

  stop(): void {
    this.manager?.stop?.();
  }

  pause(): void {
    this.manager?.pause?.();
  }

  resume(): void {
    this.manager?.resume?.();
  }

  getMark(): { width: number; height: number; locLeft: number; locTop: number } | null {
    try {
      const mark = this.ensureManager().getMark?.();
      return mark ?? null;
    } catch {
      return null;
    }
  }
}
