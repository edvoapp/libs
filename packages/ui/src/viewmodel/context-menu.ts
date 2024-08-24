import { MemoizeOwned, Observable, ObservableList } from '@edvoapp/util';
import { Action, ActionGroup, Behavior, DispatchStatus, EventNav } from '..';
import { ChildNodeCA, ChildNode, Node, ConditionalNode, ListNode } from './base';
import { Clickable } from '../behaviors';

export interface ContextMenuState {
  left: number;
  top: number;
  actionGroups: ActionGroup[];
}

export class ContextMenu extends ChildNode<Node> {
  // for sub-action menu
  overflow = true;
  static new(args: ChildNodeCA<Node>) {
    const me = new ContextMenu(args);
    me.init();
    return me;
  }

  get childProps(): string[] {
    return ['actionGroups'];
  }

  @MemoizeOwned()
  get menuState() {
    this.trace(4, () => ['getting menu state 1']);
    return new Observable<ContextMenuState | null>(null);
  }

  @MemoizeOwned()
  get actionGroups() {
    const precursor = new ObservableList<ActionGroup>([], 'menu items', undefined, () => this.menuState.load());
    precursor.managedSubscription(this.menuState, (menuState) => {
      if (menuState) precursor.replaceAll(menuState.actionGroups);
    });
    return ListNode.new<ContextMenu, ContextMenuActionGroup, ActionGroup>({
      parentNode: this,
      precursor,
      factory: (actionGroup, parentNode) => ContextMenuActionGroup.new({ parentNode, actionGroup }),
    });
  }
}

interface ContextMenuActionGroupCA extends ChildNodeCA<ListNode<ContextMenu, ContextMenuActionGroup, ActionGroup>> {
  actionGroup: ActionGroup;
}

export class ContextMenuActionGroup extends ChildNode<ListNode<ContextMenu, ContextMenuActionGroup, ActionGroup>> {
  // for sub-action menu
  overflow = true;
  actionGroup: ActionGroup;

  constructor({ actionGroup, ...args }: ContextMenuActionGroupCA) {
    super(args);
    this.actionGroup = actionGroup;
  }

  static new(args: ContextMenuActionGroupCA) {
    const me = new ContextMenuActionGroup(args);
    me.init();
    return me;
  }

  get childProps(): string[] {
    return ['actions'];
  }

  @MemoizeOwned()
  get actions() {
    return ListNode.new<ContextMenuActionGroup | ContextMenuAction, ContextMenuAction, Action>({
      parentNode: this,
      precursor: new ObservableList<Action>(this.actionGroup.actions),
      factory: (action, parentNode) => ContextMenuAction.new({ parentNode, action }),
    });
  }
}

interface ContextMenuActionCA
  extends ChildNodeCA<ListNode<ContextMenuActionGroup | ContextMenuAction, ContextMenuAction, Action>> {
  action: Action;
}

export class ContextMenuAction
  extends ChildNode<ListNode<ContextMenuActionGroup | ContextMenuAction, ContextMenuAction, Action>>
  implements Clickable
{
  // for sub-action menu
  overflow = true;
  action: Action;
  clearDefer: null | (() => void) = null;

  constructor({ action, ...args }: ContextMenuActionCA) {
    super(args);
    this.action = action;
  }

  static new(args: ContextMenuActionCA) {
    const me = new ContextMenuAction(args);
    me.init();
    return me;
  }

  get childProps(): string[] {
    return ['subActions'];
  }

  getHeritableBehaviors(): Behavior[] {
    return [new ExpandAction()];
  }

  onClick() {
    const apply = this.action.apply;

    if (apply) {
      const ctxMenu = this.closestInstance(ContextMenu);
      ctxMenu?.menuState.set(null);
      apply?.();
    } else {
      this.expanded.set(true);
    }
  }

  @MemoizeOwned()
  get expanded() {
    return new Observable(false);
  }

  @MemoizeOwned()
  get subActions() {
    const precursor = new ObservableList<Action>([]);
    precursor.managedSubscription(this.expanded, (e) => precursor.replaceAll(e ? this.action.subActions ?? [] : []));
    return ListNode.new<ContextMenuActionGroup | ContextMenuAction, ContextMenuAction, Action>({
      parentNode: this,
      precursor,
      factory: (action, parentNode) => ContextMenuAction.new({ parentNode, action }),
    });
  }
}

class ExpandAction extends Behavior {
  handleMouseEnter(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const node = originNode.closestInstance(ContextMenuAction);
    if (!node) return 'decline';
    node.clearDefer?.();
    node.clearDefer = node.expanded.defer(() => node.expanded.set(true), 200);
    return 'stop';
  }
  handleMouseLeave(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const node = originNode.closestInstance(ContextMenuAction);
    if (!node) return 'decline';
    node.clearDefer?.();
    node.clearDefer = node.expanded.defer(() => node.expanded.set(false), 200);
    return 'stop';
  }
}
