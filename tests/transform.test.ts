import { describe, expect, it } from 'vitest';
import { createViewTransform } from '../src/core/signal/transform';

describe('ViewTransform：画面与坐标共用镜像/裁剪', () => {
  it('cover：等比铺满并居中', () => {
    const transform = createViewTransform(100, 200, 200, 200, true);
    expect(transform.scale).toBe(2);
    expect(transform.dx).toBe(0);
    expect(transform.dy).toBe(-100);
    expect(transform.mapPoint({ x: 0, y: 0 })).toEqual({ x: 0, y: -100 });
    expect(transform.mapPoint({ x: 50, y: 100 })).toEqual({ x: 100, y: 100 });
  });

  it('未预镜像时围绕画布中心水平镜像', () => {
    const transform = createViewTransform(100, 200, 200, 400, false);
    expect(transform.mapPoint({ x: 0, y: 0 })).toEqual({ x: 200, y: 0 });
    expect(transform.mapPoint({ x: 100, y: 0 })).toEqual({ x: 0, y: 0 });

    const rect = transform.mapRect({ x: 10, y: 20, w: 30, h: 40 });
    expect(rect).toEqual({ x: 120, y: 40, w: 60, h: 80 });
  });
});
