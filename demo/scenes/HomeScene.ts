import type { SceneId } from '../../src/flow';
import type { DemoContext } from '../app/context';
import type { DemoScene } from '../app/Scene';
import {
  COLORS,
  drawBackdrop,
  drawButton,
  drawCenteredText,
  findButton,
  type DemoButton,
} from '../app/canvas';
import { readBestScore, readPrivacyAccepted } from '../app/persistence';

export class HomeScene implements DemoScene {
  readonly id: SceneId = 'S1';
  private buttons: DemoButton[] = [];
  private best = 0;
  private notice: string | null = null;

  constructor(private readonly ctx: DemoContext) {}

  enter(): void {
    // 离开游戏/结果页回首页时释放摄像头；下次 S3 会重新请求。
    this.ctx.camera.stop();
    this.ctx.faceSource.stop();
    this.best = readBestScore(this.ctx.storage, this.ctx.config);
    this.notice = this.ctx.getNotice();
  }

  exit(): void {
    // no-op
  }

  update(_dtMs: number): void {
    this.notice = this.ctx.getNotice();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const width = this.ctx.width;
    const height = this.ctx.height;
    drawBackdrop(ctx, width, height);

    // 海报：三个圆滚滚的扑扑占位。
    const posterY = height * 0.3;
    const posterRadius = Math.min(width, height) * 0.07;
    const poster = [
      { x: width * 0.34, y: posterY, r: posterRadius * 0.9, color: '#f6b26b' },
      { x: width * 0.5, y: posterY - posterRadius * 0.55, r: posterRadius, color: '#ffcf7a' },
      { x: width * 0.66, y: posterY, r: posterRadius * 0.9, color: '#f6b26b' },
    ];
    for (const item of poster) {
      ctx.save();
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath();
      ctx.arc(item.x - item.r * 0.3, item.y - item.r * 0.15, item.r * 0.1, 0, Math.PI * 2);
      ctx.arc(item.x + item.r * 0.3, item.y - item.r * 0.15, item.r * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(item.x, item.y + item.r * 0.18, item.r * 0.16, 0, Math.PI);
      ctx.strokeStyle = '#3a2a1a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    drawCenteredText(
      ctx,
      '面戏 · 吼退扑扑',
      width / 2,
      height * 0.12,
      `bold ${Math.round(Math.min(width * 0.085, 40))}px sans-serif`,
      COLORS.ink,
    );
    drawCenteredText(
      ctx,
      '张大嘴，吼退扑扑',
      width / 2,
      height * 0.44,
      `bold ${Math.round(Math.min(width * 0.055, 24))}px sans-serif`,
      COLORS.gold,
    );
    drawCenteredText(
      ctx,
      '一只只有一次机会',
      width / 2,
      height * 0.49,
      '15px sans-serif',
      COLORS.muted,
    );

    if (this.best > 0) {
      drawCenteredText(
        ctx,
        `本地最好：${this.best} / 6 分`,
        width / 2,
        height * 0.56,
        '15px sans-serif',
        COLORS.muted,
      );
    }

    if (this.ctx.fromVideoScore !== null) {
      drawCenteredText(
        ctx,
        `TA 拿了 ${this.ctx.fromVideoScore} 分，你来`,
        width / 2,
        height * 0.61,
        'bold 16px sans-serif',
        COLORS.green,
      );
    }

    const startRect = {
      x: width * 0.19,
      y: height * 0.68,
      w: width * 0.62,
      h: Math.max(54, height * 0.075),
    };
    const gearRect = {
      x: width - 62,
      y: 16,
      w: 46,
      h: 46,
    };
    this.buttons = [
      { id: 'start', label: '开始', rect: startRect, kind: 'primary' },
      { id: 'settings', label: '⚙', rect: gearRect, kind: 'ghost' },
    ];
    for (const button of this.buttons) drawButton(ctx, button);

    drawCenteredText(
      ctx,
      '点击「开始」→ 隐私说明 → 对脸检查',
      width / 2,
      height * 0.8,
      '13px sans-serif',
      COLORS.dim,
    );

    if (this.notice) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,140,140,0.16)';
      ctx.fillRect(width * 0.08, height * 0.86, width * 0.84, 34);
      ctx.fillStyle = COLORS.red;
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.notice, width / 2, height * 0.86 + 17);
      ctx.restore();
    } else {
      drawCenteredText(
        ctx,
        'H5 演示版 · 不接抖音 · 不实现微信',
        width / 2,
        height * 0.91,
        '12px sans-serif',
        COLORS.dim,
      );
    }
  }

  onPointerDown(x: number, y: number): void {
    const button = findButton(this.buttons, x, y);
    if (!button) return;
    if (button.id === 'start') {
      if (readPrivacyAccepted(this.ctx.storage, this.ctx.config)) {
        this.ctx.goTo('S3');
      } else {
        this.ctx.flags.privacyReturn = 'S3';
        this.ctx.goTo('S2');
      }
      return;
    }
    if (button.id === 'settings') this.ctx.goTo('S9');
  }

  tap(x: number, y: number): void {
    this.onPointerDown(x, y);
  }
}
