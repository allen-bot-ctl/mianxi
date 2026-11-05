import type { SceneId } from '../../src/flow';
import { evaluateFaceValidity, type FaceValidity } from '../../src/core/signal';
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
  drawWrappedText,
  findButton,
  fmt,
  type DemoButton,
} from '../app/canvas';
import { buildView, drawCameraLayer, drawCameraPlaceholder, drawFaceOverlay, drawTargetOval } from '../app/live';
import { readCalibration, readSkinMode } from '../app/persistence';

export class FaceCheckScene implements DemoScene {
  readonly id: SceneId = 'S3';
  private buttons: DemoButton[] = [];
  private starting = false;
  private ready = false;
  private error: string | null = null;
  private grantedEmitted = false;
  private inFlight = false;
  private passed = false;
  private holdStart: number | null = null;
  private holdMs = 0;
  private lastFrame: FaceFrame | null = null;
  private lastValidity: FaceValidity | null = null;
  private centered = false;
  private down: { x: number; y: number } | null = null;
  private dragging = false;
  private detectTimes: number[] = [];

  constructor(private readonly ctx: DemoContext) {}

  enter(): void {
    this.buttons = [];
    this.starting = false;
    this.ready = false;
    this.error = null;
    this.inFlight = false;
    this.passed = false;
    this.holdStart = null;
    this.holdMs = 0;
    this.lastFrame = null;
    this.lastValidity = null;
    this.centered = false;
    this.down = null;
    this.dragging = false;
    this.detectTimes = [];
    this.ctx.input.reset();
    void this.startCamera();
  }

  exit(): void {
    this.ctx.input.reset();
  }

  update(_dtMs: number): void {
    if (!this.ready || this.error || this.passed || this.inFlight) return;
    const video = this.ctx.camera.getVideo();
    const view = buildView(this.ctx.camera, this.ctx.config, this.ctx.width, this.ctx.height);
    if (!video || !view) return;

    const requestedAt = performance.now();
    this.inFlight = true;
    this.ctx.faceSource.setMouthLevel(0);
    void this.ctx.faceSource
      .detect(video, view, requestedAt)
      .then((frame) => {
        if (this.ctx.flow.current !== 'S3' || this.passed) return;
        this.handleFrame(frame);
      })
      .finally(() => {
        this.inFlight = false;
      });
  }

