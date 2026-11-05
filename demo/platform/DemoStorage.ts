import type { Storage } from '../../src/platform';

/** localStorage 适配。只存同意标志、校准、美颜档位、最好分数。 */
export class DemoStorage implements Storage {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 隐私模式/配额满时静默失败，不影响本局。
    }
  }

  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
