import { Model, trxWrapSync } from '@edvoapp/common';

import { Action, ActionGroup, Behavior, DispatchStatus, equalsKey, EventNav } from '../service';
import * as VM from '../viewmodel';
import { activeConversationObs } from '../components/conversation-modal/conversation-modal';
import { ObservableList, useUndoManager } from '@edvoapp/util';
import { DeleteLeft } from '../assets';

export class UnlinkItem extends Behavior {
  getActions(originNode: VM.Node): ActionGroup[] {
    const actions: Action[] = [];

    const node = originNode.findClosest((n) => (n instanceof VM.BranchNode || n instanceof VM.RelationNode) && n);
    if (!node) return [];

    let label;
    if (node instanceof VM.Member) {
      label = 'Remove from space';
    } else {
      label = 'Remove item';
    }
    actions.push({
      icon: DeleteLeft,
      label,
      apply: () => {
        UnlinkItem.unlinkNodes([node]);
        activeConversationObs.set(null);
      },
    });

    return [{ label: node.label, actions }];
  }
  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: VM.Node): DispatchStatus {
    if (!equalsKey('backspace')) return 'decline';
    const selection = eventNav.selectionState.selection.value;

    UnlinkItem.unlinkNodes(selection.length > 0 ? selection.sort((a, b) => a.index - b.index) : [originNode]);

    //     const upwardNode = node.upwardNode();
    //     acc.nodesToArchive.push(closestBranch);
    //     if (!acc.nodeToFocus) acc.nodeToFocus = upwardNode;
    //     return acc;
    // if (nodeToFocus) {
    //   eventNav.focusState.setFocus(nodeToFocus, {
    //     selectionStart: 'end',
    //     selectionEnd: 'end',
    //   });
    // }
    return 'stop';
  }

  static unlinkNodes(originNodes: VM.Node[]) {
    const backrefs: Model.Backref[] = [];
    // determine the common

    originNodes.forEach((node) => {
      const closestBranch = node.findClosest((n) => (n instanceof VM.BranchNode || n instanceof VM.RelationNode) && n);
      if (closestBranch?.backref.editable) {
        backrefs.push(closestBranch.backref);
      }
    });

    {
      const firstNode = originNodes[0];
      const eventNav = firstNode.context.eventNav;
      const focusState = eventNav.focusState;
      const selectionState = eventNav.selectionState;

      focusState.blur();
      selectionState.clear();

      if (firstNode instanceof VM.Member) {
        firstNode.breakImplicitRelationships();
      }
    }

    let archived = new ObservableList<
      Model.Vertex | Model.Backref | Model.Edge | Model.Property | Model.TimelineEvent
    >().leak();

    useUndoManager().add_action(
      () => {
        // DO
        trxWrapSync((trx) => {
          backrefs.forEach((backref) => {
            archived.insert(backref);
            backref.archive(trx);
          });
        });
      },
      () => {
        // UNDO
        trxWrapSync((trx) => {
          archived.forEach((backref) => backref.unarchive(trx));
        });
      },
    );
  }
}
