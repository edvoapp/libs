import { Behavior, DispatchStatus, EventNav, FocusContext, FocusTarget } from '../service';

import * as VM from '../viewmodel';

// Lasso = the selecty-box overlay with
// SelectionRage = the starting and ending point of a selection within a linear or tree context
// SelectingSet = the set of items which are bounded by EITHER a lasso OR a SelectionRange

export class PointerFocus extends Behavior {
  getFocusTarget(target: FocusTarget, prevFocus: FocusTarget | null): VM.Node | null {
    if (target.focusable) {
      // check if we are clicking twice to focus inwards
      if (prevFocus === target) {
        return target.findChild((n) => n.focusable && n) ?? null;
      }
      return target;
    } else {
      return target.findChild((n) => n.focusable && n) ?? null;
    }
  }

  // We do this on mouseUp because we don't know if we are dragging or clicking until mouseup
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    const context: FocusContext = originNode.getFocusContextForEvent(e);
    const selected = originNode.findClosest((n) => n.isSelected.value && n);
    const prevFocus = eventNav.focusState.currentFocus;
    if (originNode instanceof VM.MemberSelectionBox) return 'decline';

    const target = this.getFocusTarget(originNode, prevFocus);
    this.trace(4, () => ['handleMouseUp', 'focusContext', originNode, context, target]);

    if (target) {
      if (!selected) eventNav.selectionState.clear(); // if I am clicking on a selected item, don't deselect.

      eventNav.focusState.setFocus(target, context);

      return 'stop';
    } else {
      return 'decline';
    }
  }
}
