import type { TelemetryEventName, TelemetryProps, TelemetryValue } from './events';

export interface TelemetryRecord {
  t: number;
  name: TelemetryEventName;
  props: TelemetryProps;
}

/**
 * 本轮先用内存缓冲 + console。不调用任何网络接口。
 * 只保留数组、对象之外的原生值，避免关键点序列/图像被误带进埋点。
 */
export class Telemetry {
  private readonly records: TelemetryRecord[] = [];
  private readonly now: () => number;
  private readonly echo: boolean;

  constructor(options?: { now?: () => number; echo?: boolean }) {
    this.now = options?.now ?? (() => Date.now());
    this.echo = options?.echo ?? false;
  }

  emit(name: TelemetryEventName, props: TelemetryProps = {}): void {
    const safe: TelemetryProps = {};
    for (const [key, value] of Object.entries(props)) {
      if (isTelemetryValue(value)) safe[key] = value;
    }
    const record = { t: this.now(), name, props: safe };
    this.records.push(record);
    if (this.echo) console.log('[telemetry]', name, safe);
  }

  snapshot(): readonly TelemetryRecord[] {
    return [...this.records];
  }

  clear(): void {
    this.records.length = 0;
  }
}

function isTelemetryValue(value: unknown): value is TelemetryValue {
  return (
    typeof value === 'number' ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  );
}
