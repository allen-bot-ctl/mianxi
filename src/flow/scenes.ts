import { TelemetryEvents, type Telemetry } from '../telemetry';
import type { FlowController } from './FlowController';
import type { Scene, SceneId } from './Scene';

interface SceneMeta {
  title: string;
  detail: string;
  next: SceneId;
}

const META: Record<Exclude<SceneId, 'PROBE'>, SceneMeta> = {
  S1: { title: 'S1 首页', detail: '海报 / 开始 / 设置齿轮', next: 'S2' },
  S2: { title: 'S2 隐私告知卡', detail: '同意并开始 / 暂不', next: 'S3' },
  S3: { title: 'S3 对脸检查', detail: '全屏镜像画面 + 椭圆框 + 提示', next: 'S4' },
  S4: { title: 'S4 校准与教学', detail: '闭嘴 1s → 张嘴 1.5s → 教学扑扑', next: 'S5' },
  S5: { title: 'S5 倒计时', detail: '录屏 onStart 后 3-2-1', next: 'S6' },
  S6: { title: 'S6 游戏中', detail: '真人画面 / 游戏层 / HUD', next: 'S7' },
  S7: { title: 'S7 片尾卡', detail: '总分 / 称号 / 三只结果', next: 'S8' },
  S8: { title: 'S8 结果页', detail: '发布 / 再来一局 / 保存相册', next: 'S3' },
  S9: { title: 'S9 设置', detail: '美颜 / 重新校准 / 隐私 / 撤回授权', next: 'S1' },
};

export const SCENE_ORDER: Array<Exclude<SceneId, 'PROBE'>> = [
  'S1',
  'S2',
  'S3',
  'S4',
  'S5',
  'S6',
  'S7',
  'S8',
  'S9',
];

export class PlaceholderScene implements Scene {
  constructor(
    readonly id: Exclude<SceneId, 'PROBE'>,
    private readonly flow: FlowController,
    private readonly telemetry?: Telemetry,
  ) {}

  enter(): void {
    if (this.id === 'S2') this.telemetry?.emit(TelemetryEvents.privacyShown);
  }

  exit(): void {
    // no-op
  }

  update(_dtMs: number): void {
    // 占位场景没有动画
  }

  render(ctx: CanvasRenderingContext2D): void {
    const meta = META[this.id];
    const width = ctx.canvas?.width ?? 360;
    const height = ctx.canvas?.height ?? 640;

    ctx.save();
    ctx.fillStyle = '#0f1420';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#ffcf7a';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(meta.title, width / 2, height * 0.36);

    ctx.fillStyle = '#b8c2d8';
    ctx.font = '16px sans-serif';
    ctx.fillText(meta.detail, width / 2, height * 0.46);

    ctx.fillStyle = '#6f7b94';
    ctx.font = '14px sans-serif';
    ctx.fillText('骨架占位 · 点击进入下一场景', width / 2, height * 0.62);
    ctx.fillText('启动参数 probe=1 进入真机探针', width / 2, height * 0.67);
    ctx.restore();
  }

  tap(_x: number, _y: number): void {
    this.flow.goTo(META[this.id].next);
  }
}

export function createSkeletonScenes(
  flow: FlowController,
  telemetry?: Telemetry,
): PlaceholderScene[] {
  return SCENE_ORDER.map((id) => new PlaceholderScene(id, flow, telemetry));
}
