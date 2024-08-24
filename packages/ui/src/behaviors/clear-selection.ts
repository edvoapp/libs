import { Behavior, DispatchStatus, EventNav } from '..';
import * as VM from '../viewmodel';

export class ClearSelection extends Behavior {
  handleMouseUp(eventNav: EventNav, e: MouseEvent, node: VM.Node): DispatchStatus {
    eventNav.selectionState.clear();
    return 'continue';
  }
}
