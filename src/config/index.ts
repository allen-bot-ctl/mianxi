import raw from '../../config/tunables.json';

export interface JudgeConfig {
  pEarly: number;
  pSuccess: number;
  pPerfect: number;
}

export interface IntentConfig {
  O_ON: number;
  O_OFF: number;
  CLOSED_HOLD_MS: number;
  ROAR_HOLD_MS: number;
  MIN_SAMPLES: number;
  LATENCY_COMP_MS: number;
  LOST_PAUSE_MS: number;
  RESUME_MS: number;
  ABORT_MS: number;
  CANDIDATE_DROP: number;
}

export interface FaceConfig {
  minScore: number;
  minWidthRatio: number;
  maxWidthRatio: number;
  maxAbsYaw: number;
  maxAbsPitch: number;
}

export interface CalibrationConfig {
  defaultBase: number;
  defaultPeak: number;
  minDelta: number;
  baseWindowMs: number;
  peakWindowMs: number;
  peakPercentile: number;
}

export interface StraightCreatureConfig {
  id: number;
  kind: 'straight';
  durationMs: number;
  easing: 'linear' | 'easeInQuad';
}

export interface PauseCreatureConfig {
  id: number;
  kind: 'pause';
  firstPhaseMs: number;
  firstPhaseP: number;
  pauseMsMin: number;
  pauseMsMax: number;
  finalPhaseMs: number;
}

export interface FeintCreatureConfig {
  id: number;
  kind: 'feint';
  firstPhaseMs: number;
  firstPhaseP: number;
  feintRiseMs: number;
  feintPeakP: number;
  feintReturnMs: number;
  feintReturnP: number;
  pauseMsMin: number;
  pauseMsMax: number;
  finalPhaseMs: number;
}

export type CreatureConfig = StraightCreatureConfig | PauseCreatureConfig | FeintCreatureConfig;

export interface TitleConfig {
  min: number;
  max: number;
  label: string;
}

export interface Tunables {
  meta: { version: string; updated: string; note: string };
  judge: JudgeConfig;
  intent: IntentConfig;
  face: FaceConfig;
  sampling: { DETECT_EVERY_N_FRAMES: number; detectRateWindowMs: number };
  view: { VIDEO_PREMIRRORED: boolean; _comment: string };
  beautify: {
    default: keyof Pick<BeautifyConfig, 'natural' | 'minimum' | 'probeHigh'>;
    natural: number[];
    minimum: number[];
    probeHigh: number[];
    _comment: string;
  };
  calibration: CalibrationConfig & { _comment: string };
  slow: { detectHzThreshold: number; timeScale: number; _comment: string };
  schedule: { creatures: CreatureConfig[] };
  score: { creatureMax: number; titles: TitleConfig[] };
  render: {
    dangerCircleSmoothing: number;
    creatureMaxWidthFactor: number;
    resultAnimMs: number;
    endingCardMs: number;
    countdownFrom: number;
    countdownStepMs: number;
    facecheckHoldMs: number;
  };
  recording: { durationS: number; isMarkOpen: boolean; frameRate: number };
  probe: { detectNValues: number[]; exportKey: string; maxLogRows: number };
  share: {
    title: string;
    hashtags: string[];
    videoTitleTemplate: string;
    channel: string;
  };
  privacy: { version: number };
  storage: {
    keys: {
      privacyAccepted: string;
      calibration: string;
      beautify: string;
      bestScore: string;
    };
  };
}

export interface BeautifyConfig {
  natural: number[];
  minimum: number[];
  probeHigh: number[];
}

/** 唯一配置来源：仓库根 config/tunables.json。 */
export const tunables = raw as unknown as Tunables;

export function cloneTunables(): Tunables {
  return JSON.parse(JSON.stringify(raw)) as Tunables;
}
