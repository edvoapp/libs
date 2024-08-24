import { Node, ChildNodeCA, ChildNode } from './base';
import { Observable } from '@edvoapp/util';
import { TagSearch } from './tag-search';
import { Behavior, DispatchStatus, EventNav } from '../service';

interface CA extends ChildNodeCA<Node> {}

export class TagSearchInput extends ChildNode<Node> {
  static new(args: CA) {
    const me = new TagSearchInput(args);
    me.init();
    return me;
  }
  getLocalBehaviors(): Behavior[] {
    return [new KeyDown()];
  }
}

class KeyDown extends Behavior {
  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, node: Node): DispatchStatus {
    if (['ArrowUp', 'Up', 'ArrowDown', 'Down'].includes(e.key)) return 'native';
    return 'decline';
  }
}
