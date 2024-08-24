import { Transport, HighlightMessagePayload } from '../highlight';
import { EdvoObj } from '@edvoapp/util';

export class DOM extends EdvoObj implements Transport {
  type = 'dom';
  constructor(private node: HTMLElement) {
    super();
  }
  send(type: string, payload: any): void {
    this.node.dispatchEvent(new CustomEvent(type, { detail: payload }));
  }
  subscribe(msgTypes: string[] = [], listener: (response: HighlightMessagePayload) => void): () => void {
    msgTypes.forEach((type) => this.node.addEventListener(type, onMessage));
    const unbind = () => msgTypes.forEach((type) => this.node.removeEventListener(type, onMessage));
    this.onCleanup(unbind);
    return unbind;

    function onMessage(e: any) {
      listener({
        type: e.type,
        payload: e.detail,
      });
    }
  }
}
