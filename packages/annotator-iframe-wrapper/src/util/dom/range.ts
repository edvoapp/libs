import {
  getCommonAncestor,
  getRangeDocument,
  getRootContainer,
  isCharacterDataNode,
  getDocument,
  isValidOffset,
  iterateSubtree,
  inspect,
} from './utils';
import { RangeIterator } from './range-iterator';

function isRangeValid(range: RangeProxy) {
  return (
    !!range.startContainer &&
    !!range.endContainer &&
    getRootContainer(range.startContainer) == getRootContainer(range.endContainer) &&
    isValidOffset(range.startContainer, range.startOffset) &&
    isValidOffset(range.endContainer, range.endOffset)
  );
}

function assertRangeValid(range: RangeProxy) {
  if (!isRangeValid(range)) {
    throw new Error(
      'Range error: Range is not valid. This usually happens after DOM mutation. Range: (' + range.inspect() + ')',
    );
  }
}

export class RangeProxy {
  startContainer: Node;
  startOffset: number;
  endContainer: Node;
  endOffset: number;
  document: Document;
  collapsed!: boolean;
  commonAncestorContainer!: Node;

  static rangeProperties = [
    'startContainer',
    'startOffset',
    'endContainer',
    'endOffset',
    'collapsed',
    'commonAncestorContainer',
  ];

  constructor(doc: Document) {
    this.startContainer = doc;
    this.startOffset = 0;
    this.endContainer = doc;
    this.endOffset = 0;
    this.document = doc;

    this.updateCollapsedAndCommonAncestor();
  }

  // from https://github.com/timdown/rangy/blob/master/lib/rangy-core.js#L1484
  updateBoundaries(startContainer: Node, startOffset: number, endContainer: Node, endOffset: number) {
    this.startContainer = startContainer;
    this.startOffset = startOffset;
    this.endContainer = endContainer;
    this.endOffset = endOffset;
    this.document = getDocument(startContainer);
  }
  updateCollapsedAndCommonAncestor() {
    this.collapsed = this.startContainer === this.endContainer && this.startOffset === this.endOffset;
    this.commonAncestorContainer = this.collapsed
      ? this.startContainer
      : (getCommonAncestor(this.startContainer, this.endContainer) as Node);
  }
  collapse(isStart: boolean) {
    assertRangeValid(this);
    if (isStart) {
      this.updateBoundaries(this.startContainer, this.startOffset, this.startContainer, this.startOffset);
    } else {
      this.updateBoundaries(this.endContainer, this.endOffset, this.endContainer, this.endOffset);
    }
  }

  updateRangeProperties() {
    for (let i = 0; i < RangeProxy.rangeProperties.length; i++) {
      const prop = RangeProxy.rangeProperties[i];
      // @ts-ignore
      this[prop] = this.nativeRange[prop];
    }
    // Fix for broken collapsed property in IE 9.
    this.collapsed = this.startContainer === this.endContainer && this.startOffset === this.endOffset;
  }

  cloneRange() {
    assertRangeValid(this);
    const range = new RangeProxy(getRangeDocument(this));
    let i = RangeProxy.rangeProperties.length;
    let prop;
    while (i--) {
      prop = RangeProxy.rangeProperties[i];
      // @ts-ignore
      range[prop] = this[prop];
    }
    return range;
  }

  toString() {
    assertRangeValid(this);
    const sc = this.startContainer;
    if (sc === this.endContainer && isCharacterDataNode(sc)) {
      return sc.nodeType == 3 || sc.nodeType == 4
        ? (sc as Text | CDATASection).data.slice(this.startOffset, this.endOffset)
        : '';
    } else {
      const textParts: string[] = [];
      const iterator = new RangeIterator(this, true);
      iterateSubtree(iterator, (node) => {
        // Accept only text or CDATA nodes, not comments
        if (node.nodeType == 3 || node.nodeType == 4) {
          textParts.push((node as Text | CDATASection).data);
        }
      });
      iterator.detach();
      return textParts.join('');
    }
  }
  getName() {
    return 'DomRange';
  }
  inspect() {
    return inspect(this);
  }

