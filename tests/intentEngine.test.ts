import { beforeEach, describe, expect, it } from 'vitest';
import { tunables } from '../src/config';
import { IntentEngine, IntentState } from '../src/core/intent/IntentEngine';

const config = tunables.intent;

function sample(t: number, o: number | null, faceValid = true) {
  return { t, faceValid, o, mouthAhEvent: false };
}

function driveToApproach(engine: IntentEngine): void {
  engine.update(sample(0, 0.1), 0);
  engine.update(sample(150, 0.1), 0);
  const update = engine.update(sample(300, 0.1), 0);
  expect(update.state).toBe(IntentState.APPROACH);
}

describe('IntentEngine §5.2', () => {
  let engine: IntentEngine;

  beforeEach(() => {
    engine = new IntentEngine(config, () => 0.8);
  });

  it('WAIT_CLOSED → APPROACH → CANDIDATE → ROAR', () => {
    driveToApproach(engine);

    let update = engine.update(sample(320, 0.6), 0.6);
    expect(update.state).toBe(IntentState.CANDIDATE);

    update = engine.update(sample(440, 0.6), 0.8);
    expect(update.state).toBe(IntentState.ROAR);
    expect(update.event?.type).toBe('ROAR');
    expect(update.event?.p).toBe(0.8);
    expect(update.event?.t).toBe(320);
    expect(update.event?.source).toBe('mouth');
    expect(engine.isLocked()).toBe(true);
  });

  it('CANDIDATE 掉回 O_ON-0.10 以下 → APPROACH，不触发', () => {
    driveToApproach(engine);
    expect(engine.update(sample(320, 0.6), 0.5).state).toBe(IntentState.CANDIDATE);
    const update = engine.update(sample(380, 0.3), 0.55);
    expect(update.state).toBe(IntentState.APPROACH);
    expect(update.event).toBeUndefined();
  });

  it('p 到 1 → LATE', () => {
    driveToApproach(engine);
    const update = engine.update(sample(320, 0.5), 1);
    expect(update.state).toBe(IntentState.LATE);
    expect(update.event?.type).toBe('LATE');
    expect(update.event?.p).toBe(1);
  });

  it('人脸无效超过 LOST_PAUSE_MS → PAUSED，恢复有效 RESUME_MS 后回到原状态', () => {
    driveToApproach(engine);
    expect(engine.update(sample(400, null, false), 0.3).state).toBe(IntentState.APPROACH);
    const paused = engine.update(sample(700, null, false), 0.3);
    expect(paused.state).toBe(IntentState.PAUSED);
    expect(paused.paused).toBe(true);

    expect(engine.update(sample(800, 0.1, true), 0.3).state).toBe(IntentState.PAUSED);
    const resumed = engine.update(sample(1300, 0.1, true), 0.3);
    expect(resumed.state).toBe(IntentState.APPROACH);
    expect(engine.totalPausedMs).toBe(600);
  });

  it('PAUSED 累计超过 ABORT_MS → ABORT', () => {
    driveToApproach(engine);
    engine.update(sample(400, null, false), 0.3);
    expect(engine.update(sample(700, null, false), 0.3).state).toBe(IntentState.PAUSED);
    const aborted = engine.update(sample(3700, null, false), 0.3);
    expect(aborted.state).toBe(IntentState.ABORT);
    expect(aborted.event?.type).toBe('ABORT');
    expect(engine.isLocked()).toBe(true);
  });

  it('LATENCY_COMP_MS 只改判定时刻，不改候选开始', () => {
    const latencyEngine = new IntentEngine({ ...config, LATENCY_COMP_MS: 100 }, () => 0.92);
    driveToApproach(latencyEngine);
    latencyEngine.update(sample(320, 0.6), 0.7);
    const update = latencyEngine.update(sample(440, 0.6), 0.92);
    expect(update.state).toBe(IntentState.ROAR);
    expect(update.event?.t).toBe(220);
    expect(update.event?.p).toBeCloseTo(0.92, 10);
  });

  it('mouthAhEvent 可作为兜底触发源', () => {
    driveToApproach(engine);
    const update = engine.update(
      { t: 320, faceValid: true, o: null, mouthAhEvent: true },
      0.7,
    );
    expect(update.state).toBe(IntentState.CANDIDATE);
    const roared = engine.update(
      { t: 440, faceValid: true, o: null, mouthAhEvent: true },
      0.8,
    );
    expect(roared.state).toBe(IntentState.ROAR);
    expect(roared.event?.source).toBe('mouthAh');
  });
});
