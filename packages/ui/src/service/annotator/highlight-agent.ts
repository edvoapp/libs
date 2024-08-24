import { EdvoObj, ObservableList, OwnedProperty } from '@edvoapp/util';
import { HighlightPlain, HighlightMessagePayload, Transport, HighlightAppEvents } from './highlight';

export class HighlightAgent extends EdvoObj {
  @OwnedProperty
  readonly highlights = new ObservableList<HighlightPlain>();
  focusedHighlight: HighlightPlain | null = null;
  @OwnedProperty
  transport: Transport | null = null;
  private eventsCallbacks = new Map<string, Function[]>();

  bindTransport(transport: Transport) {
    this.transport = transport;
    this.onCleanup(this.transport.subscribe(HighlightAppEvents, this.onMessage));
  }

  on(type: string, cb: (payload: any) => void) {
    const callbacks = this.eventsCallbacks.get(type) || [];
    this.eventsCallbacks.set(type, [...callbacks, cb]);
  }

  private onMessage = (e: HighlightMessagePayload) => {
    const { payload } = e;
    this.triggerCallbacks(e.type, payload);
    if (!payload) return;
    switch (e.type) {
      case 'PAINT': {
        const highlight = payload;
        const has = !!this.getHighlightByProp('key', highlight.key);
        if (!has) this.highlights.insert(highlight);
        return;
      }
      case 'REMOVE': {
        const { key } = payload;
        const highlight = this.getHighlightByProp('key', key);
        if (highlight) this.highlights.remove(highlight);
        return;
      }
    }
  };

  private triggerCallbacks(type: string, res: any) {
    const callbacks = this.eventsCallbacks.get(type) || [];
    callbacks.forEach((cb) => cb(res));
  }

  getHighlightByProp(prop: string, value: any) {
    //@ts-ignore
    return this.highlights.find((h: HighlightPlain) => h[prop] === value);
  }

  reportPaintStatus(key: string, status: number) {
    this.transport?.send('PAINT_STATUS', { key, status });
  }

  newHighlight(highlight: HighlightPlain) {
    console.log('new hl', highlight);
    this.highlights.insert(highlight);
    this.transport?.send('ADD', highlight);
  }

  openInNewTab(highlight: HighlightPlain) {
    this.transport?.send('OPEN', highlight);
  }

  focusHighlight(highlight: HighlightPlain | null) {
    this.focusedHighlight = highlight;
    if (highlight && !this.highlights.contains(highlight)) {
      this.highlights.insert(highlight);
    }
    this.transport?.send('FOCUS', highlight);
  }

  sendReady() {
    this.transport?.send('READY', null);
  }

  protected cleanup() {
    this.eventsCallbacks = new Map();
    super.cleanup();
  }
}
