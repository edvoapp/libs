import { Observable, OwnedProperty } from '@edvoapp/util';
import { Analytics } from '@edvoapp/common';
import { BaseExtensionBridge } from './base-extension-bridge';

const isElectron = navigator.userAgent.toLowerCase().indexOf(' electron/') > -1;

export class WebappExtensionBridge extends BaseExtensionBridge {
  extensionID?: string;
  @OwnedProperty
  extensionStatus = new Observable<'INJECTED' | 'NOT_INJECTED' | 'PENDING' | 'ELECTRON'>(
    isElectron ? 'ELECTRON' : 'PENDING',
  );
  timeout: null | ReturnType<typeof setTimeout> = null;
  constructor() {
    super();
    window.addEventListener('message', this.handleEvent);
    document.addEventListener('NOTIFY/EXTENSION_ID', this.handleEventOld as EventListener);
    this.timeout = setTimeout(() => {
      if (!isElectron) this.extensionStatus.set('NOT_INJECTED');
    }, 1500);
  }

  protected cleanup() {
    window.removeEventListener('message', this.handleEvent);
    document.removeEventListener('NOTIFY/EXTENSION_ID', this.handleEventOld as EventListener);
    super.cleanup();
  }

  handleEventOld = (event: CustomEvent<{ extensionID: string }>) => {
    console.log('handleEventOld');
    const { extensionID } = event.detail;
    this.setExtensionID(extensionID);
  };

  listeners: Record<string, (() => void)[]> = {};

  addMessageListener(type: string, cb: () => void) {
    const listeners = (this.listeners[type] ??= []);
    listeners.push(cb);
  }

  handleEvent = (event: MessageEvent) => {
    // TODO: check against origin? this is listening on the global message bus, so it gets noisy with dev servers and such
    const {
      data: { type, payload }, // Add sendToBackground
    } = event;
    switch (type) {
      case 'NOTIFY/EXTENSION_ID': {
        console.log('handling event from extension', event);
        const { extensionID } = payload;
        this.setExtensionID(extensionID);
        break;
      }
      case 'COMMAND/KEYDOWN': {
        const { key, altKey, metaKey, ctrlKey } = payload;
        window.dispatchEvent(new KeyboardEvent('keydown', { key, altKey, metaKey, ctrlKey }));
        break;
      }
      default: {
        break;
      }
    }
    const listeners = this.listeners[type] ?? [];
    listeners.forEach((fn) => fn());
  };

  setExtensionID(id: string) {
    if (isElectron) return;
    this.extensionID = id;
    // void this.saveExtensionInstalledProperty();
    this.extensionStatus.set('INJECTED');
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  // async saveExtensionInstalledProperty() {
  //   const userVertex = await currentUserVertexObs.get();
  //   if (!userVertex) return;
  //   const [extensionInstalledProp] = await userVertex
  //     .filterProperties({
  //       role: ['extension-installed'],
  //       contentType: 'application/json',
  //     })
  //     .toArray();
  //   if (!extensionInstalledProp) {
  //     void trxWrap(async (trx) => {
  //       // probably don't want to do anything here
  //       userVertex.createProperty({
  //         trx,
  //         role: ['extension-installed'],
  //         contentType: 'application/json',
  //         initialString: JSON.stringify(true),
  //       });
  //       Model.TimelineEvent.create({
  //         trx,
  //         parent: userVertex,
  //         eventType: 'extension-installed',
  //       });
  //     });
  //   }
  // }

  sendExtensionMessage(type: string, payload?: any, cb = () => {}, fallback = () => {}) {
    if (this.extensionID) {
      console.log('sending navigator message', this.extensionID, type, payload);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window?.chrome?.runtime?.sendMessage(this.extensionID, { type, payload }, cb);
    } else {
      fallback();
    }
  }
  context = 'browser' as const;
}
