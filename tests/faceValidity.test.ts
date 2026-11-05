import { describe, expect, it } from 'vitest';
import { tunables } from '../src/config';
import { evaluateFaceValidity } from '../src/core/signal/faceValidity';
import type { FaceFrame } from '../src/types';

function frame(overrides: Partial<FaceFrame> = {}): FaceFrame {
  return {
    t: 0,
    found: true,
    score: 0.9,
    bbox: { x: 100, y: 100, w: 400, h: 400 },
    mouth: [],
    pitch: 0,
    yaw: 0,
    roll: 0,
    ...overrides,
  };
}

const config = tunables.face;
const canvasWidth = 1000;

describe('faceValidity 边界', () => {
  it('found 且有分数', () => {
    expect(evaluateFaceValidity(frame(), canvasWidth, config).valid).toBe(true);
    expect(evaluateFaceValidity(frame({ found: false }), canvasWidth, config).reason).toBe(
      'not_found',
    );
  });

  it('score 0.6 通过，低于 0.6 不通过', () => {
    expect(evaluateFaceValidity(frame({ score: 0.6 }), canvasWidth, config).valid).toBe(true);
    expect(
      evaluateFaceValidity(frame({ score: 0.599 }), canvasWidth, config).reason,
    ).toBe('low_score');
  });

  it('脸宽 28% 与 80% 为闭区间', () => {
    expect(
      evaluateFaceValidity(frame({ bbox: { x: 0, y: 0, w: 280, h: 400 } }), canvasWidth, config)
        .valid,
    ).toBe(true);
    expect(
      evaluateFaceValidity(frame({ bbox: { x: 0, y: 0, w: 800, h: 400 } }), canvasWidth, config)
        .valid,
    ).toBe(true);
    expect(
      evaluateFaceValidity(frame({ bbox: { x: 0, y: 0, w: 279, h: 400 } }), canvasWidth, config)
        .reason,
    ).toBe('too_small');
    expect(
      evaluateFaceValidity(frame({ bbox: { x: 0, y: 0, w: 801, h: 400 } }), canvasWidth, config)
        .reason,
    ).toBe('too_large');
  });

  it('|yaw|、|pitch| 25 为闭区间', () => {
    expect(evaluateFaceValidity(frame({ yaw: 25 }), canvasWidth, config).valid).toBe(true);
    expect(evaluateFaceValidity(frame({ yaw: -25 }), canvasWidth, config).valid).toBe(true);
    expect(evaluateFaceValidity(frame({ yaw: 25.1 }), canvasWidth, config).reason).toBe('yaw');
    expect(evaluateFaceValidity(frame({ pitch: 25 }), canvasWidth, config).valid).toBe(true);
    expect(evaluateFaceValidity(frame({ pitch: -25 }), canvasWidth, config).valid).toBe(true);
    expect(evaluateFaceValidity(frame({ pitch: -25.1 }), canvasWidth, config).reason).toBe(
      'pitch',
    );
  });

  it('非法 bbox 不通过', () => {
    expect(
      evaluateFaceValidity(
        frame({ bbox: { x: 0, y: 0, w: Number.NaN, h: 10 } }),
        canvasWidth,
        config,
      ).reason,
    ).toBe('bad_bbox');
  });
});
