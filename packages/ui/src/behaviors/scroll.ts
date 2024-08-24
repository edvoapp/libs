import { Behavior, DispatchStatus, EventNav } from '../service';
import * as VM from '../viewmodel';

export class Scroll extends Behavior {
  handleWheel(eventNav: EventNav, e: WheelEvent, originNode: VM.Node): DispatchStatus {
    if (e.deltaX !== 0) return 'decline';
    // if this node is focused, then allow the native behavior (ie scroll)
    return originNode.isFocused.value ? 'native' : 'decline';
  }
}
