import { Node, VertexNode, VertexNodeCA } from '../base';

interface CA extends VertexNodeCA {}

export class EmptyBrowser extends VertexNode {
  static new(args: CA) {
    const me = new EmptyBrowser(args);
    me.init();
    return me;
  }

  get focusable() {
    return true;
  }
}
