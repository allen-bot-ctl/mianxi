import type { SceneId } from '../../src/flow';
import type { DemoContext } from '../app/context';
import type { DemoScene } from '../app/Scene';
import {
  COLORS,
  drawBackdrop,
  drawButton,
  drawCenteredText,
  drawPanel,
  findButton,
  type DemoButton,
  type UiRect,
} from '../app/canvas';
import {
  readBestScore,
  readPrivacyAccepted,
  readSkinMode,
  revokePrivacy,
  writeSkinMode,
  type DemoSkinMode,
} from '../app/persistence';

export class SettingsScene implements DemoScene {
  readonly id: SceneId = 'S9';
  private skin: DemoSkinMode = 'natural';
  private best = 0;
  private privacy = false;
  private notice: string | null = null;
  private noticeUntil = 0;
  private buttons: DemoButton[] = [];

  constructor(private readonly ctx: DemoContext) {}

  enter(): void {
    // 设置页不占用摄像头；重新校准/开始游戏时再启动。
    this.ctx.camera.stop();
    this.ctx.faceSource.stop();
    this.skin = readSkinMode(this.ctx.storage, this.ctx.config);
    this.best = readBestScore(this.ctx.storage, this.ctx.config);
    this.privacy = readPrivacyAccepted(this.ctx.storage, this.ctx.config);
    this.notice = null;
    this.noticeUntil = 0;
    this.ctx.input.reset();
  }

  exit(): void {
    this.ctx.input.reset();
  }

  update(_dtMs: number): void {
    if (this.notice && performance.now() >= this.noticeUntil) this.notice = null;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const width = this.ctx.width;
    const height = this.ctx.height;
    drawBackdrop(ctx, width, height);

    drawCenteredText(
      ctx,
      '设置',
      width / 2,
      34,
      `bold ${Math.round(Math.min(width * 0.075, 32))}px sans-serif`,
      COLORS.ink,
    );

    const panel: UiRect = {
      x: width * 0.07,
      y: height * 0.1,
      w: width * 0.86,
      h: height * 0.64,
    };
    drawPanel(ctx, panel, 22);

    ctx.save();
    ctx.fillStyle = COLORS.ink;
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('美颜档位', panel.x + 24, panel.y + 24);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '12px sans-serif';
    ctx.fillText('H5 没有平台美颜，只存档位', panel.x + 24, panel.y + 50);
    ctx.fillText(`本地最好：${this.best} / 6 分`, panel.x + 24, panel.y + 74);
    ctx.fillText(`隐私同意：${this.privacy ? '已同意' : '未同意'}`, panel.x + 24, panel.y + 96);
    ctx.restore();

    const buttonWidth = panel.w - 48;
    const x = panel.x + 24;
    const y = panel.y + 126;
    const gap = 58;
    this.buttons = [
      {
        id: 'skin',
        label: `美颜：${this.skin === 'natural' ? '自然' : '最低'}（点击切换）`,
        rect: { x, y, w: buttonWidth, h: 44 },
        kind: 'secondary',
      },
      {
        id: 'recalibrate',
        label: '重新校准',
        rect: { x, y: y + gap, w: buttonWidth, h: 44 },
        kind: 'secondary',
      },
      {
        id: 'privacy',
        label: '再看一次隐私说明',
        rect: { x, y: y + gap * 2, w: buttonWidth, h: 44 },
        kind: 'secondary',
      },
      {
        id: 'revoke',
        label: '撤回摄像头授权',
        rect: { x, y: y + gap * 3, w: buttonWidth, h: 44 },
        kind: 'ghost',
      },
      {
        id: 'back',
        label: '返回首页',
        rect: { x: width * 0.28, y: height * 0.8, w: width * 0.44, h: 44 },
        kind: 'primary',
      },
    ];
    for (const button of this.buttons) drawButton(ctx, button);

    drawCenteredText(
      ctx,
      '撤回后会清空本地「已同意」标志，下次进入重新显示告知卡',
      width / 2,
      height * 0.89,
      '11px sans-serif',
      COLORS.dim,
    );

    if (this.notice) {
      drawCenteredText(ctx, this.notice, width / 2, height * 0.94, '12px sans-serif', COLORS.green);
    }
  }

  onPointerDown(x: number, y: number): void {
    const button = findButton(this.buttons, x, y);
    if (!button) return;

    if (button.id === 'skin') {
      this.skin = this.skin === 'natural' ? 'minimum' : 'natural';
      writeSkinMode(this.ctx.storage, this.ctx.config, this.skin);
      this.ctx.camera.setBeautifyParam(this.ctx.config.beautify[this.skin]);
      this.showNotice(`已切换到${this.skin === 'natural' ? '自然' : '最低'}档（仅存档位）`);
      return;
    }

    if (button.id === 'recalibrate') {
      this.ctx.flags.calibrationReturn = 'settings';
      this.ctx.goTo('S4');
      return;
    }

    if (button.id === 'privacy') {
      this.ctx.flags.privacyReturn = 'S9';
      this.ctx.goTo('S2');
      return;
    }

    if (button.id === 'revoke') {
      revokePrivacy(this.ctx.storage, this.ctx.config);
      this.ctx.camera.stop();
      this.ctx.faceSource.stop();
      this.ctx.setNotice('已撤回摄像头授权，下次进入重新显示告知卡', 3600);
      this.ctx.goTo('S1');
      return;
    }

    if (button.id === 'back') this.ctx.goTo('S1');
  }

  tap(x: number, y: number): void {
    this.onPointerDown(x, y);
  }

  private showNotice(text: string): void {
    this.notice = text;
    this.noticeUntil = performance.now() + 2400;
  }
}
