import type { SceneId } from '../../src/flow';
import {
  computeCalibration,
  defaultCalibration,
  mouthRatio,
  normalizeOpenness,
  type CalibrationResult,
} from '../../src/core/signal';
import { drawRoarBurst } from '../../src/game/houtui';
import { TelemetryEvents } from '../../src/telemetry';
import type { FaceFrame } from '../../src/types';
import type { DemoContext } from '../app/context';
import type { DemoScene } from '../app/Scene';
import {
  COLORS,
  drawButton,
  drawCenteredText,
  drawDebugHud,
  drawPanel,
  drawProgressBar,
  drawWrappedText,
  findButton,
  fmt,
  type DemoButton,
} from '../app/canvas';
import { buildView, drawCameraLayer, drawCameraPlaceholder, drawFaceOverlay } from '../app/live';
import { readSkinMode, writeCalibration } from '../app/persistence';

type Phase = 'closed' | 'open' | 'success' | 'retry';

export class CalibrationScene implements DemoScene {
  readonly id: SceneId = 'S4';
  private phase: Phase = 'closed';
  private phaseElapsed = 0;
  private retryTimer = 0;
  private successTimer = 0;
  private closedSamples: number[] = [];
  private openSamples: number[] = [];
  private result: CalibrationResult | null = null;
  private retryReason = '';
  private starting = false;
  private ready = false;
  private error: string | null = null;
  private inFlight = false;
  private lastFrame: FaceFrame | null = null;
  private lastRaw: number | null = null;
  private lastLevel = 0;
  private buttons: DemoButton[] = [];
  private grantedEmitted = false;

  constructor(private readonly ctx: DemoContext) {}

  enter(): void {
    this.phase = 'closed';
    this.phaseElapsed = 0;
    this.retryTimer = 0;
    this.successTimer = 0;
    this.closedSamples = [];
    this.openSamples = [];
    this.result = null;
    this.retryReason = '';
    this.starting = false;
    this.ready = false;
    this.error = null;
    this.inFlight = false;
    this.lastFrame = null;
    this.lastRaw = null;
    this.lastLevel = 0;
    this.buttons = [];
    this.ctx.input.reset();
    void this.startCamera();
  }

  exit(): void {
    this.ctx.input.reset();
  }

  update(dtMs: number): void {
    if (this.error || this.starting || !this.ready) return;

    if (this.phase === 'retry') {
      this.retryTimer -= dtMs;
      if (this.retryTimer <= 0) {
        this.closedSamples = [];
        this.openSamples = [];
        this.result = null;
        this.phase = 'closed';
        this.phaseElapsed = 0;
      }
      return;
    }

    if (this.phase === 'success') {
      this.successTimer -= dtMs;
      if (this.successTimer <= 0) this.goNext();
      return;
    }

    const now = performance.now();
    const requestedPhase = this.phase;
    this.sampleOnce(now, requestedPhase);

    this.phaseElapsed += dtMs;
    if (this.phase === 'closed' && this.phaseElapsed >= this.ctx.config.calibration.baseWindowMs) {
      this.phase = 'open';
      this.phaseElapsed = 0;
      return;
    }
    if (this.phase === 'open' && this.phaseElapsed >= this.ctx.config.calibration.peakWindowMs) {
      this.finishCalibration();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const width = this.ctx.width;
    const height = this.ctx.height;

    if (this.ctx.camera.getVideo()) {
      drawCameraLayer(ctx, this.ctx.camera, this.ctx.config, width, height);
      ctx.fillStyle = COLORS.cameraShade;
      ctx.fillRect(0, 0, width, height);
    } else {
      drawCameraPlaceholder(ctx, width, height, this.starting ? '正在打开摄像头…' : '没有摄像头画面');
    }

    drawFaceOverlay(ctx, this.ctx.faceSource, width, height, {
      showMouthPoints: true,
      bboxColor: 'rgba(94,234,212,0.9)',
      label: 'demo-synth mouth',
    });

    drawCenteredText(
      ctx,
      '校准与教学',
      width / 2,
      34,
      `bold ${Math.round(Math.min(width * 0.06, 26))}px sans-serif`,
      COLORS.ink,
    );

    if (this.error) {
      this.drawError(ctx);
    } else {
      this.drawPhase(ctx);
    }

    const def = defaultCalibration(this.ctx.config.calibration);
    const o = this.lastRaw === null ? null : normalizeOpenness(this.lastRaw, def);
    drawDebugHud(ctx, 14, height - 118, [
      'source=demo-synth',
      `phase=${this.phase} level=${fmt(this.lastLevel, 2)}`,
      `r_raw=${fmt(this.lastRaw, 3)} o(def)=${fmt(o, 2)}`,
      `samples closed=${this.closedSamples.length} open=${this.openSamples.length}`,
    ]);

    this.buttons = [];
    if (this.error) {
      const buttonWidth = width * 0.82;
      const x = (width - buttonWidth) / 2;
      const y = height * 0.58;
      this.buttons = [
        { id: 'retry', label: '重试授权', rect: { x, y, w: buttonWidth, h: 52 }, kind: 'primary' },
        { id: 'fallback', label: '使用占位画面（仅 demo）', rect: { x, y: y + 66, w: buttonWidth, h: 46 }, kind: 'ghost' },
        { id: 'home', label: '返回首页', rect: { x: x + buttonWidth * 0.2, y: y + 126, w: buttonWidth * 0.6, h: 42 }, kind: 'ghost' },
      ];
      for (const button of this.buttons) drawButton(ctx, button);
    }
  }

  onPointerDown(x: number, y: number): void {
    const button = findButton(this.buttons, x, y);
    if (button) {
      this.handleButton(button.id);
      return;
    }
    if (this.error) return;
    this.ctx.input.setPointerHeld(true);
  }

  onPointerUp(_x: number, _y: number): void {
    this.ctx.input.setPointerHeld(false);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.code === 'ArrowUp' || event.code === 'Space' || event.code === 'KeyW') {
      event.preventDefault();
      this.ctx.input.setKey(event.code, true);
    }
  }

