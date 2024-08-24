import { EdvoObj } from '@edvoapp/util';
import { Transport, HighlightMessagePayload } from '../highlight';

export class Webview extends EdvoObj implements Transport {
  type = 'webview';
  constructor(private channel: any) {
    super();
  }
  send(type: string, payload: any): void {
    this.channel.send(type, JSON.stringify(payload));
  }

  subscribe(msgTypes: string[] = [], listener: (response: HighlightMessagePayload) => void): () => void {
    const ready = () => {
      listener({
        type: 'READY',
        payload: null,
      });
    };
    this.channel.addEventListener('did-finish-load', ready);
    this.channel.addEventListener('ipc-message', onMessage);
    const unbind = () => {
      this.channel.removeEventListener('did-finish-load', ready);
      this.channel.removeEventListener('ipc-message', onMessage);
    };
    this.onCleanup(unbind);
    return unbind;

    function onMessage(e: any) {
      const payload = JSON.parse(e.args[0]);
      const type = e.channel;
      if (!msgTypes.includes(type)) return;
      listener({
        type,
        payload,
      });
    }
  }
}
