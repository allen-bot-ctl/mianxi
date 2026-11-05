import type { Storage } from '../types';
import { getTT } from './runtime';

/** 只用于同意标志、校准、美颜档位、最好分数；禁止存图像或关键点。 */
export class DouyinStorage implements Storage {
  get<T>(key: string, fallback: T): T {
    try {
      const value = getTT().getStorageSync?.(key);
      return value === undefined || value === null || value === '' ? fallback : (value as T);
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      getTT().setStorageSync?.(key, value);
    } catch (error) {
      console.warn('[Storage] set failed', key, error);
    }
  }

  remove(key: string): void {
    try {
      getTT().removeStorageSync?.(key);
    } catch {
      // 忽略删除异常
    }
  }
}
