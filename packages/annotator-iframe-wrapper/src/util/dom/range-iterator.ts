import { RangeProxy } from './range';
import {
  getClosestAncestorIn,
  getNodeLength,
  getRangeDocument,
  isCharacterDataNode,
  isNonTextPartiallySelected,
  isOrIsAncestorOf,
  removeNode,
} from './utils';

export class RangeIterator {
  range: RangeProxy | null;
  clonePartiallySelectedTextNodes?: boolean;
  startContainer: Node | null;
  startOffset: number | null;
  endContainer: Node | null;
  endOffset: number | null;
  isSingleCharacterDataNode?: boolean;
  private _first: Node | null;
  private _last: Node | null;
  private _next: Node | null;
  private _current: Node | null;

  constructor(range: RangeProxy, clonePartiallySelectedTextNodes?: boolean) {
    this.range = range;
    this.clonePartiallySelectedTextNodes = clonePartiallySelectedTextNodes;
    this.startContainer = null;
    this.startOffset = null;
    this.endContainer = null;
    this.endOffset = null;
    this._first = null;
    this._last = null;
    this._next = null;
    this._current = null;

    if (!range.collapsed) {
      const { startContainer, startOffset, endContainer, endOffset, commonAncestorContainer } = range;
      this.startContainer = startContainer;
      this.startOffset = startOffset;
      this.endContainer = endContainer;
      this.endOffset = endOffset;
      const root = commonAncestorContainer;

      if (this.startContainer === this.endContainer && isCharacterDataNode(this.startContainer)) {
        this.isSingleCharacterDataNode = true;
        this._first = this._last = this._next = this.startContainer;
      } else {
        this._first = this._next =
          this.startContainer === root && !isCharacterDataNode(this.startContainer)
            ? this.startContainer.childNodes[this.startOffset]
            : getClosestAncestorIn(this.startContainer, root, true);

        this._last =
          this.endContainer === root && !isCharacterDataNode(this.endContainer)
            ? this.endContainer.childNodes[this.endOffset - 1]
            : getClosestAncestorIn(this.endContainer, root, true);
      }
    }
  }

  reset() {
    this._current = null;
    this._next = this._first;
  }

  hasNext() {
    return !!this._next;
  }

  next() {
    // Move to next node
    let current = (this._current = this._next as Text);
    if (current) {
      this._next = current !== this._last ? current.nextSibling : null;
      // Check for partially selected text nodes
      if (isCharacterDataNode(current) && this.clonePartiallySelectedTextNodes) {
        if (current === this.endContainer) {
          current = current.cloneNode(true) as Text;
          current.deleteData(this.endOffset as number, current.length - (this.endOffset as number));
        }
        if (this._current === this.startContainer) {
          current = current.cloneNode(true) as Text;
          current.deleteData(0, this.startOffset as number);
        }
      }
    }

    return current;
  }

  remove() {
    const current = this._current as Text;
    if (!current) return;
    let start;
    let end;

    if (isCharacterDataNode(current) && (current === this.startContainer || current === this.endContainer)) {
      start = current === this.startContainer ? (this.startOffset as number) : 0;
      end = current === this.endContainer ? (this.endOffset as number) : current.length;
      if (start != end) {
        current.deleteData(start, end - start);
      }
    } else {
      if (current.parentNode) {
        removeNode(current);
      } else {
        // do nothing
      }
    }
  }

  // Checks if the current node is partially selected
  isPartiallySelectedSubtree() {
    if (!this._current || !this.range) return;
    return isNonTextPartiallySelected(this._current, this.range);
  }

  getSubtreeIterator(): RangeIterator | void {
    let subRange;
    if (!this.range) return;
    if (this.isSingleCharacterDataNode) {
      subRange = this.range.cloneRange();
      subRange?.collapse(false);
    } else {
      subRange = new RangeProxy(getRangeDocument(this.range));
      const current = this._current;
      if (!current || !this.startContainer || !this.endContainer || !this.startOffset || !this.endOffset) return;
      let startContainer = current,
        startOffset = 0,
        endContainer = current,
        endOffset = getNodeLength(current);

      if (isOrIsAncestorOf(current, this.startContainer)) {
        startContainer = this.startContainer;
        startOffset = this.startOffset;
      }
      if (isOrIsAncestorOf(current, this.endContainer)) {
        endContainer = this.endContainer;
        endOffset = this.endOffset;
      }

      subRange.updateBoundaries(startContainer, startOffset, endContainer, endOffset);
    }
    return new RangeIterator(subRange, this.clonePartiallySelectedTextNodes);
  }

  detach() {
    this.range =
      this._current =
      this._next =
      this._first =
      this._last =
      this.startContainer =
      this.startOffset =
      this.endContainer =
      this.endOffset =
        null;
  }
}