  render(ctx: CanvasRenderingContext2D): void {
    const width = this.ctx.width;
    const height = this.ctx.height;

    const hasVideo = !!this.ctx.camera.getVideo();
    if (hasVideo) {
      drawCameraLayer(ctx, this.ctx.camera, this.ctx.config, width, height);
      ctx.fillStyle = COLORS.cameraShade;
      ctx.fillRect(0, 0, width, height);
    } else {
      drawCameraPlaceholder(ctx, width, height, this.starting ? '正在打开摄像头…' : '没有摄像头画面');
    }

    drawTargetOval(ctx, width, height);

    const ok = !!this.lastValidity?.valid && this.centered;
    drawFaceOverlay(ctx, this.ctx.faceSource, width, height, {
      showMouthPoints: true,
      bboxColor: ok ? 'rgba(110,231,168,0.95)' : 'rgba(255,140,140,0.95)',
      label: 'demo-synth bbox',
    });

    // 顶部标题
    drawCenteredText(
      ctx,
      '对脸检查',
      width / 2,
      32,
      `bold ${Math.round(Math.min(width * 0.06, 26))}px sans-serif`,
      COLORS.ink,
    );
    drawCenteredText(
      ctx,
      '把脸放进中间的虚线框里',
      width / 2,
      62,
      '14px sans-serif',
      COLORS.muted,
    );

    // 保持进度环
    const holdTarget = Math.max(1, this.ctx.config.render.facecheckHoldMs);
    const progress = Math.min(1, this.holdMs / holdTarget);
    if (progress > 0) {
      ctx.save();
      ctx.strokeStyle = COLORS.green;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(width / 2, height * 0.46, width * 0.315, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      ctx.restore();
    }

    if (this.error) {
      this.drawError(ctx);
    } else {
      const prompt = this.prompt();
      drawCenteredText(
        ctx,
        prompt,
        width / 2,
        height * 0.79,
        `bold ${Math.round(Math.min(width * 0.05, 21))}px sans-serif`,
        ok ? COLORS.green : COLORS.gold,
      );
      drawCenteredText(
        ctx,
        '拖动假脸框可以挪动中心',
        width / 2,
        height * 0.84,
        '13px sans-serif',
        COLORS.dim,
      );
    }

    drawDebugHud(ctx, 14, 88, [
      'source=demo-synth',
      `valid=${this.lastValidity?.valid ? 1 : 0}${this.lastValidity?.reason ? ` (${this.lastValidity.reason})` : ''}`,
      `centered=${this.centered ? 1 : 0} hold=${fmt(this.holdMs / 1000, 2)}s`,
      `bboxW=${this.lastFrame ? fmt(this.lastFrame.bbox.w / Math.max(1, width) * 100, 0) + '%' : '-'} detect=${fmt(this.detectHz(), 1)}Hz`,
    ]);

    this.buttons = [];
    if (this.error) {
      const buttonWidth = width * 0.82;
      const x = (width - buttonWidth) / 2;
      const baseY = height * 0.55;
      this.buttons = [
        { id: 'retry', label: '重试授权', rect: { x, y: baseY, w: buttonWidth, h: 52 }, kind: 'primary' },
        { id: 'fallback', label: '使用占位画面（仅 demo）', rect: { x, y: baseY + 66, w: buttonWidth, h: 46 }, kind: 'ghost' },
        { id: 'home', label: '返回首页', rect: { x: x + buttonWidth * 0.2, y: baseY + 126, w: buttonWidth * 0.6, h: 42 }, kind: 'ghost' },
      ];
    } else {
      this.buttons = [
        {
          id: 'home',
          label: '返回首页',
          rect: { x: width * 0.3, y: height - 54, w: width * 0.4, h: 38 },
          kind: 'ghost',
        },
      ];
    }
    for (const button of this.buttons) drawButton(ctx, button);
  }

  onPointerDown(x: number, y: number): void {
    const button = findButton(this.buttons, x, y);
    if (button) {
      this.handleButton(button.id);
      return;
    }
    this.down = { x, y };
    this.dragging = false;
  }

  onPointerMove(x: number, y: number): void {
    if (!this.down) return;
    if (!this.dragging) {
      const dx = x - this.down.x;
      const dy = y - this.down.y;
      if (dx * dx + dy * dy < 36) return;
      this.dragging = true;
    }
    this.ctx.faceSource.setCenterFromCanvas(x, y, this.ctx.width, this.ctx.height);
    this.holdStart = null;
    this.holdMs = 0;
  }

  onPointerUp(_x: number, _y: number): void {
    this.down = null;
    this.dragging = false;
  }

  tap(x: number, y: number): void {
    this.onPointerDown(x, y);
  }

  private async startCamera(): Promise<void> {
    if (this.starting) return;
    if (this.ctx.camera.getVideo()) {
      this.ctx.faceSource.start();
      this.applySkin();
      this.ready = true;
      if (!this.grantedEmitted) {
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

  private handleFrame(frame: FaceFrame): void {
    const width = this.ctx.width;
    const height = this.ctx.height;
    const validity = evaluateFaceValidity(frame, width, this.ctx.config.face);
    const centered = isCentered(frame, width, height);
    this.lastFrame = frame;
    this.lastValidity = validity;
    this.centered = centered;
    this.detectTimes.push(frame.t);
    const windowMs = this.ctx.config.sampling.detectRateWindowMs;
    while (this.detectTimes.length > 0 && frame.t - this.detectTimes[0]! > windowMs) {
      this.detectTimes.shift();
    }

    if (validity.valid && centered) {
      if (this.holdStart === null) this.holdStart = frame.t;
      this.holdMs = frame.t - this.holdStart;
      if (this.holdMs >= this.ctx.config.render.facecheckHoldMs) this.pass();
    } else {
      this.holdStart = null;
      this.holdMs = 0;
    }
  }

  private pass(): void {
    if (this.passed) return;
    this.passed = true;
    this.ctx.telemetry.emit(TelemetryEvents.facecheckPass, {
      ms: Math.round(this.holdMs),
    });

    if (this.ctx.flags.afterCalibration) {
      this.ctx.flags.afterCalibration = false;
      this.ctx.goTo(this.ctx.flags.faceCheckNext);
      return;
    }
    if (!readCalibration(this.ctx.storage, this.ctx.config)) {
      this.ctx.flags.calibrationReturn = 'play';
      this.ctx.goTo('S4');
      return;
    }
    this.ctx.goTo('S5');
  }

  private prompt(): string {
    if (this.starting) return '正在打开摄像头…';
    if (!this.lastValidity) return '正在识别…';
    if (!this.lastValidity.valid) {
      switch (this.lastValidity.reason) {
        case 'too_small':
          return '靠近一点';
        case 'too_large':
          return '退后一点';
        case 'yaw':
        case 'pitch':
          return '正对我';
        case 'low_score':
        case 'not_found':
        case 'bad_bbox':
        default:
          return '把脸放进框里';
      }
    }
    if (!this.centered) return '把脸放进框里';
    return '保持不动…';
  }

  private drawError(ctx: CanvasRenderingContext2D): void {
    const width = this.ctx.width;
    const height = this.ctx.height;
    const panel = {
      x: width * 0.08,
      y: height * 0.34,
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
    if (id === 'home') {
      this.ctx.goTo('S1');
    }
  }

  private detectHz(): number {
    const windowMs = this.ctx.config.sampling.detectRateWindowMs;
    return windowMs > 0 ? (this.detectTimes.length * 1000) / windowMs : 0;
  }
}

function isCentered(
  frame: FaceFrame,
  width: number,
  height: number,
): boolean {
  const centerX = frame.bbox.x + frame.bbox.w / 2;
  const centerY = frame.bbox.y + frame.bbox.h / 2;
  return (
    Math.abs(centerX - width / 2) <= width * 0.16 &&
    Math.abs(centerY - height * 0.46) <= height * 0.13
  );
}
