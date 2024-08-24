import { ChildNode, ChildNodeCA, Node } from '../base';

export class MyUniverse extends ChildNode {
  static new(args: ChildNodeCA<any>) {
    const me = new MyUniverse(args);
    me.init();
    return me;
  }
}
