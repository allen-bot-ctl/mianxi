import type { Tunables } from '../config';
import {
  createViewTransform,
  drawVideoCover,
  evaluateFaceValidity,
  measureMouth,
  type FaceValidity,
  type MouthMeasurement,
  type ViewTransform,
} from '../core/signal';
import { DebugOverlay } from '../debug';
import type { CameraSource, FaceSource, Storage, VideoLike } from '../platform';
import { safeGetTT } from '../platform/douyin';
import { TelemetryEvents, type Telemetry } from '../telemetry';
import type { FaceFrame } from '../types';
import type { Scene, SceneId } from './Scene';

type BeautifyMode = 'natural' | 'minimum' | 'probeHigh';
type ButtonId = 'beautify' | 'detectN' | 'triggerSource' | 'export';

interface Button {
  id: ButtonId;
  label: string;
}

interface RectLike {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ProbeLogRow {
  t: number;
  found: number;
  score: number;
  bboxW: number;
  bboxH: number;
  yaw: number;
  pitch: number;
  roll: number;
  rRaw: number | null;
  o: number | null;
  valid: number;
  reason: string;
  detectMs: number;
  beautify: BeautifyMode;
  detectN: number;
}

export interface ProbeSceneDeps {
  canvasWidth: number;
  canvasHeight: number;
  camera: CameraSource;
  faceSource: FaceSource;
  storage: Storage;
  telemetry?: Telemetry;
  config: Tunables;
}

/**
 * 交接 §12 的隐藏探针骨架：
 * 相机上屏、每 N 帧检测、20 点编号、r_raw/o/detectHz、美颜三档、数值日志导出。
 * 无 tt 时用 MockCameraSource / MockFaceSource 跑通场景与 HUD，但不绘制假相机画面。
 */
export class ProbeScene implements Scene {
  readonly id: SceneId = 'PROBE';

  private readonly debug = new DebugOverlay();
  private readonly beautifyOrder: BeautifyMode[] = ['natural', 'minimum', 'probeHigh'];
  private beautifyMode: BeautifyMode;
  private detectNIndex = 0;
  private startPromise: Promise<void> | null = null;
  private ready = false;
  private startError: string | null = null;
  private video: VideoLike | null = null;
  private view: ViewTransform | null = null;

  private frameCount = 0;
  private inFlight = false;
  private startedAt = 0;
  private elapsedMs = 0;
  private lastFrame: FaceFrame | null = null;
  private lastMeasurement: MouthMeasurement | null = null;
  private lastValidity: FaceValidity | null = null;
  private lastDetectMs = 0;
  private detectTimestamps: number[] = [];
  private logRows: ProbeLogRow[] = [];
  private lastExport = '';

  constructor(private readonly deps: ProbeSceneDeps) {
    this.beautifyMode = deps.config.beautify.default as BeautifyMode;
    const defaultN = deps.config.sampling.DETECT_EVERY_N_FRAMES;
    const found = deps.config.probe.detectNValues.indexOf(defaultN);
    this.detectNIndex = found >= 0 ? found : 0;
  }

  enter(): void {
    void this.start();
  }

  exit(): void {
    this.deps.camera.stop();
    this.deps.faceSource.stop();
    this.ready = false;
  }

  start(): Promise<void> {
    if (this.startPromise) return this.startPromise;
    this.startedAt = this.now();
    this.startPromise = this.doStart();
    return this.startPromise;
  }

  private async doStart(): Promise<void> {
    try {
      this.video = await this.deps.camera.start();
      this.deps.faceSource.start();
      this.deps.camera.setBeautifyParam(this.beautifyValues());
      this.view = this.buildView();
      this.ready = true;
      this.startError = null;
    } catch (error) {
      this.ready = false;
      this.startError = error instanceof Error ? error.message : String(error);
      console.warn('[Probe] camera start failed:', this.startError);
    }
  }

