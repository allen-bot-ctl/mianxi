import type { Tunables } from '../../src/config';
import type { Share, ShareOptions } from '../../src/platform';

/**
 * H5 没有抖音发布器：把 MediaRecorder 产出的 blob 下载成片。
 * 话题和视频标题只作为只读文案展示，不伪造发布成功。
 */
export class DemoShare implements Share {
  constructor(private readonly config: Tunables) {}

  async shareVideo(options: ShareOptions): Promise<boolean> {
    if (!options.videoPath) return false;
    return this.download(options.videoPath, `mian-xi-${options.score}fen.webm`);
  }

  async saveVideoToAlbum(videoPath: string): Promise<boolean> {
    return this.download(videoPath, 'mian-xi.webm');
  }

  get topics(): string {
    return this.config.share.hashtags.map((tag) => `#${tag}`).join(' ');
  }

  get videoTitle(): string {
    return this.config.share.videoTitleTemplate;
  }

  videoTitleFor(n: number): string {
    return this.config.share.videoTitleTemplate.replace('{n}', String(n));
  }

  private download(url: string, filename: string): boolean {
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return true;
    } catch {
      return false;
    }
  }
}
