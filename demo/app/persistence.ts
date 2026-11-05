import type { Tunables } from '../../src/config';
import type { Calibration } from '../../src/types';
import type { Storage } from '../../src/platform';

export type DemoSkinMode = 'natural' | 'minimum';

export interface PrivacyRecord {
  accepted: boolean;
  at: number;
  version: number;
}

export function readPrivacyAccepted(storage: Storage, config: Tunables): boolean {
  const value = storage.get<unknown>(config.storage.keys.privacyAccepted, null);
  if (value === true) return true;
  if (value && typeof value === 'object') {
    return (value as { accepted?: unknown }).accepted === true;
  }
  return false;
}

export function writePrivacyAccepted(storage: Storage, config: Tunables): void {
  const record: PrivacyRecord = {
    accepted: true,
    at: Date.now(),
    version: config.privacy.version,
  };
  storage.set(config.storage.keys.privacyAccepted, record);
}

export function revokePrivacy(storage: Storage, config: Tunables): void {
  storage.remove(config.storage.keys.privacyAccepted);
}

export function readCalibration(storage: Storage, config: Tunables): Calibration | null {
  const value = storage.get<unknown>(config.storage.keys.calibration, null);
  if (!value || typeof value !== 'object') return null;
  const base = Number((value as { base?: unknown }).base);
  const peak = Number((value as { peak?: unknown }).peak);
  if (!Number.isFinite(base) || !Number.isFinite(peak) || peak <= base) return null;
  return { base, peak };
}

export function writeCalibration(storage: Storage, config: Tunables, value: Calibration): void {
  storage.set(config.storage.keys.calibration, { base: value.base, peak: value.peak });
}

export function readSkinMode(storage: Storage, config: Tunables): DemoSkinMode {
  const value = storage.get<unknown>(config.storage.keys.beautify, null);
  if (value === 'minimum' || value === 'natural') return value;
  if (value && typeof value === 'object' && (value as { mode?: unknown }).mode === 'minimum') {
    return 'minimum';
  }
  return config.beautify.default === 'minimum' ? 'minimum' : 'natural';
}

export function writeSkinMode(storage: Storage, config: Tunables, mode: DemoSkinMode): void {
  storage.set(config.storage.keys.beautify, mode);
}

export function readBestScore(storage: Storage, config: Tunables): number {
  const value = Number(storage.get<unknown>(config.storage.keys.bestScore, 0));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function writeBestScore(storage: Storage, config: Tunables, score: number): void {
  storage.set(config.storage.keys.bestScore, Math.max(0, Math.round(score)));
}
