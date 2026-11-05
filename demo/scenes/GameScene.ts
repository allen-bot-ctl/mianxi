import type { SceneId } from '../../src/flow';
import {
  defaultCalibration,
  evaluateFaceValidity,
  measureMouth,
  type FaceValidity,
  type MouthMeasurement,
} from '../../src/core/signal';
import { IntentState } from '../../src/core/intent';
import {
  HoutuiMode,
  drawCreature,
  drawPounce,
  drawRoarBurst,
} from '../../src/game/houtui';
import { TelemetryEvents } from '../../src/telemetry';
import type { Calibration, FaceFrame } from '../../src/types';
import type { RoundResult } from '../../src/game';
import type { DemoContext } from '../app/context';
import type { DemoScene } from '../app/Scene';
import {
  COLORS,
  clamp,
  drawCenteredText,
  drawDebugHud,
  fmt,
  lerp,
} from '../app/canvas';
import {
  buildView,
  drawCameraLayer,
  drawCameraPlaceholder,
  drawFaceOverlay,
} from '../app/live';
import { readCalibration } from '../app/persistence';

const OUTCOME_COPY: Record<string, string> = {
  too_early: '哈？就这？',
  repel: '吼退了！',
  perfect: '贴脸吼！',
  too_late: '被扑了！',
};

const OUTCOME_COLOR: Record<string, string> = {
  too_early: COLORS.red,
  repel: COLORS.green,
  perfect: COLORS.gold,
  too_late: COLORS.muted,
};

export class GameScene implements DemoScene {
  readonly id: SceneId = 'S6';
  private readonly mode: HoutuiMode;
  private calibration: Calibration;
  private inFlight = false;
  private finished = false;
  private lastFrame: FaceFrame | null = null;
  private lastValidity: FaceValidity | null = null;
  private lastMeasurement: MouthMeasurement | null = null;
  private detectTimes: number[] = [];
  private emittedResults = 0;
  private prevPaused = false;
  private pauseStartedAt: number | null = null;
  private down: { x: number; y: number } | null = null;
  private dragging = false;
  private dangerCenter: { x: number; y: number } | null = null;

  constructor(private readonly ctx: DemoContext) {
    this.mode = new HoutuiMode(ctx.config);
    this.calibration = defaultCalibration(ctx.config.calibration);
  }

  enter(): void {
    this.calibration =
      readCalibration(this.ctx.storage, this.ctx.config) ??
      defaultCalibration(this.ctx.config.calibration);
    this.mode.prepare({
      canvasWidth: this.ctx.width,
      canvasHeight: this.ctx.height,
      calibration: this.calibration,
      detectHz: 30,
      rngSeed: 1,
    });
    this.inFlight = false;
    this.finished = false;
    this.lastFrame = null;
    this.lastValidity = null;
    this.lastMeasurement = null;
    this.detectTimes = [];
    this.emittedResults = 0;
    this.prevPaused = false;
    this.pauseStartedAt = null;
    this.down = null;
    this.dragging = false;
    this.dangerCenter = null;
    this.ctx.input.reset();
    this.ctx.faceSource.setMouthLevel(0);
    this.ctx.telemetry.emit(TelemetryEvents.roundStart);
  }

  exit(): void {
    this.ctx.input.reset();
    if (this.prevPaused) {
      this.ctx.recorder.resume();
      this.prevPaused = false;
    }
  }

  update(dtMs: number): void {
    if (this.finished) return;

    this.mode.update(dtMs);
    const result = this.mode.result();
    this.syncResults(result);

    if (result.aborted) {
      this.finishAborted(result);
      return;
    }
    if (result.finished) {
      this.finishRound(result);
      return;
    }

    this.syncPause();

    if (this.inFlight) return;
    const video = this.ctx.camera.getVideo();
    const view = buildView(this.ctx.camera, this.ctx.config, this.ctx.width, this.ctx.height);
    if (!video || !view) return;

    const now = performance.now();
    const level = this.ctx.input.levelAt(now);
    this.ctx.faceSource.setMouthLevel(level);
    this.inFlight = true;
    void this.ctx.faceSource
      .detect(video, view, now)
      .then((frame) => {
        if (this.ctx.flow.current !== 'S6' || this.finished) return;
        this.handleFrame(frame);
      })
      .finally(() => {
        this.inFlight = false;
      });
  }

