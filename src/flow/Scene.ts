export type SceneId =
  | 'S1'
  | 'S2'
  | 'S3'
  | 'S4'
  | 'S5'
  | 'S6'
  | 'S7'
  | 'S8'
  | 'S9'
  | 'PROBE';

/** S1–S9 的占位场景 + 隐藏探针场景共用接口。 */
export interface Scene {
  readonly id: SceneId;
  enter(): void;
  exit(): void;
  update(dtMs: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  tap?(x: number, y: number): void;
}
