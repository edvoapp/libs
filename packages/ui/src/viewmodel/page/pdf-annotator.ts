import { MemoizeOwned } from '@edvoapp/util';

import { VertexNode, VertexNodeCA, Node } from '../base';
import { Outline } from '../outline/outline';

export class PdfAnnotator extends VertexNode {
  static new(args: VertexNodeCA) {
    const me = new PdfAnnotator(args);
    me.init();
    return me;
  }
  get childProps(): (keyof this & string)[] {
    return ['outline'];
  }

  @MemoizeOwned()
  get outline() {
    return Outline.new({
      parentNode: this,
      context: this.context,
      vertex: this.vertex,
    });
  }
}
