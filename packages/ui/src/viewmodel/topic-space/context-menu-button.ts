import { ChildNode, Node, ChildNodeCA, ConditionalNode } from '../base';
import { Behavior, DispatchStatus, EventNav } from '../../service';
import { getBatchActions, hasContextMenu } from '../../behaviors';
import { ContextMenu } from '../context-menu';
import { ActionMenu } from './action-menu';
import { Member } from './member';
import { ContentCard } from './content-card';
import { TSPage } from '../page';

type Parent = ConditionalNode<ContextMenuButton, boolean, Node> | Node;

interface CA extends ChildNodeCA<Parent> {}

export class ContextMenuButton extends ChildNode<Parent> {
  allowHover = true;
  get cursor() {
    return 'pointer';
  }
  static new(args: CA) {
    const me = new ContextMenuButton(args);
    me.init();
    return me;
  }

  getLocalBehaviors(): Behavior[] {
    return [new ContextMenuButtonClick()];
  }
}

class ContextMenuButtonClick extends Behavior {
  handleMouseDown(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    eventNav.unsetGlobalBehaviorOverrides(this);
    const ctxMenu = originNode.closestInstance(ContextMenu);
    // if I clicked into a context menu, decline.
    if (ctxMenu) return 'decline';

    const contextMenu = originNode.findClosest((n) => hasContextMenu(n) && n)?.contextMenu;
    contextMenu?.menuState.set(null);
    return 'continue';
  }

  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const menuBtn = originNode.closestInstance(ContextMenuButton);
    if (!menuBtn) return 'decline';
    // open context menu
    const contextMenu = menuBtn.findClosest((n) => hasContextMenu(n) && n)?.contextMenu;
    if (!contextMenu) return 'decline';
    const content = menuBtn.findClosest(
      (n) => (n instanceof Member || n instanceof ContentCard || n instanceof TSPage) && n,
    );
    if (!content) return 'decline';
    const actionGroups = getBatchActions([content]);
    contextMenu.menuState.set({
      left: menuBtn.parentNode instanceof ConditionalNode ? e.clientX : menuBtn.clientRectObs.value.left,
      top: menuBtn.parentNode instanceof ConditionalNode ? e.clientY : menuBtn.clientRectObs.value.top + 34,
      actionGroups,
    });
    eventNav.setGlobalBehaviorOverrides(this, ['handleMouseDown']);
    return 'stop';
  }
}
