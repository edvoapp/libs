import { Action, ActionGroup, Behavior, DispatchStatus, EventNav, Hotkey, keyMappings } from '../service';

import * as VM from '../viewmodel';
import { AppDesktop, Node } from '../viewmodel';
import { intersection } from '@edvoapp/common';
import { OwnedProperty, useUndoManager } from '@edvoapp/util';

export class ContextMenu extends Behavior {
  @OwnedProperty
  activeNode: VM.ContextMenu | null = null;
  handleContextMenu(eventNav: EventNav, e: MouseEvent): DispatchStatus {
    if (e.shiftKey) return 'decline';
    return 'stop';
  }

  handleRightMouseUp(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    // Close any open context menus
    this.close(eventNav);
    // Disregard if we right clicked on the context menu
    if (originNode.closest((n) => n instanceof VM.ContextMenu)) return 'decline';

    // Get the relevant ContextMenu
    const contextMenu = originNode?.findClosest((n) => hasContextMenu(n) && n)?.contextMenu;
    if (!contextMenu) return 'decline';

    this.activeNode = contextMenu; // In case we have more than one ContextMenu node OR the one we start on becomes unreachable on the mouseUp

    let actionGroups = originNode.getActions();
    this.trace(3, () => ['actions', actionGroups]);

    const batchActions = getBatchActions(eventNav.selectionState.selection.value);

    if (batchActions.length) actionGroups = batchActions;

    contextMenu.menuState.set({
      left: e.pageX,
      top: e.pageY,
      actionGroups,
    });

    this.trace(4, () => ['handleKey', 'open context menu', this, contextMenu]);

    eventNav.setGlobalBehaviorOverrides(this, ['handleMouseDown', 'handleKeyDown']);
    return 'stop';
  }

  // Click out
  handleMouseDown(eventNav: EventNav, _e: MouseEvent, node: VM.Node): DispatchStatus {
    if (!this.activeNode?.menuState?.value) {
      eventNav.unsetGlobalBehaviorOverrides(this);
      return 'decline';
    }

    if (node.closest((n) => n instanceof VM.ContextMenu)) return 'continue';

    this.close(eventNav);
    return 'continue';
  }
  handleKeyDown(eventNav: EventNav, event: KeyboardEvent): DispatchStatus {
    this.trace(4, () => ['handleKey', event, this]);
    if (!this.activeNode?.menuState?.value) {
      eventNav.unsetGlobalBehaviorOverrides(this);
      return 'decline';
    }

    if (event.key === 'ESC') {
      this.close(eventNav);
      return 'stop';
    }
    return 'continue';
  }
  close(eventNav: EventNav) {
    const menuState = this.activeNode?.menuState;
    this.trace(4, () => ['handleKey', 'close context menu', this, menuState]);
    eventNav.unsetGlobalBehaviorOverrides(this);
    this.activeNode = null;
    menuState?.set(null);
  }
}

interface ContextMenuHaver extends Node {
  contextMenu: VM.ContextMenu;
}

export function hasContextMenu(node: Node): node is ContextMenuHaver {
  return (node as ContextMenuHaver).contextMenu instanceof VM.ContextMenu;
}

export function getBatchActions(nodes: VM.Node[]): ActionGroup[] {
  // actions for each node -- do not separate!
  const groupActions = nodes.map((node) => node.getActions());
  if (groupActions.length === 0) return [];

  const actionsByNode = groupActions.map((actionGroups) => {
    const mapped: { [label: string]: Action } = {};
    function condenseAction(action: Action, prefix: string) {
      const { label: subLabel, subActions } = action;
      if (subActions?.length) subActions.forEach((axn) => condenseAction(axn, `${prefix}__${subLabel}`));
      mapped[`${prefix}__${subLabel}`] = action;
    }
    actionGroups.forEach((val) => {
      const { label, actions } = val;

      actions.forEach((action) => {
        condenseAction(action, label);
      });
    });
    return mapped;
  });
  // We only want to support batch actions whenever ALL items in the selection can have that action be applied to it
  const commonActionKeys = intersection(...actionsByNode.map((x) => Object.keys(x)));
  type IndexedAction = { [label: string]: Action[] };
  let indexed: IndexedAction = {};
  for (const key of commonActionKeys) {
    const labels = key.split('__');
    const [label, ...l] = labels;
    indexed[`${label}s`] ||= [];
    const k = actionsByNode[0][key];
    if (!k) {
      console.log('key not found', key);
      continue;
    }
    if (l.length > 1) continue;
    const { subActions, apply, ...rest } = actionsByNode[0][key];
    const newAction: Action = { ...rest };
    const undoManager = useUndoManager();
    if (subActions?.length) {
      newAction.subActions = subActions.map((subAction) => {
        return {
          ...subAction,
          apply: () => {
            const { label } = subAction;
            const subkey = `${key}__${label}`;
            undoManager.begin();
            actionsByNode.forEach((action) => {
              action[subkey]?.apply?.();
            });
            undoManager.commit();
          },
        };
      });
    }
    if (apply) {
      newAction.apply = () => {
        undoManager.begin();
        actionsByNode.forEach((action) => {
          action[key].apply?.();
        });
        undoManager.commit();
      };
    }
    indexed[`${label}s`].push(newAction);
  }

  return Object.entries(indexed)
    .map(([label, actions]) => {
      if (actions.length === 0) return null;
      return {
        label,
        actions,
      };
    })
    .filter(Boolean) as ActionGroup[];
}
