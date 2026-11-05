/** 交接 §13 埋点事件名。只允许事件名 + 数值/短字符串，禁止图像与关键点。 */
export const TelemetryEvents = {
  appOpen: 'app_open',
  privacyShown: 'privacy_shown',
  privacyAccept: 'privacy_accept',
  privacyDecline: 'privacy_decline',
  cameraGranted: 'camera_granted',
  cameraDenied: 'camera_denied',
  facecheckPass: 'facecheck_pass',
  calibDone: 'calib_done',
  roundStart: 'round_start',
  creatureResult: 'creature_result',
  faceLost: 'face_lost',
  roundAbort: 'round_abort',
  roundEnd: 'round_end',
  shareTap: 'share_tap',
  shareSuccess: 'share_success',
  shareFail: 'share_fail',
  saveAlbum: 'save_album',
  replayTap: 'replay_tap',
  detectRate: 'detect_rate',
  renderFps: 'render_fps',
} as const;

export type TelemetryEventName = (typeof TelemetryEvents)[keyof typeof TelemetryEvents];

export type TelemetryValue = number | string | boolean;
export type TelemetryProps = Record<string, TelemetryValue>;
