import type { SceneId } from '../../src/flow';
import type { RoundResult } from '../../src/game';
import { TelemetryEvents } from '../../src/telemetry';
import type { DemoContext } from '../app/context';
import type { DemoScene } from '../app/Scene';
import {
  COLORS,
  drawBackdrop,
  drawButton,
  drawCenteredText,
  drawPanel,
  drawWrappedText,
  findButton,
  type DemoButton,
  type UiRect,
} from '../app/canvas';
import { readBestScore, writeBestScore } from '../app/persistence';

const RESULT_LABEL: Record<string, string> = {
  too_early: '太早',
  repel: '吼退',
  perfect: '完美',
  too_late: '被扑',
};

const RESULT_COLOR: Record<string, string> = {
  too_early: COLORS.red,
  repel: COLORS.green,
  perfect: COLORS.gold,
  too_late: COLORS.muted,
};

export class ResultScene implements DemoScene {
  readonly id: SceneId = 'S8';
  private result: RoundResult | null = null;
  private aborted = false;
  private best = 0;
  private url: string | null = null;
  private recordError: string | null = null;
  private buttons: DemoButton[] = [];
  private notice: string | null = null;
  private noticeUntil = 0;

  constructor(private readonly ctx: DemoContext) {}

  enter(): void {
    this.result = this.ctx.roundResult;
    this.aborted = this.ctx.roundAborted || !!this.result?.aborted;
    this.best = readBestScore(this.ctx.storage, this.ctx.config);
    if (this.result && !this.aborted && this.result.score > this.best) {
      this.best = this.result.score;
      writeBestScore(this.ctx.storage, this.ctx.config, this.best);
    }

    this.url = this.ctx.recorder.getUrl();
    this.recordError = this.ctx.recorder.getError();
    this.notice = null;
    this.noticeUntil = 0;
    this.ctx.input.reset();
    this.ctx.telemetry.emit(TelemetryEvents.roundEnd, {
      score: this.result?.score ?? 0,
      aborted: this.aborted ? 1 : 0,
    });
  }

  exit(): void {
    this.ctx.input.reset();
  }