  render(ctx: CanvasRenderingContext2D): void {
    const width = this.ctx.width;
    const height = this.ctx.height;
    this.ctx.faceSource.setMouthLevel(this.ctx.input.levelAt(performance.now()));

    if (this.ctx.camera.getVideo()) {
      drawCameraLayer(ctx, this.ctx.camera, this.ctx.config, width, height);
    } else {
      drawCameraPlaceholder(ctx, width, height, '没有摄像头画面');
    }

    const bbox = this.ctx.faceSource.getBBox(width, height);
    const faceCx = bbox.x + bbox.w / 2;
    const faceCy = bbox.y + bbox.h / 2;

    // 危险圈：跟随假脸框平滑移动（数值来自 config.render.dangerCircleSmoothing）。
    const smoothing = clamp(this.ctx.config.render.dangerCircleSmoothing, 0, 1);
    if (!this.dangerCenter) {
      this.dangerCenter = { x: faceCx, y: faceCy };
    } else {
      this.dangerCenter.x = lerp(this.dangerCenter.x, faceCx, smoothing);
      this.dangerCenter.y = lerp(this.dangerCenter.y, faceCy, smoothing);
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.ellipse(this.dangerCenter.x, this.dangerCenter.y, bbox.w * 0.68, bbox.h * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    drawFaceOverlay(ctx, this.ctx.faceSource, width, height, {
      showMouthPoints: true,
      bboxColor: 'rgba(94,234,212,0.7)',
    });

    this.drawCreatureLayer(ctx, width, height, bbox);

    // 上下渐变，保证 HUD 可读，但不遮住脸中心。
    const topGradient = ctx.createLinearGradient(0, 0, 0, height * 0.2);
    topGradient.addColorStop(0, 'rgba(0,0,0,0.55)');
    topGradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topGradient;
    ctx.fillRect(0, 0, width, height * 0.2);

    const bottomGradient = ctx.createLinearGradient(0, height * 0.78, 0, height);
    bottomGradient.addColorStop(0, 'rgba(0,0,0,0)');
    bottomGradient.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = bottomGradient;
    ctx.fillRect(0, height * 0.78, width, height * 0.22);

    this.drawHud(ctx, width, height);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) this.ctx.input.pulse(performance.now());
      return;
    }
    if (event.code === 'ArrowUp' || event.code === 'KeyW') {
      event.preventDefault();
      this.ctx.input.setKey(event.code, true);
    }
  }

  onKeyUp(event: KeyboardEvent): void {
    if (event.code === 'ArrowUp' || event.code === 'KeyW') {
      this.ctx.input.setKey(event.code, false);
    }
  }

  onPointerDown(x: number, y: number): void {
    this.down = { x, y };
    this.dragging = false;
  }

  onPointerMove(x: number, y: number): void {
    if (!this.down) return;
    if (!this.dragging) {
      const dx = x - this.down.x;
      const dy = y - this.down.y;
      if (dx * dx + dy * dy < 64) return;
      this.dragging = true;
    }
    this.ctx.faceSource.setCenterFromCanvas(x, y, this.ctx.width, this.ctx.height);
    this.dangerCenter = null;
  }

  onPointerUp(_x: number, _y: number): void {
    if (this.down && !this.dragging) {
      this.ctx.input.pulse(performance.now());
    }
    this.down = null;
    this.dragging = false;
  }

  tap(_x: number, _y: number): void {
    this.ctx.input.pulse(performance.now());
  }

