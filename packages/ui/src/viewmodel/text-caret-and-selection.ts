import { Observable, OwnedProperty, getWasmBindings } from '@edvoapp/util';
import { NodeCA, Node as VMNode, ConditionalNode, BoundingBox } from './base';
import { ActionMenu, Member, MemberHeader } from './topic-space';
import { consolidateRects } from '@edvoapp/util';
import { TextField, VMChunk } from './text-field';
import * as Bindings from '@edvoapp/wasm-bindings';

/** The current calculated screen position for a text caret and selection relative to the text field */
export interface ScreenCoords {
  caret: {
    x: number;
    y: number;
    height: number;
  };
  boxes: Array<BoundingBox>;
}

// When do we need to recalculate this?
// [X] When the text gets updated (even if the string text is the same, the ContentRangeOffset could be different)
// [X] When the ContentRange changes (user typed a character, or hit BACKSPACE, or clicked or whatever)
// [X] When the text field is resized
export class TextCaretAndSelection extends VMNode<ConditionalNode<TextCaretAndSelection, any, TextField>> {
  @OwnedProperty
  screenCoords: Observable<ScreenCoords | null>;

  constructor(args: NodeCA<ConditionalNode<TextCaretAndSelection, any, TextField>>) {
    super(args);
    this.screenCoords = new Observable<ScreenCoords | null>(null);

    // MAIN QUESTION IS: which ViewModel node should calculate contentRangeOffsets?
    // TextRange? or TextField?
    // * If it's TextRange (this VM node)
    //    PRO: that might give us a more self-contained factorization (There's a bit of a mixing of concerns right now between TextField and TextRange)
    //    CON: We might redundantly calculate contentRangeOffsets and thus be less performant across a large topic space full of various text fields
    // * If it's TextField (which is currently calculating contentRangeOffsets)
    //   PRO: it's less change
    //   PRO: a bit more efficient: Calculating contentRangeOffsets only in one place
    //   CON: is a bit messier (blending of concerns)

    this.onCleanup(
      this.parentNode.parentNode.itemList.subscribe(() => {
        this.recalculate();
      }, true),
    );
  }

  static new(args: NodeCA<ConditionalNode<TextCaretAndSelection, any, TextField>>) {
    const me = new TextCaretAndSelection(args);
    me.init();
    return me;
  }

  #hasScheduledRecalculation = false;

  /** Recalculate the screenCoords */
  recalculate() {
    if (!this.#hasScheduledRecalculation) {
      this.#hasScheduledRecalculation = true;
      // Schedule the screenCoord recalculation to happen when we hit the idle task.
      // Any Preact render cycles which will occur should be scheduled already, and thus happen before we are scheduled
      this.defer(() => {
        this.#hasScheduledRecalculation = false;
        this.screenCoords.set(this._recalculate());
      });
    }
  }

