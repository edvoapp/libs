import { Behavior, EventNav, DispatchStatus } from '../service';
import * as VM from '../viewmodel';

export class CenterViewport extends Behavior {
  constructor() {
    super();
  }
  handleDoubleClick(eventNav: EventNav, _e: MouseEvent, node: VM.Node): DispatchStatus {
    const nearestSpace = node.findClosest((n) => n instanceof VM.TopicSpace && n);

    if (!nearestSpace || !eventNav.downKeys.has('shift')) return 'decline';
    if (node instanceof VM.Member) nearestSpace.zoomToMember(node);
    return 'stop';
  }
}
