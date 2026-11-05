import type { Scene, SceneId } from './Scene';

export class FlowController {
  private readonly scenes = new Map<SceneId, Scene>();
  private currentScene: Scene | null = null;

  register(scene: Scene): void {
    this.scenes.set(scene.id, scene);
  }

  goTo(id: SceneId): void {
    const next = this.scenes.get(id);
    if (!next) {
      console.warn(`[Flow] scene not registered: ${id}`);
      return;
    }
    if (this.currentScene?.id === id) return;
    this.currentScene?.exit();
    this.currentScene = next;
    next.enter();
  }

  update(dtMs: number): void {
    this.currentScene?.update(dtMs);
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.currentScene?.render(ctx);
  }

  tap(x: number, y: number): void {
    this.currentScene?.tap?.(x, y);
  }

  get current(): SceneId | null {
    return this.currentScene?.id ?? null;
  }

  /** 当前场景实例。供 demo/H5 把指针、键盘事件转发给具体场景。 */
  get scene(): Scene | null {
    return this.currentScene;
  }
}