  update(_dtMs: number): void {
    if (!this.url) {
      this.url = this.ctx.recorder.getUrl();
      this.recordError = this.ctx.recorder.getError();
    }
    if (this.notice && performance.now() >= this.noticeUntil) this.notice = null;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const width = this.ctx.width;
    const height = this.ctx.height;
    drawBackdrop(ctx, width, height);

    const panel: UiRect = {
      x: width * 0.06,
      y: height * 0.05,
      w: width * 0.88,
      h: height * 0.62,
    };
    drawPanel(ctx, panel, 22);

    const result = this.result;
    const score = result?.score ?? 0;
    const maxScore = this.ctx.config.schedule.creatures.length * this.ctx.config.score.creatureMax;

    drawCenteredText(
      ctx,
      this.aborted ? '本局作废' : '本局结果',
      width / 2,
      panel.y + 30,
      '14px sans-serif',
      this.aborted ? COLORS.red : COLORS.muted,
    );
    drawCenteredText(
      ctx,
      `${score} / ${maxScore}`,
      width / 2,
      panel.y + 92,
      `bold ${Math.round(Math.min(width * 0.16, 68))}px sans-serif`,
      COLORS.gold,
    );
    drawCenteredText(
      ctx,
      result?.title ?? '糊了一脸',
      width / 2,
      panel.y + 145,
      `bold ${Math.round(Math.min(width * 0.065, 30))}px sans-serif`,
      COLORS.ink,
    );

    if (this.aborted) {
      drawCenteredText(
        ctx,
        abortText(result?.abortReason),
        width / 2,
        panel.y + 185,
        '15px sans-serif',
        COLORS.red,
      );
    } else if (!this.url) {
      drawCenteredText(
        ctx,
        this.recordError ?? '正在生成成片…',
        width / 2,
        panel.y + 185,
        '14px sans-serif',
        this.recordError ? COLORS.red : COLORS.muted,
      );
    } else {
      drawCenteredText(
        ctx,
        '成片已就绪，可下载',
        width / 2,
        panel.y + 185,
        '14px sans-serif',
        COLORS.green,
      );
    }

    const results = result?.results ?? [];
    const rowTop = panel.y + 220;
    results.forEach((item, index) => {
      const y = rowTop + index * 34;
      const color = RESULT_COLOR[item.result] ?? COLORS.muted;
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(panel.x + 40, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.ink;
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`扑扑 ${index + 1} · ${item.type}`, panel.x + 56, y);
      ctx.fillStyle = color;
      ctx.textAlign = 'right';
      ctx.fillText(
        `${RESULT_LABEL[item.result] ?? item.result} +${item.score}  p=${item.p.toFixed(2)}`,
        panel.x + panel.w - 26,
        y,
      );
      ctx.restore();
    });

    ctx.save();
    ctx.fillStyle = COLORS.muted;
    ctx.font = '12px sans-serif';
    drawWrappedText(
      ctx,
      `发布话题（只读）：${this.ctx.share.topics}\n视频标题：${this.ctx.share.videoTitleFor(repelCount(results))}`,
      panel.x + 26,
      panel.y + panel.h - 54,
      panel.w - 52,
      18,
      2,
    );
    ctx.restore();

    drawCenteredText(
      ctx,
      `本地最好：${this.best} / ${maxScore} 分`,
      width / 2,
      height * 0.69,
      '13px sans-serif',
      COLORS.muted,
    );

    // 按钮：有录屏才提供下载；本局作废不提供成片。
    const canDownload = !this.aborted && !!this.url;
    const primaryY = height * 0.735;
    const primaryRect = {
      x: width * 0.15,
      y: primaryY,
      w: width * 0.7,
      h: Math.max(50, height * 0.068),
    };
    const secondaryRect = {
      x: width * 0.15,
      y: primaryY + Math.max(62, height * 0.082),
      w: width * 0.7,
      h: Math.max(46, height * 0.06),
    };
    const homeRect = {
      x: width * 0.28,
      y: secondaryRect.y + Math.max(56, height * 0.074),
      w: width * 0.44,
      h: Math.max(38, height * 0.048),
    };

    this.buttons = [];
    if (canDownload) {
      this.buttons.push({ id: 'download', label: '下载成片', rect: primaryRect, kind: 'primary' });
      this.buttons.push({ id: 'replay', label: '再来一局', rect: secondaryRect, kind: 'secondary' });
    } else {
      this.buttons.push({ id: 'replay', label: '再来一局', rect: primaryRect, kind: 'primary' });
    }
    this.buttons.push({ id: 'home', label: '返回首页', rect: homeRect, kind: 'ghost' });
    for (const button of this.buttons) drawButton(ctx, button);

    if (this.notice) {
      drawCenteredText(
        ctx,
        this.notice,
        width / 2,
        height * 0.98,
        '12px sans-serif',
        COLORS.green,
      );
    }
  }

  onPointerDown(x: number, y: number): void {
    const button = findButton(this.buttons, x, y);
    if (!button) return;
    if (button.id === 'download') {
      void this.download();
      return;
    }
    if (button.id === 'replay') {
      this.ctx.telemetry.emit(TelemetryEvents.replayTap);
      this.ctx.flags.afterCalibration = false;
      this.ctx.roundResult = null;
      this.ctx.goTo('S3');
      return;
    }
    if (button.id === 'home') {
      this.ctx.roundResult = null;
      this.ctx.goTo('S1');
    }
  }

  tap(x: number, y: number): void {
    this.onPointerDown(x, y);
  }

  private async download(): Promise<void> {
    if (!this.url) return;
    this.ctx.telemetry.emit(TelemetryEvents.shareTap);
    const ok = await this.ctx.share.shareVideo({
      score: this.result?.score ?? 0,
      n: repelCount(this.result?.results ?? []),
      videoPath: this.url,
    });
    this.ctx.telemetry.emit(ok ? TelemetryEvents.shareSuccess : TelemetryEvents.shareFail, {
      code: ok ? 0 : 1,
    });
    this.notice = ok ? '已开始下载成片' : '下载失败，可以再点一次';
    this.noticeUntil = performance.now() + 2600;
  }
}

function repelCount(results: ReadonlyArray<{ result: string }>): number {
  return results.filter((item) => item.result === 'repel' || item.result === 'perfect').length;
}

function abortText(reason: string | undefined): string {
  if (reason === 'face_lost_too_long') return '人脸离开太久，本局作废';
  return reason ? `本局作废：${reason}` : '本局作废';
}
