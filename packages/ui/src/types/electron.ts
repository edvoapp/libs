import { BrowserProfile, BrowserProfiles } from '@edvoapp/common';

export interface ElectronAPI {
  store: {
    setItem: (key: string, value: string) => void;
    getItem: (key: string) => Promise<any>;
    eraseItem: (key: string) => void;
  };
  webview: {
    getTitle: (url: string) => Promise<string>;
    screenshot: {
      capture: (webContentsId: string) => Promise<string>;
    };
    loadURL: (url: string, webContentsId: string) => void;
  };
  app: {
    reload: () => void;
  };
  cookies: {
    import: (browserProfile: BrowserProfile, profileVertexId: string) => Promise<string>;
  };
  browserProfiles: { list: () => Promise<BrowserProfiles> }; // TODO: give this a type
  send: (channel: string, ...data: any[]) => void;
  receive: (channel: string, func: (...args: any[]) => void) => () => void;
  WEBVIEW_PRELOAD_PATH: string;
}