  onKeyUp(event: KeyboardEvent): void {
    this.ctx.input.setKey(event.code, false);
  }

  tap(x: number, y: number): void {
    this.onPointerDown(x, y);
  }

  private sampleOnce(now: number, requestedPhase: Phase): void {
    if (this.inFlight) return;
    const video = this.ctx.camera.getVideo();
    const view = buildView(this.ctx.camera, this.ctx.config, this.ctx.width, this.ctx.height);
    if (!video || !view) return;

    const level = this.ctx.input.levelAt(now);
    this.lastLevel = level;
    this.ctx.faceSource.setMouthLevel(level);
    this.inFlight = true;
    void this.ctx.faceSource
      .detect(video, view, now)
      .then((frame) => {
        if (this.ctx.flow.current !== 'S4' || this.phase !== requestedPhase) return;
        const raw = mouthRatio(frame.mouth);
        this.lastFrame = frame;
        this.lastRaw = raw;
        if (raw === null) return;
        if (requestedPhase === 'closed') this.closedSamples.push(raw);
        else this.openSamples.push(raw);
      })
      .finally(() => {
        this.inFlight = false;
      });
  }

  private finishCalibration(): void {
    const result = computeCalibration(
      this.closedSamples,
      this.openSamples,
      this.ctx.config.calibration.minDelta,
      this.ctx.config.calibration.peakPercentile,
    );
    this.result = result;

    if (result.valid) {
      writeCalibration(this.ctx.storage, this.ctx.config, {
        base: result.base,
        peak: result.peak,
      });
      this.ctx.telemetry.emit(TelemetryEvents.calibDone, {
        base: Number(result.base.toFixed(4)),
        peak: Number(result.peak.toFixed(4)),
      });
      this.phase = 'success';
      this.successTimer = 1000;
      return;
    }

    this.phase = 'retry';
    this.retryTimer = 1500;
    this.retryReason =
      result.delta < this.ctx.config.calibration.minDelta
        ? '再张大一点'
        : '再试一次';
  }

  private goNext(): void {
    // startCamera 时已经把 flags.calibrationReturn 记到 returnToSettings。
    // 这里先清掉标志，避免下次从首页进入时还带着 settings 语义。
    this.ctx.flags.calibrationReturn = 'play';
    const fromSettings = this.returnToSettings;
    this.returnToSettings = false;
    if (fromSettings) {
      this.ctx.goTo('S9');
      return;
    }
    this.ctx.flags.afterCalibration = true;
    this.ctx.flags.faceCheckNext = 'S5';
    this.ctx.goTo('S3');
  }

  private returnToSettings = false;

