import type { BeautifyParams, CameraSource, VideoLike } from '../types';

/** 本地/单测用假相机：只提供尺寸，不生成任何图像。 */
export class MockCameraSource implements CameraSource {
  readonly isMock = true;
  private video: VideoLike;
  private started = false;

  constructor(
    private readonly width = 540,
    private readonly height = 960,
  ) {
    this.video = { videoWidth: width, videoHeight: height };
  }

  async start(): Promise<VideoLike | null> {
    this.started = true;
    return this.video;
  }

  stop(): void {
    this.started = false;
  }

  getVideo(): VideoLike | null {
    return this.started ? this.video : null;
  }

  setBeautifyParam(_params: BeautifyParams): void {
    // mock 不处理美颜
  }
}
