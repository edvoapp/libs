import * as Bindings from '@edvoapp/wasm-bindings';
import { ChildNode, ChildNodeCA } from './base';

//
interface CA extends ChildNodeCA<any> {
  text: string;
}

export class TextChunk extends ChildNode implements Bindings.TSChunk {
  text: string;
  constructor(args: CA) {
    super(args);
    this.text = args.text;
  }

  static new(args: CA) {
    const me = new TextChunk(args);
    me.init();
    return me;
  }

  intersectScreenpoint(clientPoint: { x: number; y: number }): boolean {
    const rects = this.domElement?.getClientRects();
    if (!rects) return super.intersectScreenpoint(clientPoint);
    for (const box of rects) {
      if (
        clientPoint.x >= box.left &&
        clientPoint.x <= box.right &&
        clientPoint.y >= box.top &&
        clientPoint.y <= box.bottom
      )
        return true;
    }
    return false;
  }

  // Returns the text node under the span
  get contentForwardNode(): Node {
    return this.domElement!.childNodes[0]!;
  }
  get contentBackwardNode(): Node {
    return this.contentForwardNode;
  }
  // Indicate that we should be making our selection on the text node itself
  get contentDivisible(): boolean {
    return this.text.length !== 0;
  }

  chunk_length(): number {
    return this.text.length;
  }
}
