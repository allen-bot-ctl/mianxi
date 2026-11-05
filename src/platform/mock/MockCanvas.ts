/** 无 tt / 单测环境用的无绘制 canvas 上下文。只记录调用，不产生图像。 */
export interface HeadlessCanvas {
  width: number;
  height: number;
  getContext(type: '2d'): CanvasRenderingContext2D;
}

export function createHeadlessCanvas(
  width = 360,
  height = 640,
): HeadlessCanvas {
  const target: Record<string, any> = {
    measureText: (text: string) => ({ width: String(text).length * 8 }),
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    canvas: { width, height },
  };

  const context = new Proxy(target, {
    get(object, property) {
      if (property in object) return object[property as string];
      return () => undefined;
    },
    set(object, property, value) {
      object[property as string] = value;
      return true;
    },
  });

  return {
    width,
    height,
    getContext: () => context as unknown as CanvasRenderingContext2D,
  };
}
