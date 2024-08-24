import { VertexNode } from './base/vertex-node';
import { Node, NodeCA } from './base/view-model-node';
import { Observable } from '@edvoapp/util';

export class ArrowDragHandle extends Node<VertexNode> {
  allowHover = true;
  static new(args: NodeCA<VertexNode>) {
    const me = new ArrowDragHandle(args);
    me.init();
    return me;
  }
  get cursor(): string {
    return 'pointer';
  }
}