  private _recalculate(): ScreenCoords | null {
    const p = this.parentNode;
    if (!p) return null;
    const textField = p.parentNode;
    if (!textField) return null;

    const offsets: Bindings.ContentRangeOffsets | undefined = textField.textRangeOffsets;

    if (!offsets) return null;

    const el = textField.domElement;
    // Check to make sure the textField DOM element is bound. We need this to query the DOM layout system
    // to determine where the caret and selected text is on the screen.
    if (!el) return null;

    // Measure the caret separately from the boxes because we want the caret range to always be expanded (except when it's the very end of the text)
    // This will help to force the caret to the lower line when a position at the end of a line can be ambiguously represented.
    // Create a brand new (browser native) Range object to query the layout system
    let caretRange = document.createRange();

    // Walk nodes over textField (VM) children
    // to get the first/last VM nodes
    // Then

    // You can walk over EITHER the VM tree OR the DOM tree. They both work
    // But walking over the VM tree is more future proof, and you can still get the domElement out of the VM node (but not the reverse)

    let items = textField.contentItems.value;
    if (items.length == 0) return null;

    const [leftVMNode, leftVMNodeOffset] = getNodeOffset(items[0], offsets.min);
    const [rightVMNode, rightVMNodeOffset] = getNodeOffset(items[0], offsets.max);

    // EXAMPLE:
    // VM Objects mapped from DataChunks:
    // [{type:text, length:12}, {type: embed, length: 1}, {type: text, length: 12}]

    // DOM:
    // <div>text node |*min*1 <div>lozenge 1</div> text *max*node 2</div>

    // We need the end node+offset even if it's before the start,
    // because that's how carets are placed
    const caretOffset = offsets.reversed
      ? { node: leftVMNode, offset: leftVMNodeOffset }
      : { node: rightVMNode, offset: rightVMNodeOffset };

    try {
      // Set BOTH the start and end of the range to the end of our Offsets
      // because the caret is always at the "end" (even if it's reversed/before the start)

      // This code works OK **IF** you only have one text node. IE: <div>text node here</div>
      // But it doesn't work at all if you have multiples. IE: <div>text node 1 <div>lozenge 1</div> text node 2</div>

      if (caretOffset.node.contentDivisible) {
        caretRange.setStart(caretOffset.node.contentForwardNode, caretOffset.offset);
        caretRange.setEnd(
          caretOffset.node.contentForwardNode,
          // Force the range to be expanded by one character
          Math.min(caretOffset.offset + 1, caretOffset.node.chunk_length()), // It will get mad if set setEnd with a larger offset than the node containsd
        );
      } else {
        caretRange.setStartBefore(caretOffset.node.contentForwardNode);
        caretRange.setEndAfter(caretOffset.node.contentForwardNode);
      }
    } catch (err) {
      // The Range API gets grumpy if you tell it to start or end in an invalid place which is not representable in the DOM
      console.warn('Text Range Error', err);
      console.debug('Offset data', { parentValueNode: textField, offsets });
      return null;
    }

    const caretBox = caretRange.getBoundingClientRect();
    let boxes: Array<DOMRect> = [];

    if (!offsets.is_collapsed) {
      // Use a separate range for the boxes because we don't need to force an expanded range
      // like we do for the caret. We just skip the boxes if our offsets are collapsed

      const boxRange = document.createRange();
      // Slightly confusing because our "start"/"end" is reversable, but the native browser Range API start/end are not reversable
      // we use first/last to represent the actually earlier and later nodes in the tree

      try {
        // domElement could be null if safeBindDomElement hasn't be called, but we're already in a try so why not?

        // (HERE)<span>(OR HERE)foo</span>
        if (leftVMNode.contentDivisible) {
          boxRange.setStart(leftVMNode.contentForwardNode, leftVMNodeOffset);
        } else {
          boxRange.setStartBefore(leftVMNode.contentForwardNode);
        }

        if (rightVMNode.contentDivisible) {
          boxRange.setEnd(rightVMNode.contentForwardNode, rightVMNodeOffset);
        } else {
          boxRange.setEndAfter(rightVMNode.contentForwardNode);
        }

        // <div class="lozenge">foo</div>
        // ^maybe here. not here^--^     ^ probably here
        // TODO(FRANK): look at old PR for cases where we need to call {boxRange,caretRange}.set{Before,After}
      } catch (err) {
        // The Range API gets grumpy if you tell it to start or end in an invalid place which is not representable in the DOM
        console.warn('Text Range Error', err);
        console.debug('Offset data', { parentValueNode: textField, offsets });
        return null;
      }
      // getClientRects gives us one rectangle for each portion of each DOM node which can be described
      // Including nested nodes like <a>text</> (two nodes, two rectangles)
      // In our case we don't care about this, so we want to simplify.
      // Remove any fully contained rectangles, and combine any that can be safely combined
      boxes = consolidateRects([...boxRange.getClientRects()]);
    }

    // I was trying to be cute with reversed...
    // take the first or last box as the caret box depending on whether we are reversed
    // caretBox = reversed ? boxes[boxes.length - 1] : boxes[0];
    // but it doesn't work because of line 89

    // This takes care of when a text field is in a member header or action menu, which is outside the member body's scaling.
    const scale = this.findClosest((n) => (n instanceof MemberHeader || n instanceof ActionMenu) && n)?.clientRectObs
      .value
      ? 1
      : this.findClosest((n) => n instanceof Member && n)?.clientRectObs.value.innerScale ?? 1;

    // We need to subtract the parent box from the coordinates
    // because the caret and selection boxes are positioned
    // *relative* to the textField div, not the screen
    const textFieldBox = el.getBoundingClientRect();

    if (caretBox.height === 0) {
      return null;
    }

    const x = (caretBox.x - textFieldBox.x) / scale;
    const y = (caretBox.y - textFieldBox.y) / scale;
    const height = caretBox.height / scale; // We want to change the size of the caret depending on the font size

    return {
      caret: {
        x,
        y,
        height,
      },
      boxes: boxes.map(
        ({ x, y, height, width }) =>
          new BoundingBox({
            // We are positioning the boxes relative to the textField
            // The positioning of which is in the same coordinate system as the nearest Topic Space Member
            // All of our range measurements are in screen coordinates, so we must convert
            x: (x - textFieldBox.x) / scale,
            y: (y - textFieldBox.y) / scale,
            height: height / scale,
            width: width / scale,
          }),
      ),
    };
  }
}

// Now we have to walk backwards from there and count up all the offsets of all the nodes
// INCLUDING the portion of the node we started from.
export function getNodeOffset(firstNode: VMChunk, textFieldOffset: number): [VMChunk, number] {
  const Wasm = getWasmBindings();
  const { node, offset } = Wasm.get_vm_node_local_offset(firstNode, textFieldOffset);
  return [node.ts_node as VMChunk, offset];
}
