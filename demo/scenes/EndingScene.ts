import type { SceneId } from '../../src/flow';
import type { DemoContext } from '../app/context';
import type { DemoScene } from '../app/Scene';
import {
  COLORS,
  drawBackdrop,
  drawCenteredText,
  drawPanel,
  type UiRect,
} from '../app/canvas';
import { drawCameraLayer, drawCameraPlaceholder } from '../app/live';

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

export class EndingScene implements DemoScene {
  readonly id: SceneId = 'S7';
  private elapsed = 0;
  private stopped = false;

  constructor(private readonly ctx: DemoContext) {}

  enter(): void {
    this.elapsed = 0;
    this.stopped = false;
    this.ctx.input.reset();
  }

  exit(): void {
    // no-op
  }

  update(dtMs: number): void {
    if (this.stopped) return;
    this.elapsed += dtMs;
    if (this.elapsed < this.ctx.config.render.endingCardMs) return;

    this.stopped = true;
    this.ctx.recorder.stop();
    this.ctx.goTo('S8');
  }

  render(ctx: CanvasRenderingContext2D): void {
    const width = this.ctx.width;
    const height = this.ctx.height;
    const result = this.ctx.roundResult;

    if (this.ctx.camera.getVideo()) {
      drawCameraLayer(ctx, this.ctx.camera, this.ctx.config, width, height);
      ctx.fillStyle = 'rgba(4,8,16,0.56)';
      ctx.fillRect(0, 0, width, height);
    } else {
      drawCameraPlaceholder(ctx, width, height, '片尾卡');
    }

    const panel: UiRect = {
      x: width * 0.07,
      y: height * 0.16,
      w: width * 0.86,
      h: height * 0.56,
    };
    drawPanel(ctx, panel, 24);

    drawCenteredText(
      ctx,
      '面戏 · 吼退扑扑',
      width / 2,
      panel.y + 34,
      '14px sans-serif',
      COLORS.muted,
    );

    const score = result?.score ?? 0;
    const maxScore = this.ctx.config.schedule.creatures.length * this.ctx.config.score.creatureMax;
    drawCenteredText(
      ctx,
      `${score} / ${maxScore}`,
      width / 2,
      panel.y + 105,
      `bold ${Math.round(Math.min(width * 0.18, 78))}px sans-serif`,
      COLORS.gold,
    );
    drawCenteredText(
      ctx,
      result?.title ?? '糊了一脸',
      width / 2,
      panel.y + 168,
      `bold ${Math.round(Math.min(width * 0.07, 32))}px sans-serif`,
      COLORS.ink,
    );

    const results = result?.results ?? [];
    const rowY = panel.y + 235;
    const rowGap = 52;
    results.forEach((item, index) => {
      const y = rowY + index * rowGap;
      const color = RESULT_COLOR[item.result] ?? COLORS.muted;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(panel.x + 24, y - 18, panel.w - 48, 38);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(panel.x + 46, y + 1, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.ink;
      ctx.font = '15px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`扑扑 ${index + 1} · ${item.type}`, panel.x + 66, y + 1);
      ctx.fillStyle = color;
      ctx.textAlign = 'right';
      ctx.fillText(`${RESULT_LABEL[item.result] ?? item.result} +${item.score}`, panel.x + panel.w - 30, y + 1);
      ctx.restore();
    });

    drawCenteredText(
      ctx,
      '你来吼一下',
      width / 2,
      panel.y + panel.h - 34,
      'bold 18px sans-serif',
      COLORS.green,
    );

    drawCenteredText(
      ctx,
      '面戏',
      width - 36,
      height - 28,
      '12px sans-serif',
      COLORS.dim,
    );
  }
}
