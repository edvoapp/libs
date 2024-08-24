export type ActiveTextAreaElement = HTMLTextAreaElement & {
  setFocused?: (focused: boolean) => void;
  setActive?: () => void;
};

// export interface Focusability {
//   setActive?: () => void
//   setInactive?: () => void
//   handleDelete?: () => void | Promise<void>
//   handleEnter?: (evt?: Event) => void | Promise<void>
//   handleTab?: (evt?: Event) => void | Promise<void>
//   handleShiftTab?: (evt?: Event) => void | Promise<void>
// }

export type EntityElement = HTMLDivElement; // & Focusability

export function collectionHas<T extends HTMLElement>(a: NodeListOf<T>, b: T) {
  //helper function (see below)
  for (let i = 0, len = a.length; i < len; i++) {
    if (a[i] == b) return true;
  }
  return false;
}

export function parents<T extends HTMLElement>(elm: T) {
  const nodes = [elm];
  let parent = elm.parentElement as T;
  while (parent) {
    nodes.unshift(parent);
    parent = parent.parentElement as T;
  }
  return nodes;
}

export function compareNodes(node1: Node, node2: Node) {
  return node1.compareDocumentPosition(node2) & Node.DOCUMENT_POSITION_FOLLOWING ? node1 : node2;
}

export function getCommonParent(elm1: HTMLElement, elm2: HTMLElement) {
  if (elm1 === elm2 || elm1.parentElement === elm2.parentElement) return elm1.parentElement;
  const parents1 = parents(elm1);
  const parents2 = parents(elm2);

  if (parents1[0] !== parents2[0]) {
    console.warn('No common ancestor!');
    return null;
  }
  let i = 0;
  while (parents1[i] === parents2[i]) {
    if (!parents1[i] || !parents2[i]) throw 'Out of bounds';
    i++;
  }
  return parents1[i - 1];
}

export function getCommonSiblings<T extends HTMLElement>(elm1: T, elm2: T): T[] {
  // if same element, then return just the one
  if (elm1 === elm2) return [elm1];
  // if they already have the same parent element, then they are already siblings.
  const firstNode = compareNodes(elm1, elm2) as T;
  const lastNode = firstNode === elm1 ? elm2 : elm1;

  if (elm1.parentElement === elm2.parentElement) {
    const res = [firstNode];
    let curr: T | null = firstNode;
    while (curr !== lastNode) {
      curr = curr?.nextElementSibling as T;
      res.push(curr);
    }
    return res;
  }
  if (elm1.contains(elm2)) {
    return [elm1];
  }
  if (elm2.contains(elm1)) {
    return [elm2];
  }
  // first, get the common parent
  const commonParent = getCommonParent(elm1, elm2);
  if (!commonParent) return [];
  const res: T[] = [];
  // next, iterate through the child nodes of the common parent
  let currChild = commonParent.firstElementChild as T;
  let found = false;
  while (true) {
    if (currChild === firstNode || currChild.contains(firstNode)) {
      found = true;
    }
    if (found) {
      res.push(currChild);
    }
    if (currChild === lastNode || currChild.contains(lastNode)) {
      break;
    }
    currChild = currChild.nextElementSibling as T;
  }

  return res;
}

export function findParentBySelector<T extends HTMLElement>(
  elm: T,
  selector: string,
  root: DocumentFragment | Document | HTMLElement,
): T {
  const all = root.querySelectorAll<T>(selector);
  let cur = elm.parentElement;
  while (cur && !collectionHas(all, cur)) cur = cur.parentElement;
  return cur as T;
}

export function findGrandParentBySelector<T extends HTMLElement>(
  elm: T,
  selector: string,
  root: DocumentFragment | Document | HTMLElement,
): T {
  const parent = findParentBySelector(elm, selector, root);
  return findParentBySelector(parent, selector, root);
}

export function findPreviousSiblingBySelector<T extends HTMLElement>(
  elm: T,
  selector: string,
  root: DocumentFragment | Document | HTMLElement,
): T {
  const all = root.querySelectorAll<T>(selector);
  let cur = elm.previousElementSibling as T | null;
  while (cur && !collectionHas(all, cur)) cur = cur.previousElementSibling as T | null;
  return cur as T;
}

export function findNextSiblingBySelector<T extends HTMLElement>(
  elm: T,
  selector: string,
  root: DocumentFragment | Document | HTMLElement,
): T | null {
  const all = root.querySelectorAll<T>(selector);
  let cur = elm.nextElementSibling;
  while (cur && !collectionHas(all, cur as T)) cur = cur.nextElementSibling;
  return cur as T;
}

export function findFirstChildBySelector<T extends HTMLElement>(elm: T, selector: string): T | null {
  return elm.querySelector<T>(selector);
}