  // commented out stuff is stuff not currently in use but may want to refactor later
  // compareBoundaryPoints(how, range) {
  //   assertRangeValid(this);
  //   assertSameDocumentOrFragment(this.startContainer, range.startContainer);
  //
  //   var nodeA, offsetA, nodeB, offsetB;
  //   var prefixA = (how == e2s || how == s2s) ? "start" : "end";
  //   var prefixB = (how == s2e || how == s2s) ? "start" : "end";
  //   nodeA = this[prefixA + "Container"];
  //   offsetA = this[prefixA + "Offset"];
  //   nodeB = range[prefixB + "Container"];
  //   offsetB = range[prefixB + "Offset"];
  //   return comparePoints(nodeA, offsetA, nodeB, offsetB);
  // }

  // insertNode(node: Node) {
  //   assertRangeValid(this);
  //   assertValidNodeType(node, insertableNodeTypes);
  //   assertNodeNotReadOnly(this.startContainer);
  //
  //   if (isOrIsAncestorOf(node, this.startContainer)) {
  //     throw new DOMException("HIERARCHY_REQUEST_ERR");
  //   }
  //
  //   // No check for whether the container of the start of the Range is of a type that does not allow
  //   // children of the type of node: the browser's DOM implementation should do this for us when we attempt
  //   // to add the node
  //
  //   var firstNodeInserted = insertNodeAtPosition(node, this.startContainer, this.startOffset);
  //   this.setStartBefore(firstNodeInserted);
  // }

  // cloneContents() {
  //   assertRangeValid(this);
  //
  //   var clone, frag;
  //   if (this.collapsed) {
  //     return getRangeDocument(this).createDocumentFragment();
  //   } else {
  //     if (this.startContainer === this.endContainer && isCharacterDataNode(this.startContainer)) {
  //       clone = this.startContainer.cloneNode(true);
  //       clone.data = clone.data.slice(this.startOffset, this.endOffset);
  //       frag = getRangeDocument(this).createDocumentFragment();
  //       frag.appendChild(clone);
  //       return frag;
  //     } else {
  //       var iterator = new RangeIterator(this, true);
  //       clone = cloneSubtree(iterator);
  //       iterator.detach();
  //     }
  //     return clone;
  //   }
  // }

  // canSurroundContents() {
  //   assertRangeValid(this);
  //   assertNodeNotReadOnly(this.startContainer);
  //   assertNodeNotReadOnly(this.endContainer);
  //
  //   // Check if the contents can be surrounded. Specifically, this means whether the range partially selects
  //   // no non-text nodes.
  //   var iterator = new RangeIterator(this, true);
  //   var boundariesInvalid = (iterator._first && (isNonTextPartiallySelected(iterator._first, this)) ||
  //     (iterator._last && isNonTextPartiallySelected(iterator._last, this)));
  //   iterator.detach();
  //   return !boundariesInvalid;
  // }

  // surroundContents(node) {
  //   assertValidNodeType(node, surroundNodeTypes);
  //
  //   if (!this.canSurroundContents()) {
  //     throw new DOMException("INVALID_STATE_ERR");
  //   }
  //
  //   // Extract the contents
  //   var content = this.extractContents();
  //
  //   // Clear the children of the node
  //   if (node.hasChildNodes()) {
  //     while (node.lastChild) {
  //       node.removeChild(node.lastChild);
  //     }
  //   }
  //
  //   // Insert the new node and add the extracted contents
  //   insertNodeAtPosition(node, this.startContainer, this.startOffset);
  //   node.appendChild(content);
  //
  //   this.selectNode(node);
  // }
  // The methods below are all non-standard. The following batch were introduced by Mozilla but have since
  // been reoved from Mozilla.

