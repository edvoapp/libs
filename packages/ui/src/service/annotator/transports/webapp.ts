import { EdvoObj } from '@edvoapp/util';
import { Transport, HighlightMessagePayload } from '../highlight';

export class WebApp extends EdvoObj implements Transport {
  type = 'web';
  private frameID?: string | null = null;
  constructor(private contentWindow: Window) {
    super();
  }
  send(type: string, payload: any) {
    this.contentWindow.top?.postMessage(
      {
        type,
        frameID: this.frameID,
        payload: JSON.stringify(payload),
      },
      '*',
    );
  }

  subscribe(msgTypes: string[] = [], listener: (response: HighlightMessagePayload) => void): () => void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    window.addEventListener('message', onMessage);
    const unbind = () => window.removeEventListener('message', onMessage);
    this.onCleanup(unbind);
    return unbind;

    function onMessage(e: any) {
      const { type, payload: body } = e.data;
      let payload = null;
      if (body) {
        try {
          payload = JSON.parse(body);
          // eslint-disable-next-line no-empty
        } catch (e) {}
      }
      if (type === 'INITIALIZE_FRAME') {
        self.frameID = payload?.frameID;
        self.send('READY', null);
        return;
      }
      if (!msgTypes.includes(type)) return;

      listener({
        type,
        payload,
      });
    }
  }
}
