import type { Auth } from '../types';
import { getTT } from './runtime';

export class DouyinAuth implements Auth {
  async requestCamera(): Promise<boolean> {
    try {
      const tt = getTT();
      await new Promise<void>((resolve, reject) => {
        tt.authorize({
          scope: 'scope.camera',
          success: () => resolve(),
          fail: (error: unknown) => reject(error),
        });
      });
      return true;
    } catch {
      return false;
    }
  }

  getCameraPermission(): boolean | null {
    try {
      const setting = getTT().getSettingSync?.();
      const value = setting?.authSetting?.['scope.camera'];
      return typeof value === 'boolean' ? value : null;
    } catch {
      return null;
    }
  }

  openSettings(): void {
    try {
      getTT().openSetting?.({});
    } catch (error) {
      console.warn('[Auth] openSetting failed', error);
    }
  }
}
