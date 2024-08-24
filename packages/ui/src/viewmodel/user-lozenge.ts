import { MemoizeOwned, Observable, OwnedProperty } from '@edvoapp/util';
import {
  ConditionalNode,
  ListNode,
  Node,
  NodeAndContext,
  NodeCA,
  Node as VMNode,
  VertexNode,
  VertexNodeCA,
} from './base';
import { Behavior, DispatchStatus, EventNav } from '../service';
import { AvatarSize, UserAvatar } from './user-avatar';
import { UserSelectionBox } from './user-selection-box';

interface UserLozengeCA extends VertexNodeCA {
  onClose?: () => void;
}

export class UserLozenge extends VertexNode {
  @OwnedProperty
  onClose: Observable<(() => void) | undefined>;

  private constructor({ onClose, ...args }: UserLozengeCA) {
    super(args);
    this.onClose = new Observable(onClose);
  }

  static new(args: UserLozengeCA) {
    const me = new UserLozenge(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['user', 'closeIcon'];
  }

  @MemoizeOwned()
  get user(): UserItem {
    return UserItem.new({
      parentNode: this,
      context: this.context,
      vertex: this.vertex,
      size: 'xs',
    });
  }

  @MemoizeOwned()
  get closeIcon(): ConditionalNode<Close, undefined | (() => void), UserLozenge> {
    return ConditionalNode.new<Close, undefined | (() => void), UserLozenge>({
      parentNode: this,
      precursor: this.onClose,
      factory: (onClose, parentNode) => {
        if (!onClose) return undefined;
        return Close.new({
          parentNode,
          context: this.context,
        });
      },
    });
  }
}

interface UserEmailLozengeCA extends NodeCA<VMNode | null> {
  email: string;
  onClose?: () => void;
}

export class UserEmailLozenge extends VMNode {
  email: string;
  @OwnedProperty
  onClose: Observable<(() => void) | undefined>;

  private constructor({ email, onClose, ...args }: UserEmailLozengeCA) {
    super(args);
    this.email = email;
    this.onClose = new Observable(onClose);
  }

  static new(args: UserEmailLozengeCA) {
    const me = new UserEmailLozenge(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['closeIcon'];
  }

  @MemoizeOwned()
  get closeIcon(): ConditionalNode<Close, undefined | (() => void), UserEmailLozenge> {
    return ConditionalNode.new<Close, undefined | (() => void), UserEmailLozenge>({
      parentNode: this,
      precursor: this.onClose,
      factory: (onClose, parentNode) => {
        if (!onClose) return undefined;
        return Close.new({
          parentNode,
          context: this.context,
        });
      },
    });
  }
}

type CloseParent =
  | ConditionalNode<Close, undefined | (() => void), UserLozenge>
  | ConditionalNode<Close, undefined | (() => void), UserEmailLozenge>;
class Close extends VMNode<CloseParent> {
  private constructor(args: NodeCA<CloseParent>) {
    super(args);
  }

  static new(args: NodeCA<CloseParent>) {
    const me = new Close(args);
    me.init();
    return me;
  }

  close() {
    this.parentNode.parentNode.onClose.value?.();
  }

  getLocalBehaviors(): Behavior[] {
    return [new CloseClick()];
  }
}

interface UserItemCA extends VertexNodeCA {
  onClick?: () => void;
  size?: AvatarSize;
}

export class UserItem extends VertexNode {
  onClick?: () => void;
  size: AvatarSize;

  private constructor({ onClick, size, ...args }: UserItemCA) {
    super(args);
    this.size = size ?? 'small';
    this.onClick = onClick;
  }

  static new(args: UserItemCA): UserItem {
    const me = new UserItem(args);
    me.init();
    return me;
  }

  getHeritableBehaviors(): Behavior[] {
    return [new UserItemClick(), new UserItemKeydown()];
  }

  get childProps(): string[] {
    return ['avatar'];
  }

  @MemoizeOwned()
  get avatar() {
    return UserAvatar.new({
      parentNode: this,
      vertex: this.vertex,
      size: this.size,
      context: this.context,
    });
  }

  upwardNode(): NodeAndContext | null {
    if (this.parentNode instanceof ListNode) {
      const prevSibling = super.prevSibling();
      if (prevSibling) return { node: prevSibling };
      const userSelectionBox = this.parentNode.parentNode.parentNode;
      return { node: userSelectionBox.searchField };
    }
    return super.upwardNode();
  }

  downwardNode(): NodeAndContext | null {
    if (this.parentNode instanceof ListNode) {
      const nextSibling = super.nextSibling();
      if (nextSibling) return { node: nextSibling };
      return { node: this };
    }
    return super.downwardNode();
  }

  leftwardNode(): NodeAndContext | null {
    return this.upwardNode();
  }

  rightwardNode(): NodeAndContext | null {
    return this.downwardNode();
  }
}

interface TextItemCA extends NodeCA<VMNode | null> {
  value: string;
  onClick?: () => void;
}

export class TextItem extends VMNode {
  value: string;
  onClick: (() => void) | undefined;

  private constructor({ value, onClick, ...args }: TextItemCA) {
    super(args);
    this.value = value;
    this.onClick = onClick;
  }

  static new(args: TextItemCA): TextItem {
    const me = new TextItem(args);
    me.init();
    return me;
  }

  getHeritableBehaviors(): Behavior[] {
    return [new UserItemClick(), new UserItemKeydown()];
  }

  upwardNode(): NodeAndContext | null {
    if (this.parentNode instanceof ListNode) {
      const prevSibling = super.prevSibling();
      if (prevSibling) return { node: prevSibling };
      const userSelectionBox = this.parentNode.parentNode.parentNode;
      return { node: userSelectionBox.searchField };
    }
    return super.upwardNode();
  }

  downwardNode(): NodeAndContext | null {
    if (this.parentNode instanceof ListNode) {
      const nextSibling = super.nextSibling();
      if (nextSibling) return { node: nextSibling };
      return { node: this };
    }
    return super.downwardNode();
  }

  leftwardNode(): NodeAndContext | null {
    return this.upwardNode();
  }

  rightwardNode(): NodeAndContext | null {
    return this.downwardNode();
  }
}

class UserItemKeydown extends Behavior {
  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: Node<Node<any> | null>): DispatchStatus {
    if (e.key == 'Enter') {
      const userSelectionBox = originNode.parentNode?.parentNode.parentNode;
      if (userSelectionBox instanceof UserSelectionBox) {
        eventNav.focusState.setFocus(userSelectionBox.searchField, {});
      }
      return handleUserItemSelected(originNode);
    }
    return 'decline';
  }
}

class UserItemClick extends Behavior {
  handleMouseDown(eventNav: EventNav, e: MouseEvent, originNode: VMNode): DispatchStatus {
    return 'stop';
  }
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: VMNode): DispatchStatus {
    return handleUserItemSelected(originNode);
  }
}

function handleUserItemSelected(originNode: Node): DispatchStatus {
  const node = originNode.findClosest((n) => (n instanceof UserItem || n instanceof TextItem) && n);
  if (!node) return 'decline';
  void node.onClick?.();
  return 'stop';
}

class CloseClick extends Behavior {
  handleMouseDown(eventNav: EventNav, e: MouseEvent, originNode: VMNode): DispatchStatus {
    return 'stop';
  }
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: VMNode): DispatchStatus {
    const node = originNode.findClosest((n) => n instanceof Close && n);
    if (!node) return 'decline';
    void node.close();
    return 'stop';
  }
}
