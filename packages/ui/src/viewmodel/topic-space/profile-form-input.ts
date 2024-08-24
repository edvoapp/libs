import { Node, NodeCA } from '../base';
import { Behavior } from '../../service';
import { PointerFocus } from '../../behaviors';

interface CA extends NodeCA<any> {}

export class ProfileFormInput extends Node<any> {
  getLocalBehaviors(): Behavior[] {
    // TODO: make this generic across all inputs, perhaps with a generic Input VM node, that will handle focus, cmd-a, etc
    return [new PointerFocus()];
  }

  static new(args: CA) {
    const me = new ProfileFormInput(args);
    me.init();
    return me;
  }
}
