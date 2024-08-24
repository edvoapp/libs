import { Behavior, DispatchStatus } from '../service';
import { EventNav, VM } from '..';
import { toast } from 'react-toastify';

export class MouseActionProperty extends Behavior {
  handleMouseUp(eventNav: EventNav, event: MouseEvent, originNode: VM.Node): DispatchStatus {
    const node = originNode.findClosest((n) => n instanceof VM.OutlineItem && n);
    if (!node) return 'decline';

    const action = node.action.value;
    if (!action) return 'decline';
    if (action.test_message) {
      toast(action.test_message);
    }
    return 'decline';
  }
}
