import { MemoizeOwned } from '@edvoapp/util';
import { BranchNode, BranchNodeCA, ListNode, VertexNode, VertexNodeCA } from '../base';
import { ChatPanel } from './chatpanel';
import { ConversationLabel } from './conversation-label';
import { Clickable } from '../../behaviors';

interface CA extends VertexNodeCA<ListNode<ChatPanel, ConversationListItem>> {
  onClick: () => void;
  isSpaceChat: boolean;
}

export class ConversationListItem extends VertexNode<ListNode<ChatPanel, ConversationListItem>> implements Clickable {
  isSpaceChat: boolean;
  onClick: () => void;
  constructor({ onClick, isSpaceChat, ...args }: CA) {
    super(args);
    this.onClick = onClick;
    this.isSpaceChat = isSpaceChat;
  }
  static new(args: CA) {
    const me = new ConversationListItem(args);
    me.init();
    return me;
  }
  get childProps(): string[] {
    return ['conversationLabel'];
  }
  @MemoizeOwned()
  get conversationLabel() {
    return new ConversationLabel({
      parentNode: this,
      vertex: this.vertex,
      context: this.context,
      isSpaceChat: this.isSpaceChat,
    });
  }
}
