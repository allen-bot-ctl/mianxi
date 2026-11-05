import type { IntentConfig } from '../../config';

export enum IntentState {
  WAIT_CLOSED = 'WAIT_CLOSED',
  APPROACH = 'APPROACH',
  CANDIDATE = 'CANDIDATE',
  ROAR = 'ROAR',
  LATE = 'LATE',
  PAUSED = 'PAUSED',
  ABORT = 'ABORT',
  LOCKED = 'LOCKED',
}

export type IntentSource = 'mouth' | 'mouthAh';

export interface IntentSample {
  /** 采样调用时刻（FaceFrame.t），毫秒。 */
  t: number;
  faceValid: boolean;
  /** 本采样周期的归一化张嘴度；mouth 无效时为 null。 */
  o: number | null;
  /** mouth 缺失/不足 20 点/含无效坐标时的唯一兜底触发源。 */
  mouthAhEvent?: boolean;
}

export interface IntentEvent {
  type: 'ROAR' | 'LATE' | 'ABORT';
  /** 判定时刻。ROAR 为 t_s - LATENCY_COMP_MS。 */
  t: number;
  /** 判定所用的 p（由 GameMode 提供）。 */
  p: number;
  source: IntentSource;
}

export interface IntentUpdate {
  state: IntentState;
  event?: IntentEvent;
  /** 暂停期间 GameMode 必须冻结 p 并 pause 录屏。 */
  paused: boolean;
}

/**
 * §5.2 单只扑扑的纯逻辑状态机。
 * 不依赖 DOM、摄像头或 canvas，可直接用数值序列单测。
 */
export class IntentEngine {
  private readonly config: IntentConfig;
  private readonly pAt?: (t: number) => number;

  private stateValue: IntentState = IntentState.WAIT_CLOSED;
  private closedSince: number | null = null;
  private candidateSince: number | null = null;
  private candidateSamples = 0;
  private candidateSource: IntentSource = 'mouth';
  private invalidSince: number | null = null;
  private pausedSince: number | null = null;
  private pausedBefore: IntentState = IntentState.APPROACH;
  private resumeSince: number | null = null;
  private pausedAccumMs = 0;

  constructor(config: IntentConfig, pAt?: (t: number) => number) {
    this.config = config;
    this.pAt = pAt;
  }

  get state(): IntentState {
    return this.stateValue;
  }

  get totalPausedMs(): number {
    return this.pausedAccumMs;
  }

  isLocked(): boolean {
    return (
      this.stateValue === IntentState.ROAR ||
      this.stateValue === IntentState.LATE ||
      this.stateValue === IntentState.LOCKED ||
      this.stateValue === IntentState.ABORT
    );
  }

  /** 结果动画开始时调用，之后忽略一切输入。 */
  lock(): void {
    if (this.stateValue === IntentState.ROAR || this.stateValue === IntentState.LATE) {
      this.stateValue = IntentState.LOCKED;
    }
  }

  /** 下一只扑扑或重开本局时重置。 */
  reset(): void {
    this.stateValue = IntentState.WAIT_CLOSED;
    this.closedSince = null;
    this.candidateSince = null;
    this.candidateSamples = 0;
    this.candidateSource = 'mouth';
    this.invalidSince = null;
    this.pausedSince = null;
    this.pausedBefore = IntentState.APPROACH;
    this.resumeSince = null;
    this.pausedAccumMs = 0;
  }

  update(sample: IntentSample, p: number): IntentUpdate {
    if (this.isLocked()) return this.result();

    switch (this.stateValue) {
      case IntentState.WAIT_CLOSED:
        return this.updateWaitClosed(sample);
      case IntentState.APPROACH:
      case IntentState.CANDIDATE:
        return this.updateApproachOrCandidate(sample, p);
      case IntentState.PAUSED:
        return this.updatePaused(sample);
      default:
        return this.result();
    }
  }

  private updateWaitClosed(sample: IntentSample): IntentUpdate {
    const closed = sample.faceValid && sample.o !== null && sample.o < this.config.O_OFF;
    if (!closed) {
      this.closedSince = null;
      return this.result();
    }

    if (this.closedSince === null) this.closedSince = sample.t;
    if (sample.t - this.closedSince >= this.config.CLOSED_HOLD_MS) {
      this.stateValue = IntentState.APPROACH;
    }
    return this.result();
  }

