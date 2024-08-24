export function relativeToAbsoluteClientRect(box: DOMRect): DOMRectReadOnly {
  if (typeof window === 'undefined') return new DOMRectReadOnly();
  const top = box.top + window.pageYOffset;
  const left = box.left + window.pageXOffset;
  return new DOMRectReadOnly(left, top, box.width, box.height);
}

export function getMetaKey() {
  return navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl';
}

export function relativeToRect(rect: DOMRect, compare: DOMRect): DOMRectReadOnly {
  const top = rect.top - compare.top;
  const left = rect.left - compare.left;
  return new DOMRectReadOnly(left, top, rect.width, rect.height);
}

/**
 * Consolidate horizontally adjacent or overlapping DOMRects.
 */
export function consolidateRects(rects: Array<DOMRect>): Array<DOMRect> {
  const input = sortByTopLeft(rects);
  const output = new Array<DOMRect>();

  for (let i = 0; i < input.length; i++) {
    let item = input[i];
    let newItem = item;
    while (i < input.length - 1) {
      const nextItem = input[i + 1];

      // If the next rectangle is wholly contained within the current one,
      // skip over it.
      if (contains(newItem, nextItem)) {
        i += 1;
        continue;
      }

      // If the next rectangle is on the same line as this one and they
      // either overlap or are separated by only a few pixels, consolidate
      // them.
      if (horizontal(newItem, nextItem) && sideBySide(newItem, nextItem)) {
        newItem = envelop(newItem, nextItem);
        i += 1;
      } else {
        break;
      }
    }
    output.push(newItem);
  }

  return output;
}

/**
 * Return a copy of an array of DOMRects, sorted by their top-left corners.
 */
function sortByTopLeft(rects: Array<DOMRect>) {
  const output = rects.slice() as Array<DOMRect>;
  output.sort((a: DOMRect, b: DOMRect) => {
    let comparison = a.top - b.top;
    if (comparison === 0) {
      comparison = a.left - b.left;
    }
    return comparison;
  });
  return output;
}

/**
 * Return true if `outer` fully contains `inner`.
 */
function contains(outer: DOMRect, inner: DOMRect) {
  return (
    outer.top <= inner.top &&
    outer.left <= inner.left &&
    outer.top + outer.height >= inner.top + inner.height &&
    outer.left + outer.width >= inner.left + inner.width
  );
}

/**
 * Return true if the rectangles are left-right adjacent.
 *
 * @param west Rectangle on the left
 * @param east Rectangle on the right
 * @param slop allowable margin in between the two rectangles
 */
function sideBySide(west: DOMRect, east: DOMRect, slop = 8) {
  const westRightEdge = west.left + west.width;
  const eastRightEdge = east.left + east.width;
  return west.left <= east.left && westRightEdge <= eastRightEdge && east.left - westRightEdge <= slop;
}

/**
 * Indicate whether two rectangles are roughly horizontally aligned.
 */
function horizontal(a: DOMRect, b: DOMRect, slop = 4) {
  const topDiff = Math.abs(b.top - a.top);
  const bottomDiff = Math.abs(b.bottom - a.bottom);
  return topDiff <= slop && bottomDiff <= slop;
}

/**
 * Return a bounding rectangle which envelops both `a` and `b`.
 */
function envelop(a: DOMRect, b: DOMRect) {
  let left = Math.min(a.left, b.left);
  let right = Math.max(a.right, b.right);
  let top = Math.min(a.top, b.top);
  let bottom = Math.max(a.bottom, b.bottom);
  return new DOMRect(left, top, right - left, bottom - top);
}

export const scanPrevText = (node: Element, offset: number, characters = 100): string => {
  let outString = '';
  let remainingChars = characters;
  const walker = createTreeWalker(node);
  // if offset - chars < 0, it will stop at 0
  const nodeText = walker.currentNode.textContent || '';
  outString = nodeText.substring(offset - characters, offset) + outString;
  while (outString.length < characters) {
    remainingChars = characters - outString.length;
    const prevNode = walker.previousNode();
    const nodeText = prevNode?.textContent || '';
    outString = nodeText.substr(nodeText.length - remainingChars, remainingChars);
  }

  // steps:
  // * get the text for node
  // * unshift the node text characters prior to offset onto outString
  // walk text nodes in the dom tree in reverse *starting from node*
  // unshift text onto outString until the desired number of characters is hit
  return outString;
};

// For testing
// ; (window as any).scanPrevText = scanPrevText

export function scanFollowingText(node: Element, offset: number, characters = 100): string {
  // similar to the above, except forward
  return '';
}

// Find the page-level container by traversing the graph upwards.
export function findParentNode(container: Element, node: Node, predicate: Function): HTMLElement | null {
  let ancestor: Node | null = node;
  if (!container || !ancestor || !predicate) return null;

  while (ancestor) {
    if (!container.contains(ancestor)) {
      ancestor = null;
      break;
    }
    if (ancestor.nodeType === Node.ELEMENT_NODE) {
      let elem = ancestor as HTMLElement;
      if (predicate(elem)) {
        break;
      }
    }
    ancestor = ancestor.parentNode;
  }
  return ancestor as HTMLElement;
}

export function createTreeWalker(node: Node) {
  return document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
    acceptNode: (node: Node) => (node.nodeValue?.trim() !== '' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
}

// Not clear if treewalker can be focused on a single starting element or not
// const treeWalker = document.createTreeWalker(
//     document.body,
//     NodeFilter.SHOW_TEXT,
//     function (node) {
// //      noooo a ternary lol
//         return (node.nodeValue?.trim() !== "")
//             ? NodeFilter.FILTER_ACCEPT
//             : NodeFilter.FILTER_REJECT;
//     }
// );

// treeWalker.currentNode
