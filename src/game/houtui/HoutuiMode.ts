import type { Tunables } from '../../config';
import { evaluateFaceValidity, measureMouth } from '../../core/signal';
import { IntentEngine, IntentState, type IntentEvent } from '../../core/intent';
import type { FaceFrame } from '../../types';
import type { CreatureResult, GameMode, GameModeContext, RoundResult } from '../GameMode';
import { judge, judgeNoRoar, type JudgeOutcome } from './judge';
import { createCreatureVisual, drawCreature } from './creature';
import { drawPounce, drawRoarBurst } from './effects';
import {
  createHoutuiSchedules,
  getTitle,
  mulberry32,
  timeScaleForDetectRate,
  type CreatureSchedule,
  type RandomFn,
} from './schedule';

const KIND_LABELS: Record<string, string> = {
  straight: '直冲',
  pause: '停顿',
  feint: '假动作',
};

/**
 * 「吼退扑扑」的最小可运行实现：
 * IntentEngine 产出 ROAR/LATE/ABORT → 按触发时刻 p 调 judge → 记录每只结果。
 * 美术与音效本轮为占位色块。
 */
export class HoutuiMode implements GameMode {
  readonly id = 'houtui';

  private readonly config: Tunables;
  private readonly engine: IntentEngine;
  private context: GameModeContext | null = null;
  private schedules: CreatureSchedule[] = [];
  private random: RandomFn = mulberry32(1);

  private index = 0;
  private elapsedMs = 0;
  private currentP = 0;
  private resultTimerMs = 0;
  private results: CreatureResult[] = [];
  private aborted = false;
  private abortReason: string | undefined;
  private finished = false;
  private lastOutcome: JudgeOutcome | null = null;

  constructor(config: Tunables) {
    this.config = config;
    this.engine = new IntentEngine(config.intent, () => this.currentP);
  }

  /** 当前意图状态；demo HUD 只读。 */
  get state(): IntentState {
    return this.engine.state;
  }

  /** 当前扑扑的逼近进度 p，0..1。 */
  get progress(): number {
    return this.currentP;
  }

  /** 当前扑扑下标（0 起）。 */
  get creatureIndex(): number {
    return this.index;
  }

  /** 当前扑扑数量。 */
  get creatureCount(): number {
    return this.schedules.length;
  }

  /** 最近一只的判定结果；结果动画/片尾用。 */
  get currentOutcome(): JudgeOutcome | null {
    return this.lastOutcome;
  }

  /** 是否在 1.2–1.5s 结果动画中。 */
  get isResultAnimating(): boolean {
    return this.resultTimerMs > 0;
  }

  /** 结果动画剩余毫秒。 */
  get resultAnimRemainingMs(): number {
    return this.resultTimerMs;
  }

  get paused(): boolean {
    return this.engine.state === IntentState.PAUSED;
  }

  get totalPausedMs(): number {
    return this.engine.totalPausedMs;
  }

  get isFinished(): boolean {
    return this.finished;
  }

  get isAborted(): boolean {
    return this.aborted;
  }

  prepare(ctx: GameModeContext): void {
    this.context = ctx;
    this.random = mulberry32(ctx.rngSeed ?? 1);
    const timeScale = timeScaleForDetectRate(
      ctx.detectHz ?? Number.POSITIVE_INFINITY,
      this.config.slow,
    );
    this.schedules = createHoutuiSchedules(
      this.config.schedule.creatures,
      timeScale,
      this.random,
    );
    this.index = 0;
    this.elapsedMs = 0;
    this.currentP = 0;
    this.resultTimerMs = 0;
    this.results = [];
    this.aborted = false;
    this.abortReason = undefined;
    this.finished = false;
    this.lastOutcome = null;
    this.engine.reset();
  }

