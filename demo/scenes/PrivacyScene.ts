import type { SceneId } from '../../src/flow';
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
} from '../app/canvas';
import { writePrivacyAccepted } from '../app/persistence';

const PRIVACY_TEXT =
  '· 摄像头画面只在你的手机上用来识别你有没有张嘴、脸在哪里。\n' +
  '· 我们不会上传、不会保存你的脸或任何画面。\n' +
  '· 每局会录一段视频，暂时存在你的手机里；只有你点「下载成片」时，它才会离开这个游戏。\n' +
  '· 你可以随时在设置里关闭摄像头授权。\n' +
  '· 未满 14 周岁，请在监护人同意后再玩。';

export class PrivacyScene implements DemoScene {
  readonly id: SceneId = 'S2';
  private buttons: DemoButton[] = [];

  constructor(private readonly ctx: DemoContext) {}

  enter(): void {
    this.ctx.telemetry.emit(TelemetryEvents.privacyShown);
  }

  exit(): void {
    // no-op
  }

  update(_dtMs: number): void {
    // no-op
  }

  render(ctx: CanvasRenderingContext2D): void {
    const width = this.ctx.width;
    const height = this.ctx.height;
    drawBackdrop(ctx, width, height);

    const panel = {
      x: width * 0.06,
      y: height * 0.06,
      w: width * 0.88,
      h: height * 0.66,
    };
    drawPanel(ctx, panel);

    ctx.save();
    ctx.fillStyle = COLORS.gold;
    ctx.font = `bold ${Math.round(Math.min(width * 0.052, 23))}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('开始前，告诉你', panel.x + 22, panel.y + 24);
    ctx.fillText('我们怎么用摄像头', panel.x + 22, panel.y + 54);

    ctx.fillStyle = COLORS.ink;
    ctx.font = '13px sans-serif';
    drawWrappedText(
      ctx,
      PRIVACY_TEXT,
      panel.x + 22,
      panel.y + 100,
      panel.w - 44,
      21,
    );

    ctx.fillStyle = COLORS.dim;
    ctx.font = '12px sans-serif';
    ctx.fillText('H5 演示版：同意后才会请求摄像头。', panel.x + 22, panel.y + panel.h - 34);
    ctx.restore();

    const primary = {
      x: width * 0.12,
      y: height * 0.76,
      w: width * 0.76,
      h: Math.max(54, height * 0.072),
    };
    const secondary = {
      x: width * 0.2,
      y: height * 0.86,
      w: width * 0.6,
      h: Math.max(44, height * 0.055),
    };
    this.buttons = [
      { id: 'agree', label: '同意并开始', rect: primary, kind: 'primary' },
      { id: 'decline', label: '暂不', rect: secondary, kind: 'secondary' },
    ];
    for (const button of this.buttons) drawButton(ctx, button);

    drawCenteredText(
      ctx,
      '每一局都能在结果页下载成片',
      width / 2,
      height * 0.95,
      '12px sans-serif',
      COLORS.dim,
    );
  }

  onPointerDown(x: number, y: number): void {
    const button = findButton(this.buttons, x, y);
    if (!button) return;
    if (button.id === 'agree') {
      writePrivacyAccepted(this.ctx.storage, this.ctx.config);
      this.ctx.telemetry.emit(TelemetryEvents.privacyAccept);
      this.ctx.goTo(this.ctx.flags.privacyReturn);
      return;
    }

    this.ctx.telemetry.emit(TelemetryEvents.privacyDecline);
    this.ctx.setNotice('没有摄像头就玩不了哦', 3200);
    this.ctx.goTo(this.ctx.flags.privacyReturn === 'S9' ? 'S9' : 'S1');
  }

  tap(x: number, y: number): void {
    this.onPointerDown(x, y);
  }
}
