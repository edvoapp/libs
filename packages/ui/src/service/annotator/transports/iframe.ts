import { generateKey, EdvoObj } from '@edvoapp/util';
import { Transport, HighlightMessagePayload } from '../highlight';

export class Iframe extends EdvoObj implements Transport {
  type = 'iframe';
  private frameID = generateKey();
  constructor(private channel: HTMLIFrameElement) {
    super();
  }
  send(type: string, payload: any = null): void {
    this.channel.contentWindow?.postMessage(
      {
        type,
        payload: JSON.stringify(payload),
      },
      '*',
    );
  }
  subscribe(msgTypes: string[] = [], listener: (response: HighlightMessagePayload) => void): () => void {
    const init = () => {
      window.addEventListener('message', onMessage);
      this.send('INITIALIZE_FRAME', { frameID: this.frameID });
    };
    this.channel.addEventListener('load', init);
    const self = this;
    const unbind = () => {
      this.channel.removeEventListener('load', init);
      window.removeEventListener('message', onMessage);
    };
    this.onCleanup(unbind);
    return unbind;

    function onMessage(e: any) {
      const { type, frameID, payload: body } = e.data;

      if (!msgTypes.includes(type) || self.frameID !== frameID) return;

      let payload = null;
      if (body) {
        try {
          payload = JSON.parse(body);
        } catch (e) {
          console.warn('error parsing json', e);
        }
      }
      listener({
        type,
        payload,
      });
    }
  }
}