  private updateApproachOrCandidate(sample: IntentSample, p: number): IntentUpdate {
    // p 到 1：被扑。优先于同帧的候选确认，避免超时后仍算成功。
    if (p >= 1) {
      return this.finish(IntentState.LATE, sample.t, p, this.candidateSource);
    }

    if (!sample.faceValid) {
      if (this.invalidSince === null) this.invalidSince = sample.t;
      if (sample.t - this.invalidSince >= this.config.LOST_PAUSE_MS) {
        this.enterPaused(sample.t);
      }
      return this.result();
    }

    this.invalidSince = null;
    const opensMouth = sample.mouthAhEvent === true || (sample.o !== null && sample.o >= this.config.O_ON);

    if (this.stateValue === IntentState.APPROACH) {
      if (opensMouth) {
        this.stateValue = IntentState.CANDIDATE;
        this.candidateSince = sample.t;
        this.candidateSamples = 1;
        this.candidateSource = sample.mouthAhEvent === true ? 'mouthAh' : 'mouth';
      }
      return this.result();
    }

    // CANDIDATE：掉到 O_ON - 0.10 以下视为说话/抖动，退回 APPROACH。
    const dropped =
      sample.mouthAhEvent !== true &&
      (sample.o === null || sample.o < this.config.O_ON - this.config.CANDIDATE_DROP);

    if (dropped) {
      this.stateValue = IntentState.APPROACH;
      this.candidateSince = null;
      this.candidateSamples = 0;
      return this.result();
    }

    this.candidateSamples += 1;
    const heldLongEnough =
      this.candidateSince !== null &&
      sample.t - this.candidateSince >= this.config.ROAR_HOLD_MS;
    const enoughSamples = this.candidateSamples >= this.config.MIN_SAMPLES;

    if (heldLongEnough && enoughSamples) {
      const triggerT = this.candidateSince! - this.config.LATENCY_COMP_MS;
      const triggerP = this.pAt ? this.pAt(triggerT) : p;
      return this.finish(IntentState.ROAR, triggerT, triggerP, this.candidateSource);
    }

    return this.result();
  }

  private enterPaused(t: number): void {
    this.pausedBefore = this.stateValue;
    this.stateValue = IntentState.PAUSED;
    this.pausedSince = t;
    this.resumeSince = null;
    this.candidateSamples = 0;
  }

  private updatePaused(sample: IntentSample): IntentUpdate {
    const elapsed = this.pausedSince === null ? 0 : sample.t - this.pausedSince;
    if (this.pausedAccumMs + elapsed >= this.config.ABORT_MS) {
      return this.finish(IntentState.ABORT, sample.t, 0, this.candidateSource);
    }

    if (!sample.faceValid) {
      this.resumeSince = null;
      return this.result();
    }

    if (this.resumeSince === null) this.resumeSince = sample.t;
    if (sample.t - this.resumeSince < this.config.RESUME_MS) return this.result();

    // 恢复有效满 RESUME_MS：累计暂停时长，回到暂停前状态。
    if (this.pausedSince !== null) {
      this.pausedAccumMs += sample.t - this.pausedSince;
    }
    this.pausedSince = null;
    this.resumeSince = null;
    this.invalidSince = null;
    this.stateValue = this.pausedBefore;

    // 暂停打断了“连续保持”，候选计时从恢复时刻重新开始。
    if (this.stateValue === IntentState.CANDIDATE) {
      this.candidateSince = sample.t;
      this.candidateSamples = 0;
    }

    if (this.pausedAccumMs >= this.config.ABORT_MS) {
      return this.finish(IntentState.ABORT, sample.t, 0, this.candidateSource);
    }

    return this.result();
  }

  private finish(
    state: IntentState.ROAR | IntentState.LATE | IntentState.ABORT,
    t: number,
    p: number,
    source: IntentSource,
  ): IntentUpdate {
    this.stateValue = state;
    this.eventValue = {
      type: state,
      t,
      p,
      source,
    };
    return this.result();
  }

  private eventValue: IntentEvent | undefined;

  private result(): IntentUpdate {
    const event = this.eventValue;
    this.eventValue = undefined;
    return {
      state: this.stateValue,
      event,
      paused: this.stateValue === IntentState.PAUSED,
    };
  }
}
