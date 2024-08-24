import { EdvoObj } from '@edvoapp/util';
import { Transport, HighlightPlain, HighlightMessagePayload } from '../highlight';
import { useNavigator } from '../../';

export class Chrome extends EdvoObj implements Transport {
  type = 'chrome';
  constructor(private port: chrome.runtime.Port | null) {
    super();
  }
  send(type: string, payload: HighlightPlain) {
    this.port?.postMessage({
      type,
      payload: JSON.stringify(payload),
    });
  }

  subscribe(msgTypes: string[] = [], listener: (response: HighlightMessagePayload) => void): () => void {
    this.port?.onMessage.addListener(onMessage);
    this.port?.onDisconnect.addListener(() => {
      this.port = null;
    });
    const unbind = () => this.port?.onMessage.removeListener(onMessage);
    this.onCleanup(unbind);
    return unbind;

    function onMessage(e: any) {
      const { type, payload: body } = e?.data || e || {};

      let payload = null;
      if (typeof body === 'string') {
        try {
          payload = JSON.parse(body);
        } catch (e) {
          console.log(e);
        }
      }

      switch (type) {
        case 'COMMAND/OPEN_URI_IN_CURRENT_TAB': {
          const nav = useNavigator();
          nav.openInCurrentTab(body.uri);
          return;
        }
      }
      if (!msgTypes.includes(type)) return;

      listener({
        type,
        payload,
      });
    }
  }
  cleanup(debugStack?: Error): void {
    this.port?.disconnect();
    super.cleanup();
  }
}
