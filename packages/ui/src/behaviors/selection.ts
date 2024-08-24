import { OwnedProperty } from '@edvoapp/util';
import { Behavior, EventNav, DispatchStatus, FocusContext, isMetaClick, computeSelection } from '../service';

import * as VM from '../viewmodel';
import { sanitizeFocusContext } from './key-focus';

export class Selection extends Behavior {
  @OwnedProperty
  originNode: VM.OutlineItem | null = null;
  handleMouseDown(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    if (this.originNode) {
      // if we are mouse-downing on a child of anything that is selected, this indicates we probably want to drag.
      // Yield to drag behavior (though this is also wrong, but we can't quite compose behaviors yet)
      if (eventNav.selectionState.selection.value.some((n) => n.contains(originNode))) {
        return 'decline';
      }
      this.clearSelectionState(eventNav);
      return 'continue';
    }
    return 'decline';
  }

  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    // if we have an origin node, then we want someone else to handle this
    if (this.originNode) {
      return 'stop';
    }

    // Currently we are only capable of selecting Members and OutlineItems.
    // Other things may be selectable in the future, and those should be managed by this behavior.
    const node = originNode.findClosest((n) => (n instanceof VM.Member && n) || (n instanceof VM.OutlineItem && n));

    // We did not click on a selectable node. Bail out
    if (!node) return 'decline';

    const isShiftClick = e.shiftKey; // do we actually get this on a click event? Should we use Eventnav.keydown?
    const metaClick = isMetaClick(e);

    if (node instanceof VM.Member && (isShiftClick || metaClick)) {
      eventNav.selectionState.toggleSelect([node]);
      return 'stop';
    }

    if (node instanceof VM.OutlineItem) {
      if (metaClick) {
        eventNav.selectionState.toggleSelect([node]);
        return 'stop';
      } else if (isShiftClick) {
        // TODO - figure out how to select ranges among the same outline
        return 'stop';
      }
    }

    return 'decline';
  }

  handleMouseMove(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    if (e.buttons === 0) return 'decline';
    const focused = eventNav.focusState.currentFocus?.findClosest((n) => n instanceof VM.OutlineItem && n);
    const node = originNode.findClosest((n) => n instanceof VM.OutlineItem && n);
    if (!focused || !node) return 'decline';
    if (!this.originNode) this.originNode = focused;
    const selection = computeSelection(this.originNode, node);
    eventNav.selectionState.setSelect(selection);
    return 'stop';
  }

  lastFocusCtx?: FocusContext | null;

  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: VM.Node): DispatchStatus {
    const { key, shiftKey } = e;
    let focusNode: VM.Node | null = null;
    let ctx: FocusContext | null = null;
    const selectionState = eventNav.selectionState;
    const focusState = eventNav.focusState;

    // HACK - yielding (maybe)
    // TODO - remove this. OutlineItemSelector should probably merge with with the other selection code
    // Maybe it's already handling Member selection, and the name is just wrong?
    if (selectionState.size && ['Esc', 'Escape'].includes(key)) {
      // don't handle if selection is up because of focus, let focus handle deselection
      if (!(selectionState.size === 1 && selectionState.selection.value[0] === focusState.currentFocus)) {
        this.clearSelectionState(eventNav);
        return 'continue';
      }
    }

    const currentFocus = focusState.currentFocus?.findClosest((n) => n instanceof VM.OutlineItem && n);
    if (!currentFocus) return 'decline';
    // const edge = this.lastFocusCtx?.edge;
    if (shiftKey) {
      // let sortedSelection = selectionState.selection.sort(
      //   (a, b) => a.index - b.index,
      // );
      // let first = sortedSelection[0];
      // let last = sortedSelection[sortedSelection.length - 1];

      // This isn't quite right, but I'm having trouble figuring out how to make it right
      if (['Up', 'ArrowUp'].includes(key)) {
        // if (edge === 'bottom') {
        //   // was going up, then hit up, expand selection
        //   focusNode =
        //     first?.prevSibling() ||
        //     first?.upwardNode() ||
        //     originNode.upwardNode();
        // } else if (edge === 'top') {
        //   // was going down, then hit up, shrink selection
        //   focusNode =
        //     last?.prevSibling() ||
        //     last?.upwardNode() ||
        //     originNode.upwardNode();
        // } else {
        const nodeAndContext = originNode.upwardNode();
        if (nodeAndContext) {
          focusNode = nodeAndContext.node;
          ctx = sanitizeFocusContext(nodeAndContext.ctx, {
            edge: 'bottom',
            trigger: 'key',
            selecting: true,
          });
        }
        // }
      }
      if (['Down', 'ArrowDown'].includes(key)) {
        // if (edge === 'top') {
        //   // was going down, then hit down, expand selection
        //   focusNode =
        //     last?.prevSibling() ||
        //     last?.upwardNode() ||
        //     originNode.downwardNode();
        // } else if (edge === 'bottom') {
        //   // was going up, then hit down, shrink selection
        //   focusNode =
        //     first?.prevSibling() ||
        //     first?.upwardNode() ||
        //     originNode.downwardNode();
        // } else {

        // Precedence based decisionmaking - if we're here, then we're making decisions about the outline item. Not about other stuff.
        const nodeAndContext = originNode.downwardNode();
        if (nodeAndContext) {
          focusNode = nodeAndContext.node;
          ctx = sanitizeFocusContext(nodeAndContext.ctx, {
            edge: 'top',
            trigger: 'key',
            selecting: true,
          });
        }
        // }
      }

      const closestOutlineItem = focusNode?.findClosest((n) => n instanceof VM.OutlineItem && n);
      if (closestOutlineItem) focusNode = closestOutlineItem;
      if (!(focusNode instanceof VM.OutlineItem) || !ctx) return 'decline';
      if (!this.originNode) {
        this.originNode = currentFocus;
      }
      // eventNav.selectionState.addSelect([this.originNode, focusNode]);
      let selection = computeSelection(this.originNode, focusNode);
      selectionState.setSelect(selection);
      void eventNav.focusState.setFocus(focusNode, ctx);
      this.lastFocusCtx = ctx;
      return 'stop';
    } else if (['Arrow', 'Down', 'Up', 'Left', 'Right'].some((k) => k.includes(key) || key.includes(k))) {
      this.clearSelectionState(eventNav);
      return 'continue';
    }

    return 'decline';
  }

  clearSelectionState(eventNav: EventNav) {
    this.originNode = null;
    eventNav.selectionState.clear();
  }
}

// maybe make this a utility function
function debug<T>(v: T, msg?: string): T {
  // console.log('debug', msg, v);
  return v;
}