  onFaceFrame(frame: FaceFrame): void {
    if (!this.context || this.finished || this.aborted || this.engine.isLocked()) return;

    const measurement = measureMouth(frame.mouth, this.context.calibration);
    const validity = evaluateFaceValidity(frame, this.context.canvasWidth, this.config.face);
    const update = this.engine.update(
      {
        t: frame.t,
        faceValid: validity.valid,
        o: measurement.o,
        mouthAhEvent: frame.mouthAhEvent,
      },
      this.currentP,
    );
    if (update.event) this.onIntent(update.event);
  }

  onIntent(event: IntentEvent): void {
    if (!this.context || this.finished || this.aborted) return;

    if (event.type === 'ABORT') {
      this.aborted = true;
      this.abortReason = 'face_lost_too_long';
      this.finished = true;
      return;
    }

    if (this.results.length > this.index) return;

    const schedule = this.schedules[this.index];
    if (!schedule) return;

    const outcome =
      event.type === 'ROAR' ? judge(event.p, this.config.judge) : judgeNoRoar(this.config.judge);

    this.lastOutcome = outcome;
    this.results.push({
      idx: this.index,
      creatureId: schedule.id,
      type: KIND_LABELS[schedule.kind] ?? schedule.kind,
      result: outcome.result,
      score: outcome.score,
      p: event.p,
      source: event.source,
      msToTrigger: this.elapsedMs,
    });

    this.engine.lock();
    this.resultTimerMs = this.config.render.resultAnimMs;
  }

  update(dtMs: number): void {
    if (!this.context || this.finished || this.aborted) return;

    if (this.resultTimerMs > 0) {
      this.resultTimerMs = Math.max(0, this.resultTimerMs - dtMs);
      if (this.resultTimerMs === 0) this.advanceCreature();
      return;
    }

    if (
      this.engine.state === IntentState.APPROACH ||
      this.engine.state === IntentState.CANDIDATE
    ) {
      this.elapsedMs += dtMs;
      const schedule = this.schedules[this.index];
      this.currentP = schedule ? schedule.pAt(this.elapsedMs) : 0;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const width = this.context?.canvasWidth ?? ctx.canvas?.width ?? 360;
    const height = this.context?.canvasHeight ?? ctx.canvas?.height ?? 640;
    const centerX = width / 2;
    const centerY = height * 0.45;
    const maxRadius = width * 0.4 * this.config.render.creatureMaxWidthFactor * 0.5;

    // 中层占位：危险圈 + 扑扑色块。
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, width * 0.3, width * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const radius = Math.max(6, maxRadius * Math.max(0.12, this.currentP));
    drawCreature(ctx, createCreatureVisual(this.currentP, width, height, maxRadius));

    if (this.lastOutcome && this.resultTimerMs > 0) {
      if (this.lastOutcome.result === 'repel' || this.lastOutcome.result === 'perfect') {
        drawRoarBurst(
          ctx,
          centerX,
          centerY,
          radius * 1.3,
          this.resultTimerMs / this.config.render.resultAnimMs,
          this.lastOutcome.result === 'perfect' ? '#ffd166' : '#ffffff',
        );
      } else if (this.lastOutcome.result === 'too_late') {
        drawPounce(ctx, centerX, centerY - width * 0.18, width);
      }

      ctx.fillStyle = '#fff4ce';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.lastOutcome.label, centerX, height * 0.7);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`扑扑 ${Math.min(this.index + 1, this.schedules.length)} / ${this.schedules.length}`, centerX, height * 0.9);
    ctx.restore();
  }

  result(): RoundResult {
    const score = this.results.reduce((sum, item) => sum + item.score, 0);
    return {
      modeId: this.id,
      score,
      title: getTitle(score, this.config.score.titles),
      results: [...this.results],
      aborted: this.aborted,
      abortReason: this.abortReason,
      finished: this.finished,
    };
  }

  private advanceCreature(): void {
    this.index += 1;
    this.elapsedMs = 0;
    this.currentP = 0;
    this.engine.reset();
    this.lastOutcome = null;

    if (this.index >= this.schedules.length) {
      this.finished = true;
    }
  }
}
