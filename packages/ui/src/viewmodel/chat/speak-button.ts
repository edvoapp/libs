import { ChildNode, ChildNodeCA, Node } from '../base';
import { Observable, OwnedProperty } from '@edvoapp/util';

interface CA extends ChildNodeCA<Node> {}

export class SpeakButton extends ChildNode {
  allowHover = true;
  @OwnedProperty
  active = new Observable(false);

  get cursor(): string {
    return 'pointer';
  }
  constructor({ ...args }: CA) {
    super(args);
  }

  static new(args: CA) {
    const me = new SpeakButton(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return [];
  }
}
