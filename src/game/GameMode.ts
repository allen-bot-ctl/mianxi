import type { Calibration, FaceFrame } from '../types';
import type { IntentEvent } from '../core/intent';
import type { JudgeResult } from './houtui/judge';

export interface CreatureResult {
  idx: number;
  creatureId: number;
  /** 直冲 / 停顿 / 假动作。 */
  type: string;
  result: JudgeResult;
  score: number;
  p: number;
  source: 'mouth' | 'mouthAh';
  /** ROAR 时相对本只开始的毫秒数。 */
  msToTrigger: number;
}

export interface RoundResult {
  modeId: string;
  score: number;
  title: string;
  results: CreatureResult[];
  aborted: boolean;
  abortReason?: string;
  finished: boolean;
}

export interface GameModeContext {
  canvasWidth: number;
  canvasHeight: number;
  calibration: Calibration;
  /** 实测检测频率；用于选择普通/慢速难度。 */
  detectHz?: number;
  /** 固定种子便于复现；不传则默认 1。 */
  rngSeed?: number;
}

/**
 * 交接 §11.2 预留的玩法扩展位。首发只实现 houtui。
 */
export interface GameMode {
  id: string;
  prepare(ctx: GameModeContext): void;
  onFaceFrame(frame: FaceFrame): void;
  onIntent(event: IntentEvent): void;
  update(dtMs: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  result(): RoundResult;
}
