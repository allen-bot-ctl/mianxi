import { describe, expect, it } from 'vitest';
import { tunables } from '../src/config';
import { HoutuiMode } from '../src/game/houtui';
import type { FaceFrame, Point } from '../src/types';

function mouthRect(width: number, height: number): Point[] {
  const corners: Point[] = [
    { x: 100, y: 100 },
    { x: 100 + width, y: 100 },
    { x: 100 + width, y: 100 + height },
    { x: 100, y: 100 + height },
  ];
  return Array.from({ length: 20 }, (_value, index) => corners[index % 4]!);
}

function frame(t: number, mouthHeight: number): FaceFrame {
  return {
    t,
    found: true,
    score: 0.95,
    bbox: { x: 90, y: 60, w: 180, h: 240 },
    mouth: mouthRect(100, mouthHeight),
    pitch: 0,
    yaw: 0,
    roll: 0,
  };
}

describe('HoutuiMode 最小闭环', () => {
  it('闭嘴开始逼近后，张嘴事件按当时 p 判定', () => {
    const mode = new HoutuiMode(tunables);
    mode.prepare({
      canvasWidth: 360,
      canvasHeight: 640,
      calibration: { base: 0.1, peak: 0.6 },
      detectHz: 30,
      rngSeed: 1,
    });

    // 闭嘴 300ms：r_raw=0.1 → o=0。
    mode.onFaceFrame(frame(0, 10));
    mode.onFaceFrame(frame(150, 10));
    mode.onFaceFrame(frame(300, 10));

    // 1 号直冲推进到 p≈0.90（完美窗口）。
    mode.update(2850);

    mode.onFaceFrame(frame(320, 50)); // r_raw=0.5 → o=0.8，进入 CANDIDATE
    mode.onFaceFrame(frame(440, 50)); // 保持 120ms → ROAR

    const result = mode.result();
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.result).toBe('perfect');
    expect(result.results[0]!.score).toBe(2);
    expect(result.score).toBe(2);
    expect(result.title).toBe('差点吓住');
  });
});