export function findLastChildBySelector<T extends HTMLElement>(elm: T, selector: string): T | null {
  const all = elm.querySelectorAll<T>(selector);
  if (!all.length) return null;
  return all[all.length - 1];
}

// returns the next sibling of the first HTMLElement parent that has a next sibling
export function findNextCousinNthRemoved<T extends HTMLElement>(
  elm: T,
  selector: string,
  root: DocumentFragment | Document | HTMLElement,
): T | null {
  let parent = findParentBySelector(elm, selector, root);
  if (!parent) return null;
  let nextParentSibling = findNextSiblingBySelector(parent, selector, root);
  while (parent && !nextParentSibling) {
    parent = findParentBySelector(parent, selector, root);
    if (!parent) return null;
    nextParentSibling = findNextSiblingBySelector(parent, selector, root);
  }
  return nextParentSibling;
}

// returns the last deepest nested child of the previous sibling
export function findPrevCousinNthRemoved<T extends HTMLElement>(
  elm: T,
  selector: string,
  root: DocumentFragment | Document | HTMLElement,
): T | null {
  const previousSibling = findPreviousSiblingBySelector(elm, selector, root);
  if (!previousSibling) return null;
  let cur = findLastChildBySelector(previousSibling, selector);
  if (!cur) return previousSibling;
  let next = findLastChildBySelector(cur, selector);
  while (next) {
    cur = next;
    next = findLastChildBySelector(cur, selector);
  }
  return cur;
}

export function getScrollParent(node: HTMLElement | null): HTMLElement | null {
  const isElement = node instanceof HTMLElement;
  const overflowY = isElement && window.getComputedStyle(node as HTMLElement).overflowY;
  const isScrollable = overflowY !== 'visible' && overflowY !== 'hidden';

  if (!node) {
    return null;
  } else if (isScrollable && node instanceof HTMLElement && node.scrollHeight >= node.clientHeight) {
    return node;
  }
  return getScrollParent(node.parentElement);
}

// this will give the distance from the top of element to the top of container (for the purpose of detecting "in view")
export function getOffsetScrollTop(container: HTMLElement, element: HTMLElement | null, offsetTop = 0): number {
  // console.log('container!', container)
  // console.log('element!', element)
  if (element === null || element === container) return offsetTop;
  if (!container.contains(element)) {
    console.error('Element provided is not a descendant of the container', element, container);
    return 0;
  }
  return getOffsetScrollTop(container, element.offsetParent as HTMLElement, offsetTop + element.offsetTop);
}

export function checkInView(container: HTMLElement, element: HTMLElement, partial: boolean): boolean {
  //Get container properties
  const cTop = container.scrollTop;
  const cBottom = cTop + container.clientHeight;

  //Get element properties
  const eTop = element.offsetTop;
  const eBottom = eTop + element.clientHeight;

  //Check if in view
  const isTotal = eTop >= cTop && eBottom <= cBottom;

  // Check if partially visible
  const isPartial = (eTop < cTop && eBottom > cTop) || (eBottom > cBottom && eTop < cBottom);

  //Return outcome
  return isTotal || (partial && isPartial);
}

export function ensureInView(element: HTMLElement) {
  const container = getScrollParent(element);
  if (!container) {
    // console.log('No scroll parent for:', element)
    return;
  }

  //Determine container top and bottom
  const cTop = container.scrollTop;
  const cBottom = cTop + container.clientHeight;

  //Determine element top and bottom
  const eTop = getOffsetScrollTop(container, element);
  const eBottom = eTop + element.clientHeight;

  //Check if out of view
  if (eTop < cTop) {
    container.scrollTop -= cTop - eTop;
  } else if (eBottom > cBottom) {
    container.scrollTop += eBottom - cBottom;
  }
}

// export function navigateDom(
//   el: HTMLElement | null,
//   ref: { current: EntityElement | null },
//   evt?: JSX.TargetedKeyboardEvent<HTMLTextAreaElement | HTMLDivElement>,
// ) {
//   if (el && ref.current) {
//     // set the previous one to inactive
//     ref.current.setInactive?.()
//     ref.current = el as EntityElement
//     // set the next one to active
//     ref.current.setActive?.()
//     if (evt) {
//       evt.preventDefault
//     }
//   }
// }

export function getCss(el: HTMLElement, ruleName: keyof CSSStyleDeclaration) {
  return getComputedStyle(el)[ruleName];
}

export function getCursorPos(input: HTMLTextAreaElement) {
  if ('selectionStart' in input && document.activeElement == input) {
    return {
      start: input.selectionStart,
      end: input.selectionEnd,
    };
  }
  return -1;
}

export function setCursorPos(input: HTMLTextAreaElement, start: number, end: number = start) {
  if ('selectionStart' in input) {
    setTimeout(function () {
      input.selectionStart = start;
      input.selectionEnd = end;
    }, 1);
  }
}
