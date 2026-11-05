import type { BeautifyParams, CameraSource, VideoLike } from '../../src/platform';

export interface DemoCameraOptions {
  /** 仅 demo：getUserMedia 失败时是否允许切到占位画面。默认关闭。 */
  allowFallback?: boolean;
}

/**
 * H5 相机适配：
 * navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }) → HTMLVideoElement。
 * 上屏仍然由根目录的 drawVideoCover / ViewTransform 负责 cover + 镜像。
 *
 * 这里不做任何识别，也不引入人脸推理库。getUserMedia 只在隐私卡同意后由 S3 调用。
 */
export class DemoCameraSource implements CameraSource {
  readonly isMock = false;

  private video: HTMLVideoElement | HTMLCanvasElement | null = null;
  private stream: MediaStream | null = null;
  private started = false;
  private fallback = false;
  private allowFallback: boolean;
  private beautify: BeautifyParams = [0.3, 0.4, 0, 0];
  private fallbackAnimation: number | null = null;
  private lastError: string | null = null;

  constructor(options: DemoCameraOptions = {}) {
    this.allowFallback = options.allowFallback ?? false;
  }

  async start(): Promise<VideoLike | null> {
    if (this.started && this.video) return this.video;

    if (!navigator.mediaDevices?.getUserMedia) {
      const message = window.isSecureContext
        ? '当前浏览器不支持摄像头 API。'
        : '浏览器只允许在 https 或 localhost 下访问摄像头。';
      this.lastError = message;
      if (this.allowFallback) return this.startFallback();
      throw new Error(message);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
        audio: false,
      });
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.setAttribute('playsinline', 'true');
      video.srcObject = stream;

      await waitForVideoReady(video);
      await video.play();

      this.stream = stream;
      this.video = video;
      this.started = true;
      this.fallback = false;
      this.lastError = null;
      this.setBeautifyParam(this.beautify);
      return this.video;
    } catch (error) {
      this.lastError = cameraErrorMessage(error);
      if (this.allowFallback) return this.startFallback();
      throw error instanceof Error ? error : new Error(this.lastError);
    }
  }

  stop(): void {
    if (this.fallbackAnimation !== null) {
      cancelAnimationFrame(this.fallbackAnimation);
      this.fallbackAnimation = null;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;

    const video = this.video;
    if (video && video instanceof HTMLVideoElement) {
      video.pause();
      video.srcObject = null;
    }
    this.video = null;
    this.started = false;
    this.fallback = false;
  }

  getVideo(): VideoLike | null {
    return this.video;
  }

  setBeautifyParam(params: BeautifyParams): void {
    this.beautify = [...params];
    // H5 没有平台美颜；这里只保留档位语义，不伪造美颜效果。
  }

  setAllowFallback(value: boolean): void {
    this.allowFallback = value;
  }

  get usingFallback(): boolean {
    return this.fallback;
  }

  get errorMessage(): string | null {
    return this.lastError;
  }

  private startFallback(): VideoLike {
    if (this.fallback && this.video) return this.video;
    const canvas = document.createElement('canvas');
    canvas.width = 540;
    canvas.height = 960;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const draw = (time: number): void => {
        const { width, height } = canvas;
        // 上屏会统一做自拍镜像；占位画面这里先反着画，让文字在镜像后仍可读。
        ctx.save();
        ctx.translate(width, 0);
        ctx.scale(-1, 1);

        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#18233a');
        gradient.addColorStop(0.55, '#1e2d4b');
        gradient.addColorStop(1, '#0b1220');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        const pulse = 0.5 + 0.5 * Math.sin(time / 900);
        ctx.fillStyle = `rgba(246,178,107,${0.12 + pulse * 0.08})`;
        ctx.beginPath();
        ctx.ellipse(width * 0.5, height * 0.47, width * 0.28, height * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(width * 0.5, height * 0.47, width * 0.3, height * 0.36, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('DEMO 占位画面', width / 2, height * 0.82);
        ctx.font = '16px sans-serif';
        ctx.fillText('不是真实摄像头', width / 2, height * 0.86);
        ctx.restore();

        this.fallbackAnimation = requestAnimationFrame(draw);
      };
      draw(0);
    }

    this.video = canvas;
    this.started = true;
    this.fallback = true;
    this.lastError = this.lastError ?? '使用占位画面';
    return canvas;
  }
}

function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 1 && video.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('error', onError);
    };
    const onReady = (): void => {
      cleanup();
      resolve();
    };
    const onError = (): void => {
      cleanup();
      reject(new Error('摄像头画面初始化失败。'));
    };
    video.addEventListener('loadedmetadata', onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

function cameraErrorMessage(error: unknown): string {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name: unknown }).name) : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return '没有摄像头授权就玩不了哦。请允许摄像头后重试。';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return '没有找到可用的摄像头。';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return '摄像头被其它程序占用了，关掉它再试。';
  }
  return error instanceof Error ? error.message : String(error);
}
