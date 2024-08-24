import { Store } from '@edvoapp/common';
import * as ui from '.';

declare global {
  interface Window {
    eventNav: ui.EventNav;
    edvoui: typeof ui;
    tests: typeof ui.E2ETests;
    unitTests: typeof ui.UnitTests;
    goToLeakPage: () => void;
    opera?: boolean;
    authService: ui.AuthService;
    store: Store;
    electronAPI?: ui.ElectronAPI;
  }
}
