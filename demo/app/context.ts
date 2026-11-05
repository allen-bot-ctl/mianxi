import type { Tunables } from '../../src/config';
import type { SceneId } from '../../src/flow';
import type { FlowController } from '../../src/flow';
import type { RoundResult } from '../../src/game';
import type { Telemetry } from '../../src/telemetry';
import type { DemoCameraSource } from '../platform/DemoCameraSource';
import type { DemoFaceSource } from '../platform/DemoFaceSource';
import type { DemoRecorder } from '../platform/DemoRecorder';
import type { DemoShare } from '../platform/DemoShare';
import type { DemoStorage } from '../platform/DemoStorage';
import type { DemoInput } from './input';

export interface DemoFlowFlags {
  /** S4 校准成功返回 S3 时置 true，S3 通过后直接去 S5。 */
  afterCalibration: boolean;
  /** S3 通过后的去向；正常是 S5。 */
  faceCheckNext: Extract<SceneId, 'S5' | 'S9'>;
  /** S4 完成后回游戏还是回设置。 */
  calibrationReturn: 'play' | 'settings';
  /** S2 同意/暂不后回到哪里。 */
  privacyReturn: Extract<SceneId, 'S3' | 'S9'>;
}

export interface DemoContext {
  readonly config: Tunables;
  readonly telemetry: Telemetry;
  readonly camera: DemoCameraSource;
  readonly faceSource: DemoFaceSource;
  readonly recorder: DemoRecorder;
  readonly storage: DemoStorage;
  readonly share: DemoShare;
  readonly input: DemoInput;
  readonly flow: FlowController;
  readonly flags: DemoFlowFlags;
  readonly width: number;
  readonly height: number;
  /** 启动参数 from=video&s=X 的分数。 */
  readonly fromVideoScore: number | null;

  roundResult: RoundResult | null;
  roundAborted: boolean;

  goTo(id: SceneId): void;
  setNotice(text: string, durationMs?: number): void;
  getNotice(): string | null;
}
