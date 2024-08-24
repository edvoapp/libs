import { VertexNode, VertexNodeCA } from '../base';

export class InfinityMirror extends VertexNode {
  static new(args: VertexNodeCA) {
    const me = new InfinityMirror(args);
    me.init();
    return me;
  }
}
