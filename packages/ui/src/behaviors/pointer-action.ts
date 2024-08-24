import { Observable, OwnedProperty, WeakProperty } from '@edvoapp/util';
import { Behavior, DispatchStatus, EventNav } from '../service';
import * as VM from '../viewmodel';

export interface Clickable extends VM.Node {
  onClick: (e: MouseEvent) => void | boolean | null | undefined;
}

export function isClickable(node: VM.Node): node is Clickable {
  return (node as Clickable).onClick instanceof Function;
}

/**
 * Handles Hover and "Click" behaviors for ViewModelNodes which are capable of one or both.
 */
export class PointerAction extends Behavior {
  @WeakProperty
  activeHover: VM.Node | null = null;
  isClicking = false;

  handleMouseMove(_eventNav: EventNav, _e: MouseEvent, origin: VM.Node): DispatchStatus {
    let acted = false;

    const cursor = origin.cursor;
    this.trace(10, () => ['pointer-action', origin, cursor]);
    document.documentElement.style.cursor = cursor;
    if (cursor !== 'default') acted = true;

    // Find the closest hoverable node
    const node = origin.findClosest((n) => n.allowHover && n);

    if (this.activeHover && this.activeHover != node) {
      // Recurse upward unsetting the hover - stopping if we find a node that contains the newly hovered node
      // This is to avoid flickering as would be the case with setting it to false and then right back to true
      if (node && this.activeHover.upgrade()?.contains(node)) {
        this.activeHover.setHover('branch');
      } else {
        this.activeHover.setHover(false);
      }
      this.activeHover = null;
    }

    // if (!node) return 'decline';
    if (node) {
      node.setHover('leaf');
      this.activeHover = node;
      acted = true;
    }

    return acted ? 'continue' : 'decline';
  }
  handleSingleClick = false;

  handleMouseDown(eventNav: EventNav, e: MouseEvent, origin: VM.Node): DispatchStatus {
    // Find the closest clickable node.
    // NOTE: It's conceivable that we could do a preflight starting from
    // the root asking if the children are clickable BEFORE asking each child itself
    // But at least based on the scenarios presently under consideration, it's not
    // immediately obvious why this is better than the opaque flag in getNodeAtScreenPoint
    const node = origin.findClosest((n) => isClickable(n) && n);
    if (!node) return 'decline';

    const skipOverride = node.onClick(e);
    if (!skipOverride) {
      this.isClicking = true;
      eventNav.setGlobalBehaviorOverrides(this, ['handleMouseUp']);
    }
    return 'stop';
  }

  handleMouseUp(eventNav: EventNav, _e: MouseEvent, _origin: VM.Node): DispatchStatus {
    eventNav.unsetGlobalBehaviorOverrides(this);
    const isClicking = this.isClicking;
    this.isClicking = false;
    return isClicking ? 'stop' : 'decline';
  }
}
