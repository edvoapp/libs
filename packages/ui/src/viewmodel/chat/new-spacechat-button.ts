import { Model, trxWrapSync } from '@edvoapp/common';
import { Button, ButtonCA } from '../button';
import { ChatPanel } from './chatpanel';
import { MemoizeOwned, Observable, ObservableReader } from '@edvoapp/util';

interface CA extends ButtonCA<ChatPanel> {
  /** user or space vertex to attach this chat to */
  currentSpaceVertex: ObservableReader<Model.Vertex | null | undefined>;
}
export class NewSpaceChatButton extends Button<ChatPanel> {
  currentSpace: ObservableReader<Model.Vertex | null | undefined>;
  constructor({ currentSpaceVertex: currentSpace, ...args }: CA) {
    super({ ...args });
    this.currentSpace = currentSpace;
  }
  static new(args: CA) {
    const me = new NewSpaceChatButton(args);
    me.init();
    return me;
  }
  @MemoizeOwned()
  get enabled() {
    return this.currentSpace.mapObs((space) => !!space);
  }
  onClick() {
    const currentSpace = this.currentSpace.value;
    if (currentSpace) {
      trxWrapSync((trx) => {
        const conversation = Model.Vertex.create({ trx });
        // link this conversation to this topic space
        conversation.createEdge({
          trx,
          target: currentSpace,
          role: ['conversation', 'agent-conversation'],
          meta: { expanded: true },
        });
      });
    }
  }
}
