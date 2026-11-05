export interface TTRuntime {
  [key: string]: any;
}

export function hasTT(): boolean {
  return typeof globalThis !== 'undefined' && typeof (globalThis as any).tt !== 'undefined';
}

export function getTT(): TTRuntime {
  if (!hasTT()) {
    throw new Error('tt 不可用：当前不在抖音小游戏运行时');
  }
  return (globalThis as any).tt as TTRuntime;
}

export function safeGetTT(): TTRuntime | null {
  return hasTT() ? ((globalThis as any).tt as TTRuntime) : null;
}
