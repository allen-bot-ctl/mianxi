import type { SceneId } from '../../src/flow';
import type { DemoContext } from '../app/context';
import type { DemoScene } from '../app/Scene';
import {
  COLORS,
  drawCenteredText,
} from '../app/canvas';
import { drawCameraLayer, drawCameraPlaceholder, drawFaceOverlay } from '../app/live';

export class CountdownScene implements DemoScene {
  readonly id: SceneId = 'S5';
  private waitingRecorder = true;
  private started = false;
  private elapsed = 0;
  private done = false;

  constructor(private readonly ctx: DemoContext) {}

  enter(): void {
    this.waitingRecorder = true;
    this.started = false;
    this.elapsed = 0;
    this.done = false;
    this.ctx.input.reset();
    this.ctx.faceSource.setMouthLevel(0);

    if (this.ctx.recorder.isRecording) {
      this.waitingRecorder = false;
      this.started = true;
      return;
    }

    this.ctx.recorder.onStart(() => {
      this.waitingRecorder = false;
      this.started = true;
    });
    this.ctx.recorder.start({
      durationS: this.ctx.config.recording.durationS,
      isMarkOpen: this.ctx.config.recording.isMarkOpen,
      frameRate: this.ctx.config.recording.frameRate,
      locLeft: 0,
      locTop: 0,
    });
  }

  exit(): void {
    this.ctx.input.reset();
  }

  update(dtMs: number): void {
    if (this.done || this.waitingRecorder || !this.started) return;
    this.elapsed += dtMs;
    const total =
      this.ctx.config.render.countdownFrom * this.ctx.config.render.countdownStepMs;
    if (this.elapsed >= total) {
      this.done = true;
      this.ctx.goTo('S6');
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const width = this.ctx.width;
    const height = this.ctx.height;

    if (this.ctx.camera.getVideo()) {
      drawCameraLayer(ctx, this.ctx.camera, this.ctx.config, width, height);
      ctx.fillStyle = 'rgba(4,8,16,0.5)';
      ctx.fillRect(0, 0, width, height);
    } else {
      drawCameraPlaceholder(ctx, width, height, '正在准备录制…');
    }

    drawFaceOverlay(ctx, this.ctx.faceSource, width, height, {
      showMouthPoints: false,
      bboxColor: 'rgba(255,255,255,0.5)',
    });

    // 录制指示
    ctx.save();
    ctx.fillStyle = COLORS.red;
    ctx.beginPath();
    ctx.arc(width - 38, 34, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('录制中', width - 52, 34);
    ctx.restore();

    drawCenteredText(
      ctx,
      '准备…',
      width / 2,
      height * 0.3,
      '18px sans-serif',
      COLORS.muted,
    );

    const step = Math.max(1, this.ctx.config.render.countdownStepMs);
    const from = Math.max(1, this.ctx.config.render.countdownFrom);
    const index = this.waitingRecorder ? 0 : Math.floor(this.elapsed / step);
    const number = Math.max(1, from - index);
    const pulse = this.waitingRecorder ? 0.9 : 1 + 0.08 * Math.sin((this.elapsed % step) / step * Math.PI);

    ctx.save();
    ctx.translate(width / 2, height * 0.46);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = COLORS.gold;
    ctx.font = `bold ${Math.round(Math.min(width * 0.3, 128))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.waitingRecorder ? '…' : String(number), 0, 0);
    ctx.restore();

    drawCenteredText(
      ctx,
      '闭上嘴，准备……',
      width / 2,
      height * 0.68,
      `bold ${Math.round(Math.min(width * 0.05, 21))}px sans-serif`,
      COLORS.ink,
    );

    drawCenteredText(
      ctx,
      '倒计时与片尾卡都会录进成片',
      width / 2,
      height * 0.78,
      '12px sans-serif',
      COLORS.dim,
    );
  }
}
