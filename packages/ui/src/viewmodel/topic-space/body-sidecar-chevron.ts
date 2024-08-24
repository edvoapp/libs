import { ChildNode, ChildNodeCA, Node } from '../base';
import { Behavior, DispatchStatus, EventNav } from '../../service';
import { Member } from './member';

interface CA extends ChildNodeCA<Member> {}

export class SidecarChevron extends ChildNode<Member> {
  getLocalBehaviors(): Behavior[] {
    return [new Trigger()];
  }

  static new(args: CA) {
    const me = new SidecarChevron(args);
    me.init();
    return me;
  }
}

class Trigger extends Behavior {
  handleMouseDown(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const node = originNode.findClosest((x) => x instanceof SidecarChevron && x);
    if (!node) return 'decline';
    node.parentNode.toggleSidecarExpanded(null);
    return 'stop';
  }
}
