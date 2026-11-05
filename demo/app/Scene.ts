import type { Scene } from '../../src/flow';

/** H5 场景壳：在根 Scene 之上增加指针/键盘输入；玩法逻辑不在 demo 复制。 */
export interface DemoScene extends Scene {
  onPointerDown?(x: number, y: number): void;
  onPointerMove?(x: number, y: number): void;
  onPointerUp?(x: number, y: number): void;
  onKeyDown?(event: KeyboardEvent): void;
  onKeyUp?(event: KeyboardEvent): void;
}
