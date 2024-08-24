import { Behavior, DispatchStatus, EventNav } from '../service';
import * as VM from '../viewmodel';

export class UserPresenceBehavior extends Behavior {
  handleMouseMove(_eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    const space = originNode.findClosest((n) => n instanceof VM.TopicSpace && n);
    if (!space) return 'decline';
    const { clientX: clientMouseX, clientY: clientMouseY } = e;

    const { x, y } = space.clientCoordsToSpaceCoords({
      x: clientMouseX,
      y: clientMouseY,
    });
    space.userPresence.value?.setPointer({ x, y });
    return 'continue';
  }

  handleMouseLeave(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    const space = originNode.findClosest((n) => n instanceof VM.TopicSpace && n);
    if (!space) return 'decline';
    space.userPresence.value?.setPointer(null);
    return 'continue';
  }
}
