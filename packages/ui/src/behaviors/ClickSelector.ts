import { Behavior, DispatchStatus, EventNav, isMetaClick } from '../service';

import * as VM from '../viewmodel';

// Lasso = the selecty-box overlay with
// SelectionRage = the starting and ending point of a selection within a linear or tree context
// SelectingSet = the set of items which are bounded by EITHER a lasso OR a SelectionRange

// TODO - move this logic into Behavior.Selection
export class ClickSelector extends Behavior {
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    const node = originNode.findClosest(
      (n) => (n instanceof VM.Member && n) || (n instanceof VM.OutlineItem && n) || (n instanceof VM.ContentCard && n),
    );
    if (!node) return 'decline';

    const metaClick = isMetaClick(e);
    const isMember = node instanceof VM.Member;
    const isContent = node instanceof VM.ContentCard;

    if ((isMember || isContent) && metaClick) {
      const currentFocus = eventNav.focusState.currentFocus;
      const currentFocusIsMemberOrContent = currentFocus?.findClosest(
        (n) => (n instanceof VM.Member || n instanceof VM.ContentCard) && n,
      );
      if (currentFocusIsMemberOrContent) {
        // if we are currently focused on a card, we want to blur our focus and add it to our selection state
        eventNav.focusState.blur();
        // add selection
        eventNav.selectionState.addSelect([currentFocusIsMemberOrContent]);
      }
      eventNav.selectionState.toggleSelect([node]);
      return 'stop';
    }
    return 'decline';
  }

  // handleKey(
  //   eventNav: EventNav,
  //   e: KeyboardEvent,
  //   node: VM.Node,
  // ): DispatchStatus {
  //   const { key } = e;
  //   switch (key) {
  //     case 'Esc': // IE/Edge specific value
  //     case 'Escape':
  //       // Do something for "esc" key press.
  //       eventNav.selectionState.clear();
  //       return 'stop';
  //     default:
  //       return 'decline';
  //   }
  // }
}