  // compareNode(node: Node) {
  //   assertRangeValid(this);
  //
  //   var parent = node.parentNode;
  //   var nodeIndex = getNodeIndex(node);
  //
  //   if (!parent) {
  //     throw new DOMException('NOT_FOUND_ERR');
  //   }
  //
  //   var startComparison = this.comparePoint(parent, nodeIndex),
  //     endComparison = this.comparePoint(parent, nodeIndex + 1);
  //
  //   if (startComparison < 0) { // Node starts before
  //     return (endComparison > 0) ? n_b_a : n_b;
  //   } else {
  //     return (endComparison > 0) ? n_a : n_i;
  //   }
  // }

  // comparePoint(node, offset) {
  //   assertRangeValid(this);
  //   assertNode(node, 'HIERARCHY_REQUEST_ERR');
  //   assertSameDocumentOrFragment(node, this.startContainer);
  //
  //   if (comparePoints(node, offset, this.startContainer, this.startOffset) < 0) {
  //     return -1;
  //   } else if (comparePoints(node, offset, this.endContainer, this.endOffset) > 0) {
  //     return 1;
  //   }
  //   return 0;
  // }

  // creatContextualFragment: createContextualFragment;

  // toHtml() {
  //   return rangeToHtml(this);
  // }

  // touchingIsntersecting determines whether this method considers a node that borders a range intersects
  // with it (as in WebKit) or not (as in Gecko pre-1.9, and the default)
  // intersectsNode(node, touchingIsIntersecting) {
  //   assertRangeValid(this);
  //   if (getRootContainer(node) != getRangeRoot(this)) {
  //     return false;
  //   }
  //
  //   var parent = node.parentNode, offset = getNodeIndex(node);
  //   if (!parent) {
  //     return true;
  //   }
  //
  //   var startComparison = comparePoints(parent, offset, this.endContainer, this.endOffset),
  //     endComparison = comparePoints(parent, offset + 1, this.startContainer, this.startOffset);
  //
  //   return touchingIsIntersecting ? startComparison <= 0 && endComparison >= 0 : startComparison < 0 && endComparison > 0;
  // }

  // isPointInRange(node, offset) {
  //   assertRangeValid(this);
  //   assertNode(node, 'HIERARCHY_REQUEST_ERR');
  //   assertSameDocumentOrFragment(node, this.startContainer);
  //
  //   return (comparePoints(node, offset, this.startContainer, this.startOffset) >= 0) &&
  //     (comparePoints(node, offset, this.endContainer, this.endOffset) <= 0);
  // }

  // The methods below are non-standard and invented by me.
  // Sharing a boundary start-to-end or end-to-start does not count as intersection.
  // intersectsRange(range) {
  //   return rangesIntersect(this, range, false);
  // }

  // Sharing a boundary start-to-end or end-to-start does count as intersection.
  // intersectsOrTouchesRange(range) {
  //   return rangesIntersect(this, range, true);
  // }

  // intersection(range) {
  //   if (this.intersectsRange(range)) {
  //     var startComparison = comparePoints(this.startContainer, this.startOffset, range.startContainer, range.startOffset),
  //       endComparison = comparePoints(this.endContainer, this.endOffset, range.endContainer, range.endOffset);
  //
  //     var intersectionRange = this.cloneRange();
  //     if (startComparison == -1) {
  //       intersectionRange.setStart(range.startContainer, range.startOffset);
  //     }
  //     if (endComparison == 1) {
  //       intersectionRange.setEnd(range.endContainer, range.endOffset);
  //     }
  //     return intersectionRange;
  //   }
  //   return null;
  // }

  // union(range) {
  //   if (this.intersectsOrTouchesRange(range)) {
  //     var unionRange = this.cloneRange();
  //     if (comparePoints(range.startContainer, range.startOffset, this.startContainer, this.startOffset) == -1) {
  //       unionRange.setStart(range.startContainer, range.startOffset);
  //     }
  //     if (comparePoints(range.endContainer, range.endOffset, this.endContainer, this.endOffset) == 1) {
  //       unionRange.setEnd(range.endContainer, range.endOffset);
  //     }
  //     return unionRange;
  //   } else {
  //     throw new DOMException('Ranges do not intersect');
  //   }
  // }