  private async startCamera(): Promise<void> {
    if (this.starting) return;
    this.returnToSettings = this.ctx.flags.calibrationReturn === 'settings';
    if (this.ctx.camera.getVideo()) {
      this.ctx.faceSource.start();
      this.applySkin();
      this.ready = true;
      if (!this.grantedEmitted && !this.ctx.camera.usingFallback) {
        this.grantedEmitted = true;
        this.ctx.telemetry.emit(TelemetryEvents.cameraGranted);
      }
      return;
    }

    this.starting = true;
    this.error = null;
    try {
      await this.ctx.camera.start();
      this.ctx.faceSource.start();
      this.applySkin();
      this.ready = true;
      if (!this.ctx.camera.usingFallback && !this.grantedEmitted) {
        this.grantedEmitted = true;
        this.ctx.telemetry.emit(TelemetryEvents.cameraGranted);
      }
    } catch (error) {
      this.ready = false;
      this.error = this.ctx.camera.errorMessage ?? (error instanceof Error ? error.message : String(error));
      this.ctx.telemetry.emit(TelemetryEvents.cameraDenied, { reason: this.error.slice(0, 40) });
    } finally {
      this.starting = false;
    }
  }

  private applySkin(): void {
    const mode = readSkinMode(this.ctx.storage, this.ctx.config);
    this.ctx.camera.setBeautifyParam(this.ctx.config.beautify[mode]);
  }

  private drawPhase(ctx: CanvasRenderingContext2D): void {
    const width = this.ctx.width;
    const height = this.ctx.height;
    const panel = {
      x: width * 0.08,
      y: height * 0.1,
      w: width * 0.84,
      h: height * 0.3,
    };
    drawPanel(ctx, panel);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    let title = '';
    let detail = '';
    let progress = 0;
    let color: string = COLORS.gold;

    if (this.phase === 'closed') {
      title = '先闭上嘴';
      detail = '保持 1 秒 · 松开鼠标/按键';
      progress = this.phaseElapsed / Math.max(1, this.ctx.config.calibration.baseWindowMs);
    } else if (this.phase === 'open') {
      title = '张大嘴吼一下！';
      detail = '按住 ↑ / 空格 / 鼠标 1.5 秒';
      progress = this.phaseElapsed / Math.max(1, this.ctx.config.calibration.peakWindowMs);
      color = COLORS.green;
    } else if (this.phase === 'success') {
      title = '校准完成！';
      detail = '扑扑被吼退了 · 马上开始';
      progress = 1;
      color = COLORS.green;
    } else {
      title = this.retryReason || '再试一次';
      detail = '重新闭嘴，再张大一点';
      progress = 0;
      color = COLORS.red;
    }

    ctx.fillStyle = color;
    ctx.font = `bold ${Math.round(Math.min(width * 0.06, 25))}px sans-serif`;
    ctx.fillText(title, width / 2, panel.y + 22);

    ctx.fillStyle = COLORS.ink;
    ctx.font = '14px sans-serif';
    ctx.fillText(detail, width / 2, panel.y + 60);

    drawProgressBar(ctx, panel.x + 26, panel.y + 94, panel.w - 52, 12, progress, color);

    if (this.phase === 'success' && this.result) {
      ctx.fillStyle = COLORS.muted;
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText(
        `base=${fmt(this.result.base, 3)} peak=${fmt(this.result.peak, 3)} Δ=${fmt(this.result.delta, 3)}`,
        width / 2,
        panel.y + 122,
      );
      const t = 1 - Math.max(0, this.successTimer / 1000);
      drawRoarBurst(ctx, width / 2, height * 0.46, width * (0.12 + t * 0.2), 1 - t, COLORS.gold);
    }

    // 实时张嘴电平
    const level = this.ctx.input.levelAt(performance.now());
    ctx.fillStyle = COLORS.muted;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('合成张嘴', panel.x + 16, panel.y + panel.h - 42);
    drawProgressBar(ctx, panel.x + 90, panel.y + panel.h - 34, panel.w - 110, 10, level, COLORS.gold);

    ctx.restore();
  }

  private drawError(ctx: CanvasRenderingContext2D): void {
    const width = this.ctx.width;
    const height = this.ctx.height;
    const panel = {
      x: width * 0.08,
      y: height * 0.3,
      w: width * 0.84,
      h: height * 0.2,
    };
    drawPanel(ctx, panel);
    ctx.save();
    ctx.fillStyle = COLORS.red;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('没有摄像头就玩不了哦', width / 2, panel.y + 18);
    ctx.fillStyle = COLORS.ink;
    ctx.font = '14px sans-serif';
    drawWrappedText(ctx, this.error ?? '', panel.x + 18, panel.y + 56, panel.w - 36, 20, 3);
    ctx.restore();
  }

  private handleButton(id: string): void {
    if (id === 'retry') {
      void this.startCamera();
      return;
    }
    if (id === 'fallback') {
      this.ctx.camera.setAllowFallback(true);
      void this.startCamera();
      return;
    }
    if (id === 'home') this.ctx.goTo('S1');
  }
}