  private handleFrame(frame: FaceFrame): void {
    const validity = evaluateFaceValidity(frame, this.ctx.width, this.ctx.config.face);
    const measurement = measureMouth(frame.mouth, this.calibration);
    this.lastFrame = frame;
    this.lastValidity = validity;
    this.lastMeasurement = measurement;
    this.detectTimes.push(frame.t);
    const windowMs = this.ctx.config.sampling.detectRateWindowMs;
    while (this.detectTimes.length > 0 && frame.t - this.detectTimes[0]! > windowMs) {
      this.detectTimes.shift();
    }
    this.mode.onFaceFrame(frame);
  }

  private syncResults(result: RoundResult): void {
    while (this.emittedResults < result.results.length) {
      const item = result.results[this.emittedResults];
      this.emittedResults += 1;
      if (!item) continue;
      this.ctx.telemetry.emit(TelemetryEvents.creatureResult, {
        idx: item.idx,
        type: item.type,
        result: item.result,
        p: Number(item.p.toFixed(4)),
        ms_to_trigger: Math.round(item.msToTrigger),
        source: item.source,
      });
    }
  }

  private syncPause(): void {
    const paused = this.mode.paused;
    if (paused === this.prevPaused) return;
    this.prevPaused = paused;
    if (paused) {
      this.pauseStartedAt = performance.now();
      this.ctx.recorder.pause();
      return;
    }
    const ms = this.pauseStartedAt === null ? 0 : performance.now() - this.pauseStartedAt;
    this.pauseStartedAt = null;
    this.ctx.telemetry.emit(TelemetryEvents.faceLost, { ms: Math.round(ms) });
    this.ctx.recorder.resume();
  }

  private finishRound(result: RoundResult): void {
    if (this.finished) return;
    this.finished = true;
    this.ctx.roundResult = result;
    this.ctx.roundAborted = false;
    this.ctx.goTo('S7');
  }

  private finishAborted(result: RoundResult): void {
    if (this.finished) return;
    this.finished = true;
    this.ctx.roundResult = result;
    this.ctx.roundAborted = true;
    this.ctx.telemetry.emit(TelemetryEvents.roundAbort, {
      reason: result.abortReason ?? 'unknown',
    });
    this.ctx.recorder.stop();
    this.ctx.goTo('S8');
  }

