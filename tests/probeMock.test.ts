import { describe, expect, it } from 'vitest';
import { tunables } from '../src/config';
import { FlowController, ProbeScene } from '../src/flow';
import { createHeadlessCanvas, MockCameraSource, MockFaceSource, MockStorage } from '../src/platform/mock';
import { Telemetry } from '../src/telemetry';

describe('无 tt 的 mock 探针', () => {
  it('用 mock 跑通场景切换、HUD 渲染与数值日志', async () => {
    const canvas = createHeadlessCanvas(360, 640);
    const ctx = canvas.getContext('2d');
    const storage = new MockStorage();
    const telemetry = new Telemetry();

    const probe = new ProbeScene({
      canvasWidth: 360,
      canvasHeight: 640,
      camera: new MockCameraSource(),
      faceSource: new MockFaceSource(),
      storage,
      telemetry,
      config: tunables,
    });

    const flow = new FlowController();
    flow.register(probe);
    flow.goTo('PROBE');
    await probe.start();
    expect(flow.current).toBe('PROBE');

    for (let index = 0; index < 6; index += 1) flow.update(16);
    await Promise.resolve();
    await Promise.resolve();

    expect(probe.rows.length).toBeGreaterThan(0);
    expect(() => flow.render(ctx)).not.toThrow();

    const log = JSON.parse(probe.getLogJson());
    expect(log.schema).toBe('mianxi_probe_log_v1');
    expect(log.rows[0].t).toBeTypeOf('number');
    expect(log.rows[0]).not.toHaveProperty('image');

    flow.goTo('PROBE');
    expect(flow.current).toBe('PROBE');
  });
});
