import { RangeProxy } from './range';
import { RangeIterator } from './range-iterator';
import { NodeIterator } from './node-iterator';

export function getCommonAncestor(node1: Node, node2: Node) {
  const ancestors = [];
  for (let node: Node | null = node1; node; node = node.parentNode) {
    ancestors.push(node);
  }

  for (let node: Node | null = node2; node; node = node.parentNode) {
    if (ancestors.includes(node)) return node;
  }

  return null;
}

export function isDescendant(el: HTMLElement, parent: HTMLElement) {
  if (el === parent) return true;
  let currEl: Node | null = el.parentNode;
  while (currEl) {
    if (currEl === parent) return true;
    currEl = currEl.parentNode;
  }
  return false;
}

export function getDocument(node: Node): Document {
  if (node.nodeType == 9) {
    return node as Document;
  } else if (node.ownerDocument) {
    return node.ownerDocument;
    // } else if (node.document) {
    //   return node.document;
  } else if (node.parentNode) {
    return getDocument(node.parentNode);
  } else {
    throw new Error('getDocument: no document found for node');
  }
}

export function getNodeLength(node: Node) {
  switch (node.nodeType) {
    case 7:
    case 10:
      return 0;
    case 3:
    case 8:
      return (node as Text).length;
    default:
      return node.childNodes.length;
  }
}

export function isCharacterDataNode(node: Node): boolean {
  // Text, CDataSection or Comment
  return [3, 4, 8].includes(node.nodeType);
}

export function removeNode(node: Node) {
  return node.parentNode?.removeChild(node);
}

export function isNonTextPartiallySelected(node: Node, range: RangeProxy) {
  return (
    node.nodeType != 3 && (isOrIsAncestorOf(node, range.startContainer) || isOrIsAncestorOf(node, range.endContainer))
  );
}

export function getRangeDocument(range: RangeProxy) {
  return getDocument(range.startContainer);
}

export function isAncestorOf(ancestor: Node, descendant: Node, selfIsAncestor: boolean) {
  let n = selfIsAncestor ? descendant : descendant.parentNode;
  while (n) {
    if (n === ancestor) {
      return true;
    } else {
      n = n.parentNode;
    }
  }
  return false;
}

export function isOrIsAncestorOf(ancestor: Node, descendant: Node) {
  return isAncestorOf(ancestor, descendant, true);
}

export function getClosestAncestorIn(node: Node, ancestor: Node, selfIsAncestor: boolean): Node | null {
  let parent;
  let next = selfIsAncestor ? node : node.parentNode;
  while (next) {
    parent = next.parentNode;
    if (parent === ancestor) {
      return next;
    }
    next = parent;
  }
  return null;
}

export function getRootContainer(node: Node) {
  let parent;
  while ((parent = node.parentNode)) {
    node = parent;
  }
  return node;
}

export function isValidOffset(node: Node, offset: number) {
  return offset <= (isCharacterDataNode(node) ? (node as Text).length : node.childNodes.length);
}

export function iterateSubtree(
  rangeIterator: RangeIterator,
  func: (n: Node) => boolean | void,
  iteratorState = { stop: false },
) {
  let it, n;
  for (let node, subRangeIterator; node; node = rangeIterator.next()) {
    if (rangeIterator.isPartiallySelectedSubtree()) {
      if (func(node) === false) {
        iteratorState.stop = true;
        return;
      } else {
        // The node is partially selected by the Range, so we can use a new RangeIterator on the portion of
        // the node selected by the Range.
        subRangeIterator = rangeIterator.getSubtreeIterator();
        if (!subRangeIterator) return;
        iterateSubtree(subRangeIterator, func, iteratorState);
        subRangeIterator.detach();
        if (iteratorState.stop) {
          return;
        }
      }
    } else {
      // The whole node is selected, so we can use efficient DOM iteration to iterate over the node and its
      // descendants
      it = createIterator(node);
      while ((n = it.next())) {
        if (func(n) === false) {
          iteratorState.stop = true;
          return;
        }
      }
    }
  }
}

export function createIterator(root: Node) {
  return new NodeIterator(root);
}

export function getNodeIndex(node: Node): number {
  let i = 0;
  let n: Node | null = node;
  while ((n = n.previousSibling)) {
    ++i;
  }
  return i;
}

export function inspectNode(node: Node): string {
  if (!node) {
    return '[No node]';
  }
  if (isCharacterDataNode(node)) {
    return '"' + (node as Text | CDATASection).data + '"';
  }
  if (node.nodeType == 1) {
    const { id, innerHTML } = node as Element;
    const idAttr = id ? ` id="${id}" ` : '';
    return (
      '<' +
      node.nodeName +
      idAttr +
      '>[index:' +
      getNodeIndex(node) +
      ',length:' +
      node.childNodes.length +
      '][' +
      (innerHTML || '[innerHTML not supported]').slice(0, 25) +
      ']'
    );
  }
  return node.nodeName;
}

export function inspect(range: RangeProxy) {
  const name = range.getName();
  return (
    '[' +
    name +
    '(' +
    inspectNode(range.startContainer) +
    ':' +
    range.startOffset +
    ', ' +
    inspectNode(range.endContainer) +
    ':' +
    range.endOffset +
    ')]'
  );
}

export function getNodesInRange(range: RangeProxy, nodeTypes?: number[], filter?: (node: Node) => boolean) {
  const nodes: Node[] = [];
  iterateSubtree(new RangeIterator(range, false), function (node) {
    if (nodeTypes && nodeTypes.includes(node.nodeType)) {
      return;
    }
    if (filter && !filter(node)) {
      return;
    }
    // Don't include a boundary container if it is a character data node and the range does not contain any
    // of its character data. See issue 190.
    const sc = range.startContainer;
    if (node == sc && isCharacterDataNode(sc) && range.startOffset == (sc as Text | CDATASection).length) {
      return;
    }

    const ec = range.endContainer;
    if (node == ec && isCharacterDataNode(ec) && range.endOffset == 0) {
      return;
    }
    nodes.push(node);
  });
  return nodes;
}

export function getAbsoluteClientRect(el: Element) {
  const { x, y, width, height } = el.getBoundingClientRect();
  const { left, top } = document.body.getBoundingClientRect();
  return new DOMRectReadOnly(x - left, y - top, width, height);
}
