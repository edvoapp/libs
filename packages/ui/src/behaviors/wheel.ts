import { Behavior, DispatchStatus, EventNav } from '../service';
import * as VM from '../viewmodel';

export class Wheel extends Behavior {
  handleWheel(eventNav: EventNav, e: WheelEvent, originNode: VM.Node): DispatchStatus {
    // if we are swiping left, decline because otherwise native OS settings could make weird things happen
    if (e.deltaX !== 0) return 'decline';
    // wheel events should always return native
    return 'native';
  }
}
