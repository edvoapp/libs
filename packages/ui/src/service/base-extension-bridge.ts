import { EdvoObj } from '@edvoapp/util';
import { Analytics } from '@edvoapp/common';

// This is the interface / class that defines how clients can interact with the chrome extension API. Implementation details may differ because of different runtimes
export abstract class BaseExtensionBridge extends EdvoObj {
  abstract extensionID?: string;
  protected constructor() {
    super();
  }
  abstract sendExtensionMessage<T = any>(
    type: string,
    payload?: T,
    cb?: (args?: any) => void,
    fallback?: () => void,
  ): void;
  sendCurrentTabMessage<T = any>(type: string, payload?: T) {
    //use default behaviour, but let to override
    this.sendExtensionMessage(type, payload);
  }

  listeners: Record<string, (() => void)[]> = {};

  addMessageListener(type: string, cb: () => void) {
    const listeners = (this.listeners[type] ??= []);
    listeners.push(cb);
  }
  abstract context: 'popup' | 'browser' | 'background' | 'content';
}
