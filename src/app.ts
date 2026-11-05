import { tunables } from './config';
import { FlowController, ProbeScene, createSkeletonScenes } from './flow';
import { DouyinAuth, DouyinCameraSource, DouyinFaceSource, DouyinStorage, hasTT } from './platform/douyin';
import { createHeadlessCanvas, MockCameraSource, MockFaceSource, MockStorage } from './platform/mock';
import { Telemetry, TelemetryEvents } from './telemetry';

export interface AppRuntime {
  flow: FlowController;
  canvas: { width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D };
  ctx: CanvasRenderingContext2D;
  tick(dtMs: number): void;
  destroy(): void;
}

export interface BootstrapOptions {
  /** 单测/本地无 tt 时强制走 mock 探针。 */
  forceMock?: boolean;
}

export function bootstrap(options: BootstrapOptions = {}): AppRuntime | null {
  if (options.forceMock || !hasTT()) {
    if (!hasTT()) {
      console.info(
        '[mian-xi] tt 不可用：启动无头 mock 探针（只有 HUD/数值日志，不绘制假相机画面）。',
      );
    }
    return bootstrapMock();
  }

  const tt = (globalThis as any).tt;
  const canvas = tt.createCanvas();
  const system = readSystemInfo();
  canvas.width = system.width;
  canvas.height = system.height;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  const telemetry = new Telemetry({ echo: false });
  const flow = new FlowController();
  const storage = new DouyinStorage();

  const launch = readLaunchOptions();
  const isProbe = String(launch?.query?.probe ?? '') === '1';
  telemetry.emit(TelemetryEvents.appOpen, {
    from_video: launch?.query?.from === 'video' ? 1 : 0,
  });

  const probe = new ProbeScene({
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    camera: new DouyinCameraSource(),
    faceSource: new DouyinFaceSource(),
    storage,
    telemetry,
    config: tunables,
  });
  flow.register(probe);
  for (const scene of createSkeletonScenes(flow, telemetry)) flow.register(scene);
  flow.goTo(isProbe ? 'PROBE' : 'S1');

  const onTouch = (event: any): void => {
    const touch = event?.touches?.[0] ?? event?.changedTouches?.[0];
    if (!touch) return;
    flow.tap(Number(touch.clientX ?? touch.x ?? 0), Number(touch.clientY ?? touch.y ?? 0));
  };
  tt.onTouchStart?.(onTouch);

  let last = Date.now();
  let rafId: number | null = null;
  const raf =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (callback: (time: number) => void) => setTimeout(() => callback(Date.now()), 16) as unknown as number;

  const frame = (): void => {
    const now = Date.now();
    const dt = Math.min(100, Math.max(0, now - last));
    last = now;
    flow.update(dt);
    flow.render(ctx);
    rafId = raf(frame);
  };
  rafId = raf(frame);

  // Auth 在本轮只实例化；S2/S3 接入时使用。
  void new DouyinAuth();

  return {
    flow,
    canvas,
    ctx,
    tick(dtMs: number): void {
      flow.update(dtMs);
      flow.render(ctx);
    },
    destroy(): void {
      tt.offTouchStart?.(onTouch);
      if (rafId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId);
      }
    },
  };
}

/**
 * 无 tt 的本地 mock：不画假相机画面，只让探针场景/HUD/日志在无头 canvas 上跑通。
 * 正式真机探针仍用 DouyinCameraSource。
 */
export function bootstrapMock(width = 360, height = 640): AppRuntime {
  const canvas = createHeadlessCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const storage = new MockStorage();
  const telemetry = new Telemetry({ echo: false });
  const flow = new FlowController();

  const probe = new ProbeScene({
    canvasWidth: width,
    canvasHeight: height,
    camera: new MockCameraSource(),
    faceSource: new MockFaceSource(),
    storage,
    telemetry,
    config: tunables,
  });
  flow.register(probe);
  for (const scene of createSkeletonScenes(flow, telemetry)) flow.register(scene);
  flow.goTo('PROBE');

  const runtime: AppRuntime = {
    flow,
    canvas,
    ctx,
    tick(dtMs: number): void {
      flow.update(dtMs);
      flow.render(ctx);
    },
    destroy(): void {
      // no-op
    },
  };

  // 先跑两帧，让 HUD 与相机 mock 初始化。
  runtime.tick(16);
  runtime.tick(16);
  return runtime;
}

function readSystemInfo(): { width: number; height: number } {
  try {
    const tt = (globalThis as any).tt;
    const info = tt.getSystemInfoSync?.() ?? {};
    return {
      width: Number(info.windowWidth ?? info.screenWidth ?? 360),
      height: Number(info.windowHeight ?? info.screenHeight ?? 640),
    };
  } catch {
    return { width: 360, height: 640 };
  }
}

function readLaunchOptions(): any {
  try {
    const tt = (globalThis as any).tt;
    return tt.getLaunchOptionsSync?.() ?? null;
  } catch {
    return null;
  }
}
