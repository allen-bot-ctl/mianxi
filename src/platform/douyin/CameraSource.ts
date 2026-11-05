import type { BeautifyParams, CameraSource, VideoLike } from '../types';
import { getTT } from './runtime';

/**
 * tt.createCamera + Camera.start('front', true)。
 * 真机实现骨架：没有 tt 时只在调用 start 时抛错，模块加载不崩。
 */
export class DouyinCameraSource implements CameraSource {
  readonly isMock = false;
  private camera: any = null;
  private video: VideoLike | null = null;
  private beautify: BeautifyParams = [0.3, 0.4, 0, 0];

  async start(): Promise<VideoLike | null> {
    const tt = getTT();
    this.camera = tt.createCamera();
    const started = await this.camera.start('front', true);
    // 官方签名返回 Promise<video>；兼容对象包一层的实现。
    this.video = started?.video ?? started ?? null;
    if (this.video?.focus) {
      try {
        this.video.focus();
      } catch {
        // 对焦失败不影响主流程
      }
    }
    // 必须在 start 返回后再次设置，确保美颜参数生效。
    this.setBeautifyParam(this.beautify);
    return this.video;
  }

  stop(): void {
    try {
      this.camera?.stop?.();
    } catch {
      // 忽略停止异常
    }
    this.camera = null;
    this.video = null;
  }

  getVideo(): VideoLike | null {
    return this.video;
  }

  setBeautifyParam(params: BeautifyParams): void {
    this.beautify = [...params];
    try {
      this.camera?.setBeautifyParam?.(...params);
    } catch (error) {
      console.warn('[CameraSource] setBeautifyParam failed', error);
    }
  }
}
