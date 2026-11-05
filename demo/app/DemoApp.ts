import { tunables, type Tunables } from '../../src/config';
import { FlowController, type SceneId } from '../../src/flow';
import { Telemetry, TelemetryEvents } from '../../src/telemetry';
import type { RoundResult } from '../../src/game';
import { DemoInput } from './input';
import type { DemoContext, DemoFlowFlags } from './context';
import type { DemoScene } from './Scene';
import { DemoCameraSource } from '../platform/DemoCameraSource';
import { DemoFaceSource } from '../platform/DemoFaceSource';
import { DemoRecorder } from '../platform/DemoRecorder';
import { DemoShare } from '../platform/DemoShare';
import { DemoStorage } from '../platform/DemoStorage';
import { HomeScene } from '../scenes/HomeScene';
import { PrivacyScene } from '../scenes/PrivacyScene';
import { FaceCheckScene } from '../scenes/FaceCheckScene';
import { CalibrationScene } from '../scenes/CalibrationScene';
import { CountdownScene } from '../scenes/CountdownScene';
import { GameScene } from '../scenes/GameScene';
import { EndingScene } from '../scenes/EndingScene';
import { ResultScene } from '../scenes/ResultScene';
import { SettingsScene } from '../scenes/SettingsScene';

export class DemoApp implements DemoContext {
  readonly config: Tunables = tunables;
  readonly telemetry = new Telemetry({ echo: false });
  readonly storage = new DemoStorage();
  readonly camera: DemoCameraSource;
  readonly faceSource = new DemoFaceSource(tunables);
  readonly recorder: DemoRecorder;
  readonly share = new DemoShare(tunables);
  readonly input = new DemoInput();
  readonly flow = new FlowController();
  readonly flags: DemoFlowFlags = {
    afterCalibration: false,
    faceCheckNext: 'S5',
    calibrationReturn: 'play',
    privacyReturn: 'S3',
  };
  readonly fromVideoScore: number | null;

  roundResult: RoundResult | null = null;
  roundAborted = false;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private logicalWidth = 360;
  private logicalHeight = 640;
  private dpr = 1;
  private rafId: number | null = null;
  private lastFrameAt = 0;
  private noticeText: string | null = null;
  private noticeUntil = 0;
  private resizeObserver: ResizeObserver | null = null;
  private hiddenPaused = false;
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器不支持 Canvas 2D。');
    this.ctx = ctx;

    const params = new URLSearchParams(window.location.search);
    const fromVideo = params.get('from') === 'video';
    const rawScore = Number(params.get('s'));
    this.fromVideoScore =
      fromVideo && Number.isFinite(rawScore) && rawScore >= 0 ? Math.round(rawScore) : null;

    const allowFallback = params.get('demoMock') === '1';
    this.camera = new DemoCameraSource({ allowFallback });
    this.recorder = new DemoRecorder(canvas);

    this.registerScenes();
    this.bindEvents();
    this.resize();
    this.flow.goTo('S1');
    this.telemetry.emit(TelemetryEvents.appOpen, {
      from_video: fromVideo ? 1 : 0,
    });
  }

  get width(): number {
    return this.logicalWidth;
  }

  get height(): number {
    return this.logicalHeight;
  }

  start(): void {
    if (this.rafId !== null) return;
    this.lastFrameAt = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.camera.stop();
    this.faceSource.stop();
    this.recorder.dispose();
    this.unbindEvents();
  }

  goTo(id: SceneId): void {
    this.input.reset();
    this.flow.goTo(id);
  }

  setNotice(text: string, durationMs = 3000): void {
    this.noticeText = text;
    this.noticeUntil = performance.now() + durationMs;
  }

  getNotice(): string | null {
    if (this.noticeText && performance.now() >= this.noticeUntil) {
      this.noticeText = null;
    }
    return this.noticeText;
  }

  private readonly loop = (): void => {
    if (this.destroyed) return;
    const now = performance.now();
    const dt = Math.min(100, Math.max(0, now - this.lastFrameAt));
    this.lastFrameAt = now;
    this.flow.update(dt);

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
    this.flow.render(ctx);

    this.rafId = requestAnimationFrame(this.loop);
  };

  private registerScenes(): void {
    this.flow.register(new HomeScene(this));
    this.flow.register(new PrivacyScene(this));
    this.flow.register(new FaceCheckScene(this));
    this.flow.register(new CalibrationScene(this));
    this.flow.register(new CountdownScene(this));
    this.flow.register(new GameScene(this));
    this.flow.register(new EndingScene(this));
    this.flow.register(new ResultScene(this));
    this.flow.register(new SettingsScene(this));
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = rect.width > 0 ? rect.width : 360;
    const cssHeight = rect.height > 0 ? rect.height : 640;
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    this.logicalWidth = cssWidth;
    this.logicalHeight = cssHeight;
    this.dpr = dpr;
    const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
    const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
  }

  private toCanvas(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * this.logicalWidth,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * this.logicalHeight,
    };
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.canvas.setPointerCapture?.(event.pointerId);
    const point = this.toCanvas(event);
    (this.flow.scene as DemoScene | null)?.onPointerDown?.(point.x, point.y);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const point = this.toCanvas(event);
    (this.flow.scene as DemoScene | null)?.onPointerMove?.(point.x, point.y);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const point = this.toCanvas(event);
    (this.flow.scene as DemoScene | null)?.onPointerUp?.(point.x, point.y);
    try {
      this.canvas.releasePointerCapture?.(event.pointerId);
    } catch {
      // ignore
    }
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'KeyW'].includes(event.code)) {
      event.preventDefault();
    }
    (this.flow.scene as DemoScene | null)?.onKeyDown?.(event);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    (this.flow.scene as DemoScene | null)?.onKeyUp?.(event);
  };

  private readonly onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private readonly onVisibility = (): void => {
    if (document.hidden) {
      if (this.recorder.isRecording && !this.recorder.isPaused) {
        this.recorder.pause();
        this.hiddenPaused = true;
      }
      return;
    }
    if (this.hiddenPaused) {
      this.recorder.resume();
      this.hiddenPaused = false;
    }
  };

  private readonly onResize = (): void => {
    this.resize();
  };

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas);
    }
  }

  private unbindEvents(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
