import { VertexNode, VertexNodeCA, Node } from '../base';
import { OutlineItem } from './outline-item';

interface CA extends VertexNodeCA<OutlineItem> {}

export class OutlineItemHandle extends VertexNode<OutlineItem> {
  get dragHandle(): boolean {
    return true;
  }

  static new(args: CA) {
    const me = new OutlineItemHandle(args);
    me.init();
    return me;
  }
}