  // containsNode(node, allowPartial) {
  //   if (allowPartial) {
  //     return this.intersectsNode(node, false);
  //   } else {
  //     return this.compareNode(node) == n_i;
  //   }
  // }

  // containsNodeContents(node) {
  //   return this.comparePoint(node, 0) >= 0 && this.comparePoint(node, getNodeLength(node)) <= 0;
  // }
  //
  // containsRange(range) {
  //   var intersection = this.intersection(range);
  //   return intersection !== null && range.equals(intersection);
  // }
  //
  // containsNodeText(node) {
  //   var nodeRange = this.cloneRange();
  //   nodeRange.selectNode(node);
  //   var textNodes = nodeRange.getNodes([3]);
  //   if (textNodes.length > 0) {
  //     nodeRange.setStart(textNodes[0], 0);
  //     var lastTextNode = textNodes.pop();
  //     nodeRange.setEnd(lastTextNode, lastTextNode.length);
  //     return this.containsRange(nodeRange);
  //   } else {
  //     return this.containsNodeContents(node);
  //   }
  // }
  //
  // getNodes(nodeTypes, filter) {
  //   assertRangeValid(this);
  //   return getNodesInRange(this, nodeTypes, filter);
  // }
  //
  // getDocument() {
  //   return getRangeDocument(this);
  // }
  //
  // collapseBefore(node) {
  //   this.setEndBefore(node);
  //   this.collapse(false);
  // }
  //
  // collapseAfter(node) {
  //   this.setStartAfter(node);
  //   this.collapse(true);
  // }
  //
  // getBookmark(containerNode) {
  //   var doc = getRangeDocument(this);
  //   var preSelectionRange = api.createRange(doc);
  //   containerNode = containerNode || dom.getBody(doc);
  //   preSelectionRange.selectNodeContents(containerNode);
  //   var range = this.intersection(preSelectionRange);
  //   var start = 0, end = 0;
  //   if (range) {
  //     preSelectionRange.setEnd(range.startContainer, range.startOffset);
  //     start = preSelectionRange.toString().length;
  //     end = start + range.toString().length;
  //   }
  //
  //   return {
  //     start: start,
  //     end: end,
  //     containerNode: containerNode,
  //   };
  // }
  //
  // moveToBookmark(bookmark) {
  //   var containerNode = bookmark.containerNode;
  //   var charIndex = 0;
  //   this.setStart(containerNode, 0);
  //   this.collapse(true);
  //   var nodeStack = [containerNode], node, foundStart = false, stop = false;
  //   var nextCharIndex, i, childNodes;
  //
  //   while (!stop && (node = nodeStack.pop())) {
  //     if (node.nodeType == 3) {
  //       nextCharIndex = charIndex + node.length;
  //       if (!foundStart && bookmark.start >= charIndex && bookmark.start <= nextCharIndex) {
  //         this.setStart(node, bookmark.start - charIndex);
  //         foundStart = true;
  //       }
  //       if (foundStart && bookmark.end >= charIndex && bookmark.end <= nextCharIndex) {
  //         this.setEnd(node, bookmark.end - charIndex);
  //         stop = true;
  //       }
  //       charIndex = nextCharIndex;
  //     } else {
  //       childNodes = node.childNodes;
  //       i = childNodes.length;
  //       while (i--) {
  //         nodeStack.push(childNodes[i]);
  //       }
  //     }
  //   }
  // }
  //
  //
  // equals(range) {
  //   return Range.rangesEqual(this, range);
  // }
  //
  // isValid() {
  //   return isRangeValid(this);
  // }
  //
  //
  // detach() {
  //   // In DOM4, detach() is now a no-op.
  // }
}