  private drawCreatureLayer(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    bbox: { x: number; y: number; w: number; h: number },
  ): void {
    const now = performance.now();
    const p = this.mode.progress;
    const outcome = this.mode.currentOutcome;
    const animating = this.mode.isResultAnimating;
    const animMs = Math.max(1, this.ctx.config.render.resultAnimMs);
    const animProgress = animating
      ? 1 - clamp(this.mode.resultAnimRemainingMs / animMs, 0, 1)
      : 0;

    const faceCx = bbox.x + bbox.w / 2;
    const faceCy = bbox.y + bbox.h / 2;
    const maxRadius = Math.max(8, bbox.w * this.ctx.config.render.creatureMaxWidthFactor * 0.5);
    const radius = Math.max(6, maxRadius * Math.max(0.12, p));
    const wobble = p < 0.08 ? Math.sin(now / 350) * width * 0.025 : 0;
    let x = lerp(width / 2, faceCx, p) + wobble;
    let y = lerp(height * 0.1, faceCy, p);
    let drawRadius = radius;
    let rotation = 0;

    if (animating && outcome) {
      if (outcome.result === 'repel' || outcome.result === 'perfect') {
        y -= animProgress * height * 0.2;
        x += Math.sin(animProgress * Math.PI) * width * 0.06;
        drawRadius *= Math.max(0.2, 1 - animProgress * 0.75);
        rotation = animProgress * Math.PI * 1.5 * (outcome.result === 'perfect' ? 1 : 0.6);
      } else if (outcome.result === 'too_early') {
        x += Math.sin(animProgress * Math.PI * 8) * width * 0.02;
      }
    }

    if (this.mode.state === IntentState.PAUSED) {
      ctx.save();
      ctx.globalAlpha = 0.45;
    }

    ctx.save();
    ctx.translate(x, y);
    if (rotation !== 0) ctx.rotate(rotation);
    drawCreature(ctx, {
      x: 0,
      y: 0,
      radius: drawRadius,
      color: this.mode.state === IntentState.APPROACH || this.mode.state === IntentState.CANDIDATE
        ? '#f08a5d'
        : '#f6b26b',
    });
    ctx.restore();

    if (this.mode.state === IntentState.PAUSED) ctx.restore();

    if (animating && outcome) {
      const mouth = this.ctx.faceSource.getMouthCenter(width, height);
      if (outcome.result === 'repel' || outcome.result === 'perfect') {
        drawRoarBurst(
          ctx,
          mouth.x,
          mouth.y,
          width * (0.08 + animProgress * 0.28),
          1 - animProgress,
          outcome.result === 'perfect' ? COLORS.gold : '#ffffff',
        );
      } else if (outcome.result === 'too_late') {
        drawPounce(ctx, faceCx, bbox.y + bbox.h * 0.12, bbox.w * 1.2);
      }
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const result = this.mode.result();
    const dotsY = 30;
    const dotGap = 26;
    const startX = width / 2 - dotGap;
    for (let index = 0; index < this.ctx.config.schedule.creatures.length; index += 1) {
      const item = result.results[index];
      ctx.save();
      ctx.beginPath();
      ctx.arc(startX + index * dotGap, dotsY, 7, 0, Math.PI * 2);
      if (!item) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle =
          item.result === 'repel'
            ? COLORS.green
            : item.result === 'perfect'
              ? COLORS.gold
              : 'rgba(160,170,190,0.8)';
        ctx.fill();
      }
      ctx.restore();
    }

    const index = Math.min(this.mode.creatureIndex + 1, this.mode.creatureCount || 1);
    drawCenteredText(
      ctx,
      `扑扑 ${index} / ${this.mode.creatureCount || 3}`,
      width / 2,
      54,
      '12px sans-serif',
      COLORS.muted,
    );

    const outcome = this.mode.currentOutcome;
    let prompt = '它来了……';
    if (this.mode.state === IntentState.WAIT_CLOSED) prompt = '闭上嘴，准备……';
    else if (this.mode.state === IntentState.PAUSED) prompt = '脸不见啦，快回来';
    else if (this.mode.state === IntentState.LOCKED) prompt = '……';
    if (this.mode.isResultAnimating && outcome) {
      prompt = OUTCOME_COPY[outcome.result] ?? outcome.label;
    }

    const promptColor =
      this.mode.isResultAnimating && outcome
        ? OUTCOME_COLOR[outcome.result] ?? COLORS.ink
        : this.mode.state === IntentState.PAUSED
          ? COLORS.red
          : COLORS.ink;
    drawCenteredText(
      ctx,
      prompt,
      width / 2,
      height * 0.88,
      `bold ${Math.round(Math.min(width * 0.055, 23))}px sans-serif`,
      promptColor,
    );

    drawCenteredText(
      ctx,
      '点击/空格 = 吼 · 按住 ↑/W = 张嘴 · 拖动 = 挪假脸',
      width / 2,
      height * 0.935,
      '11px sans-serif',
      COLORS.dim,
    );

    const detectHz = this.detectHz();
    drawDebugHud(ctx, 14, 76, [
      'source=demo-synth',
      `state=${this.mode.state}`,
      `p=${fmt(this.mode.progress, 2)} o=${fmt(this.lastMeasurement?.o, 2)}`,
      `face=${this.lastValidity?.valid ? 1 : 0} mouth=${this.lastFrame?.mouth.length ?? 0}`,
      `detect=${fmt(detectHz, 1)}Hz${this.mode.paused ? ' PAUSED' : ''}`,
    ]);
  }

  private detectHz(): number {
    const windowMs = this.ctx.config.sampling.detectRateWindowMs;
    return windowMs > 0 ? (this.detectTimes.length * 1000) / windowMs : 0;
  }
}
