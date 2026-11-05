import type { Storage } from '../types';

export class MockStorage implements Storage {
  private readonly values = new Map<string, unknown>();

  get<T>(key: string, fallback: T): T {
    return this.values.has(key) ? (this.values.get(key) as T) : fallback;
  }

  set<T>(key: string, value: T): void {
    this.values.set(key, value);
  }

  remove(key: string): void {
    this.values.delete(key);
  }

  snapshot(): Record<string, unknown> {
    return Object.fromEntries(this.values);
  }
}
