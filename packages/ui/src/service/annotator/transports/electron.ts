import { EdvoObj } from '@edvoapp/util';
import { Transport, HighlightPlain, HighlightMessagePayload } from '../highlight';

interface IPCRenderer {
  addListener(type: string, listener: Function): void;
  sendToHost(type: string, payload: any): void;
  removeListener(type: string, listener: Function): void;
}
export class ElectronApp extends EdvoObj implements Transport {
  type = 'electron';
  constructor(private channel: IPCRenderer) {
    super();
  }
  send(type: string, payload: HighlightPlain) {
    this.channel.sendToHost(type, {
      type,
      payload: JSON.stringify(payload),
    });
  }

  subscribe(msgTypes: string[] = [], listener: (response: HighlightMessagePayload) => void): () => void {
    msgTypes.forEach((type) => this.channel.addListener(type, onMessage));
    const unbind = () => msgTypes.forEach((type) => this.channel.removeListener(type, onMessage));
    this.onCleanup(unbind);
    return unbind;

    function onMessage(e: any, data: string) {
      listener({
        type: e.channel,
        payload: JSON.parse(data),
      });
    }
  }
}
