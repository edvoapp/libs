import { ChildNode, ChildNodeCA, ConditionalNode, ListNode } from '../base';
import { Chat } from './chat';
import { MemoizeOwned, Observable, ObservableList, OwnedProperty, WeakProperty } from '@edvoapp/util';
import { Model } from '@edvoapp/common';
import { UserAvatar } from '../user-avatar';

export type RawTypingIndicatorData = {
  timestamp: number;
  userID: string;
  sub?: Record<string, Omit<RawTypingIndicatorData, 'sub'>>;
};

export type FlattenedTypingIndicatorData = {
  timestamp: number;
  userID: string;
  subUserID?: string;
};

type CA = ChildNodeCA<Chat> & {
  avatars: ObservableList<Model.Vertex>;
};

export class TypingIndicator extends ChildNode<Chat> {
  @OwnedProperty
  _avatars: ObservableList<Model.Vertex>;

  constructor({ avatars, ...args }: CA) {
    super(args);
    this._avatars = avatars;
  }

  static new(args: CA) {
    const me = new TypingIndicator(args);
    me.init();
    return me;
  }

  @MemoizeOwned()
  get avatars() {
    return ListNode.new<TypingIndicator, UserAvatar, Model.Vertex>({
      parentNode: this,
      precursor: this._avatars,
      factory: (vertex, parentNode) =>
        UserAvatar.new({
          parentNode,
          vertex,
          size: 'small',
          context: this.context,
          showNameAsTooltip: true,
        }),
    });
  }
}