  update(dtMs: number): void {
    if (!this.ready) return;
    this.elapsedMs += dtMs;
    this.frameCount += 1;

    const detectN = this.currentDetectN();
    if (this.frameCount % detectN === 0 && !this.inFlight) {
      void this.detectOnce();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { canvasWidth: width, canvasHeight: height } = this.deps;
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    const hasRealVideo = !this.deps.camera.isMock && !!this.video && !!this.view;
    if (hasRealVideo && this.view) {
      drawVideoCover(ctx, this.video, this.view);
    } else {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, width - 20, height - 20);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('MOCK — no camera image', width / 2, height * 0.2);
      ctx.font = '13px sans-serif';
      ctx.fillText('无 tt / 假相机：只跑 HUD 与数值日志', width / 2, height * 0.2 + 24);
    }

    if (this.lastFrame) {
      this.debug.drawMouthPoints(ctx, this.lastFrame);
      this.debug.drawNumbers(ctx, this.lastFrame, {
        rRaw: this.lastMeasurement?.rRaw,
        o: this.lastMeasurement?.o,
        detectHz: this.detectHz(),
        valid: this.lastValidity?.valid,
        reason: this.lastValidity?.reason,
      });
    } else {
      this.debug.drawNumbers(ctx, null, { detectHz: this.detectHz() });
    }

    this.drawStatus(ctx);
    this.drawButtons(ctx);

    if (this.startError) {
      ctx.save();
      ctx.fillStyle = '#ff6b6b';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`camera error: ${this.startError}`, width / 2, height * 0.32);
      ctx.restore();
    }

    ctx.restore();
  }

  tap(x: number, y: number): void {
    const buttons = this.buttons();
    const rects = this.buttonRects();
    for (let index = 0; index < buttons.length; index += 1) {
      const rect = rects[index]!;
      if (inside(x, y, rect)) {
        this.onButton(buttons[index]!.id);
        return;
      }
    }
  }

  getLogJson(): string {
    return JSON.stringify(
      {
        schema: 'mianxi_probe_log_v1',
        exportedAt: new Date().toISOString(),
        premirrored: this.deps.config.view.VIDEO_PREMIRRORED,
        beautify: this.beautifyMode,
        detectN: this.currentDetectN(),
        rows: this.logRows,
      },
      null,
      2,
    );
  }

  get rows(): readonly ProbeLogRow[] {
    return this.logRows;
  }

  private async detectOnce(): Promise<void> {
    this.inFlight = true;
    const tCall = this.now();
    const started = this.now();
    const view = this.buildView();
    try {
      const frame = await this.deps.faceSource.detect(this.video, view, tCall);
      const measuredAt = this.now();
      const calibration = this.calibration();
      const measurement = measureMouth(frame.mouth, calibration);
      const validity = evaluateFaceValidity(
        frame,
        this.deps.canvasWidth,
        this.deps.config.face,
      );

      this.lastFrame = frame;
      this.lastMeasurement = measurement;
      this.lastValidity = validity;
      this.lastDetectMs = measuredAt - started;
      this.detectTimestamps.push(measuredAt);
      this.pruneDetectTimestamps(measuredAt);

      this.logRows.push({
        t: frame.t,
        found: frame.found ? 1 : 0,
        score: frame.score,
        bboxW: frame.bbox.w,
        bboxH: frame.bbox.h,
        yaw: frame.yaw,
        pitch: frame.pitch,
        roll: frame.roll,
        rRaw: measurement.rRaw,
        o: measurement.o,
        valid: validity.valid ? 1 : 0,
        reason: validity.reason ?? '',
        detectMs: this.lastDetectMs,
        beautify: this.beautifyMode,
        detectN: this.currentDetectN(),
      });

      const maxRows = this.deps.config.probe.maxLogRows;
      if (this.logRows.length > maxRows) {
        this.logRows.splice(0, this.logRows.length - maxRows);
      }
    } catch (error) {
      console.warn('[Probe] detect failed', error);
    } finally {
      this.inFlight = false;
    }
  }

  private calibration(): { base: number; peak: number } {
    const stored = this.deps.storage.get<{ base?: number; peak?: number } | null>(
      this.deps.config.storage.keys.calibration,
      null,
    );
    if (
      stored &&
      Number.isFinite(stored.base) &&
      Number.isFinite(stored.peak) &&
      Number(stored.peak) > Number(stored.base)
    ) {
      return { base: Number(stored.base), peak: Number(stored.peak) };
    }
    return {
      base: this.deps.config.calibration.defaultBase,
      peak: this.deps.config.calibration.defaultPeak,
    };
  }

  private buildView(): ViewTransform {
    const videoWidth = this.video?.videoWidth ?? this.video?.width ?? 540;
    const videoHeight = this.video?.videoHeight ?? this.video?.height ?? 960;
    return createViewTransform(
      videoWidth,
      videoHeight,
      this.deps.canvasWidth,
      this.deps.canvasHeight,
      this.deps.config.view.VIDEO_PREMIRRORED,
    );
  }

  private currentDetectN(): number {
    return this.deps.config.probe.detectNValues[this.detectNIndex] ?? 3;
  }

