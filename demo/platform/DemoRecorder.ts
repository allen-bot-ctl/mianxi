import type { Recorder, RecordingStartOptions } from '../../src/platform';

/**
 * MediaRecorder 录 canvas.captureStream()。
 * 失败不阻塞游戏：结果页会提示「本浏览器未录上」，仍然可以再来一局。
 */
export class DemoRecorder implements Recorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: BlobPart[] = [];
  private blob: Blob | null = null;
  private url: string | null = null;
  private mimeType = '';
  private recording = false;
  private paused = false;
  private failed = false;
  private errorMessage: string | null = null;
  private startNotified = false;
  private stopNotified = false;
  private durationTimer: number | null = null;
  private startTimeout: number | null = null;

  private startCallback: (() => void) | null = null;
  private stopCallback: ((videoPath: string) => void) | null = null;
  private errorCallback: ((error: unknown) => void) | null = null;
  private interruptionBeginCallback: (() => void) | null = null;
  private interruptionEndCallback: (() => void) | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {}

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
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') return;

    this.releaseUrl();
    this.chunks = [];
    this.blob = null;
    this.failed = false;
    this.errorMessage = null;
    this.paused = false;
    this.recording = false;
    this.startNotified = false;
    this.stopNotified = false;

    try {
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('本浏览器未录上：不支持 MediaRecorder。');
      }
      const capture = (this.canvas as any).captureStream;
      if (typeof capture !== 'function') {
        throw new Error('本浏览器未录上：不支持 canvas.captureStream()。');
      }

      this.stream = capture.call(this.canvas, options.frameRate ?? 30) as MediaStream;
      this.mimeType = pickMimeType();
      this.mediaRecorder = this.mimeType
        ? new MediaRecorder(this.stream, {
            mimeType: this.mimeType,
            videoBitsPerSecond: 4_000_000,
          })
        : new MediaRecorder(this.stream, { videoBitsPerSecond: 4_000_000 });

      this.mediaRecorder.ondataavailable = (event: BlobEvent): void => {
        if (event.data && event.data.size > 0) this.chunks.push(event.data);
      };
      this.mediaRecorder.onstart = (): void => {
        this.recording = true;
        this.notifyStart();
      };
      this.mediaRecorder.onstop = (): void => {
        this.recording = false;
        this.paused = false;
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;

        if (this.chunks.length > 0) {
          this.blob = new Blob(this.chunks, {
            type: this.mimeType || this.mediaRecorder?.mimeType || 'video/webm',
          });
          this.url = URL.createObjectURL(this.blob);
        } else {
          this.failed = true;
          this.errorMessage = this.errorMessage ?? '本浏览器未录上：录屏没有产生数据。';
        }
        this.notifyStop();
      };
      this.mediaRecorder.onerror = (event: Event): void => {
        this.fail(event);
      };

      this.mediaRecorder.start(1000);
      // Safari/部分实现 onstart 可能迟迟不来；兜底放行倒计时。
      this.startTimeout = window.setTimeout(() => {
        if (!this.startNotified) {
          this.recording = true;
          this.notifyStart();
        }
      }, 700);
      this.durationTimer = window.setTimeout(
        () => this.stop(),
        Math.max(1, options.durationS) * 1000,
      );
    } catch (error) {
      this.fail(error);
      // 录制失败也必须让流程继续。
      this.notifyStart();
      this.notifyStop();
    }
  }

  stop(): void {
    this.clearTimers();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (error) {
        this.fail(error);
        this.notifyStop();
      }
      return;
    }
    if (!this.stopNotified) this.notifyStop();
  }

  pause(): void {
    if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') return;
    try {
      this.mediaRecorder.pause();
      this.paused = true;
    } catch {
      // ignore
    }
  }

  resume(): void {
    if (!this.mediaRecorder || this.mediaRecorder.state !== 'paused') return;
    try {
      this.mediaRecorder.resume();
      this.paused = false;
    } catch {
      // ignore
    }
  }

  getMark(): { width: number; height: number; locLeft: number; locTop: number } | null {
    return null;
  }

  getUrl(): string | null {
    return this.url;
  }

  getBlob(): Blob | null {
    return this.blob;
  }

  getError(): string | null {
    return this.errorMessage;
  }

  get failedRecording(): boolean {
    return this.failed;
  }

  get isRecording(): boolean {
    return this.recording;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  onInterruptionBeginNow(): void {
    this.interruptionBeginCallback?.();
  }

  onInterruptionEndNow(): void {
    this.interruptionEndCallback?.();
  }

  dispose(): void {
    this.clearTimers();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.releaseUrl();
  }

  private fail(error: unknown): void {
    this.failed = true;
    const detail = error instanceof Error ? error.message : 'MediaRecorder 失败。';
    this.errorMessage = detail.startsWith('本浏览器未录上')
      ? detail
      : `本浏览器未录上：${detail}`;
    this.errorCallback?.(error);
  }

  private notifyStart(): void {
    if (this.startTimeout !== null) {
      window.clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
    if (this.startNotified) return;
    this.startNotified = true;
    this.startCallback?.();
  }

  private notifyStop(): void {
    if (this.stopNotified) return;
    this.stopNotified = true;
    this.stopCallback?.(this.url ?? '');
  }

  private clearTimers(): void {
    if (this.durationTimer !== null) {
      window.clearTimeout(this.durationTimer);
      this.durationTimer = null;
    }
    if (this.startTimeout !== null) {
      window.clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
  }

  private releaseUrl(): void {
    if (this.url) {
      URL.revokeObjectURL(this.url);
      this.url = null;
    }
  }
}

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}
