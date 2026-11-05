import type { JudgeConfig } from '../../config';

export type JudgeResult = 'too_early' | 'repel' | 'perfect' | 'too_late';

export interface JudgeOutcome {
  result: JudgeResult;
  score: number;
  label: string;
}

/** §3.4：用触发时刻的 p 判定，不用像素。 */
export function judge(p: number, config: JudgeConfig): JudgeOutcome {
  if (!Number.isFinite(p) || p < config.pEarly) {
    return { result: 'too_early', score: 0, label: '太早：它不怕' };
  }
  if (p < config.pSuccess) {
    return { result: 'repel', score: 1, label: '吼退' };
  }
  if (p < config.pPerfect) {
    return { result: 'perfect', score: 2, label: '贴脸吼' };
  }
  return { result: 'too_late', score: 0, label: '太晚：被扑' };
}

/** 到 p=1 都没吼，或 p ≥ pPerfect 才吼。 */
export function judgeNoRoar(config: JudgeConfig): JudgeOutcome {
  return { result: 'too_late', score: 0, label: '太晚：被扑' };
}