  private detectHz(): number {
    const now = this.now();
    this.pruneDetectTimestamps(now);
    const windowMs = this.deps.config.sampling.detectRateWindowMs;
    return windowMs > 0 ? (this.detectTimestamps.length * 1000) / windowMs : 0;
  }

  private pruneDetectTimestamps(now: number): void {
    const windowMs = this.deps.config.sampling.detectRateWindowMs;
    while (
      this.detectTimestamps.length > 0 &&
      now - this.detectTimestamps[0]! > windowMs
    ) {
      this.detectTimestamps.shift();
    }
  }

  private onButton(id: ButtonId): void {
    if (id === 'beautify') {
      const index = this.beautifyOrder.indexOf(this.beautifyMode);
      this.beautifyMode = this.beautifyOrder[(index + 1) % this.beautifyOrder.length]!;
      this.deps.camera.setBeautifyParam(this.beautifyValues());
      return;
    }
    if (id === 'detectN') {
      const values = this.deps.config.probe.detectNValues;
      this.detectNIndex = (this.detectNIndex + 1) % Math.max(1, values.length);
      return;
    }
    if (id === 'triggerSource') {
      this.debug.cycleTriggerSource();
      return;
    }
    this.exportLog();
  }

  private beautifyValues(): number[] {
    return this.deps.config.beautify[this.beautifyMode];
  }

  private exportLog(): void {
    const json = this.getLogJson();
    this.deps.storage.set(this.deps.config.probe.exportKey, json);
    const tt = safeGetTT();
    try {
      tt?.setClipboardData?.({ data: json });
    } catch {
      // 剪贴板不可用时仍有本地存储
    }
    this.lastExport = `已导出 ${this.logRows.length} 行（存储${tt ? '+剪贴板' : ''}）`;
    this.deps.telemetry?.emit(TelemetryEvents.detectRate, {
      hz: Number(this.detectHz().toFixed(2)),
    });
  }

  private drawStatus(ctx: CanvasRenderingContext2D): void {
    const width = this.deps.canvasWidth;
    const height = this.deps.canvasHeight;
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    const lines = [
      `N=${this.currentDetectN()} frames=${this.frameCount}`,
      `detectMs=${this.lastDetectMs.toFixed(1)}`,
      `rows=${this.logRows.length}`,
      `beautify=${this.beautifyMode}`,
      `source=${this.debug.triggerSource}`,
    ];
    const boxHeight = lines.length * 16 + 12;
    ctx.fillRect(width - 178, 6, 172, boxHeight);
    ctx.fillStyle = '#d7ffd7';
    lines.forEach((line, index) => ctx.fillText(line, width - 14, 12 + index * 16));

    if (this.lastExport) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#9ae6b4';
      ctx.fillText(this.lastExport, width / 2, height - 96);
    }
    ctx.restore();
  }

  private drawButtons(ctx: CanvasRenderingContext2D): void {
    const buttons = this.buttons();
    const rects = this.buttonRects();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '12px sans-serif';
    buttons.forEach((button, index) => {
      const rect = rects[index]!;
      ctx.fillStyle = 'rgba(30,41,59,0.9)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = '#64748b';
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(button.label, rect.x + rect.w / 2, rect.y + rect.h / 2);
    });
    ctx.restore();
  }

  private buttons(): Button[] {
    return [
      { id: 'beautify', label: `美颜:${beautifyLabel(this.beautifyMode)}` },
      { id: 'detectN', label: `N:${this.currentDetectN()}` },
      { id: 'triggerSource', label: `源:${sourceLabel(this.debug.triggerSource)}` },
      { id: 'export', label: '导出日志' },
    ];
  }

  private buttonRects(): RectLike[] {
    const width = this.deps.canvasWidth;
    const height = this.deps.canvasHeight;
    const gap = 6;
    const margin = 8;
    const buttonWidth = (width - margin * 2 - gap * 3) / 4;
    const buttonHeight = 40;
    const y = height - buttonHeight - 16;
    return this.buttons().map((_button, index) => ({
      x: margin + index * (buttonWidth + gap),
      y,
      w: buttonWidth,
      h: buttonHeight,
    }));
  }

  private now(): number {
    return this.startedAt + this.elapsedMs;
  }
}

function inside(x: number, y: number, rect: RectLike): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function beautifyLabel(mode: BeautifyMode): string {
  return mode === 'natural' ? '自然' : mode === 'minimum' ? '最低' : '高';
}

function sourceLabel(source: string): string {
  return source === 'mouth' ? '嘴' : source === 'pitch' ? '点头' : '点击';
}
