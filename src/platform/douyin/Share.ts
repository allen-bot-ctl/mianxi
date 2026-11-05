import type { Share, ShareOptions } from '../types';
import { getTT } from './runtime';

export interface DouyinShareConfig {
  title: string;
  hashtags: string[];
  videoTitleTemplate: string;
  channel: string;
}

/** 必须由用户点击回调触发。 */
export class DouyinShare implements Share {
  constructor(private readonly config: DouyinShareConfig) {}

  shareVideo(options: ShareOptions): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const tt = getTT();
        tt.shareAppMessage({
          channel: this.config.channel,
          title: this.config.title,
          query: `from=video&s=${options.score}`,
          extra: {
            videoPath: options.videoPath,
            hashtag_list: this.config.hashtags,
            videoTopics: this.config.hashtags,
            video_title: this.config.videoTitleTemplate.replace('{n}', String(options.n)),
            withVideoId: true,
          },
          success: () => resolve(true),
          fail: () => resolve(false),
        });
      } catch (error) {
        console.warn('[Share] shareAppMessage failed', error);
        resolve(false);
      }
    });
  }

  saveVideoToAlbum(videoPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const tt = getTT();
        tt.saveVideoToPhotosAlbum({
          filePath: videoPath,
          success: () => resolve(true),
          fail: () => resolve(false),
        });
      } catch (error) {
        console.warn('[Share] saveVideoToPhotosAlbum failed', error);
        resolve(false);
      }
    });
  }
}
