import type { ViewTransform } from '../core/signal';
import type { FaceFrame } from '../types';

export type BeautifyParams = [number, number, number, number] | number[];

export interface VideoLike {
  videoWidth?: number;
  videoHeight?: number;
  width?: number;
  height?: number;
  focus?: () => void;
}

export interface CameraSource {
  readonly isMock: boolean;
  start(): Promise<VideoLike | null>;
  stop(): void;
  getVideo(): VideoLike | null;
  setBeautifyParam(params: BeautifyParams): void;
}

export interface FaceSource {
  start(): void;
  detect(video: VideoLike | null, view: ViewTransform, tCall: number): Promise<FaceFrame>;
  stop(): void;
}

export interface RecordingStartOptions {
  durationS: number;
  isMarkOpen: boolean;
  frameRate?: number;
  locLeft?: number;
  locTop?: number;
}

export interface Recorder {
  onStart(callback: () => void): void;
  onStop(callback: (videoPath: string) => void): void;
  onError(callback: (error: unknown) => void): void;
  onInterruptionBegin(callback: () => void): void;
  onInterruptionEnd(callback: () => void): void;
  start(options: RecordingStartOptions): void;
  stop(): void;
  pause(): void;
  resume(): void;
  getMark?(): { width: number; height: number; locLeft: number; locTop: number } | null;
}

export interface Storage {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

export interface ShareOptions {
  score: number;
  n: number;
  videoPath: string;
}

export interface Share {
  shareVideo(options: ShareOptions): Promise<boolean>;
  saveVideoToAlbum(videoPath: string): Promise<boolean>;
}

export interface Auth {
  requestCamera(): Promise<boolean>;
  getCameraPermission(): boolean | null;
  openSettings(): void;
}
