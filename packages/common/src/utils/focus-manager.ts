// export function collectionHas(a: NodeListOf<Element>, b: Element) {
//   //helper function (see below)
//   for (let i = 0, len = a.length; i < len; i++) {
//     if (a[i] == b) return true;
//   }
//   return false;
// }

// export function findParentBySelector(elm: Element, selector: string) {
//   const all = document.querySelectorAll(selector);
//   let cur = elm.parentElement;
//   while (cur && !collectionHas(all, cur)) cur = cur.parentElement;
//   return cur;
// }

// export function findPreviousSiblingBySelector(elm: Element, selector: string) {
//   const all = document.querySelectorAll(selector);
//   let cur = elm.previousElementSibling;
//   while (cur && !collectionHas(all, cur)) cur = cur.previousElementSibling;
//   return cur;
// }

// export function findNextSiblingBySelector(elm: Element, selector: string) {
//   const all = document.querySelectorAll(selector);
//   let cur = elm.nextElementSibling;
//   while (cur && !collectionHas(all, cur)) cur = cur.nextElementSibling;
//   return cur;
// }

// export function findFirstChildBySelector(elm: Element, selector: string) {
//   return elm.querySelector(selector);
// }

// export function findLastChildBySelector(elm: Element, selector: string) {
//   const all = elm.querySelectorAll(selector);
//   if (!all.length) return null;
//   return all[all.length - 1];
// }

// // returns the next sibling of the element's parent
// export function findNextCousinOnceRemoved(elm: Element, selector: string) {
//   const parent = findParentBySelector(elm, selector);
//   if (!parent) return null;
//   return findNextSiblingBySelector(parent, selector);
// }

// // returns the last deepest nested child of the previous sibling
// export function findPrevCousinNthRemoved(elm: Element, selector: string) {
//   const previousSibling = findPreviousSiblingBySelector(elm, selector);
//   if (!previousSibling) return null;
//   let cur = findLastChildBySelector(previousSibling, selector);
//   if (!cur) return previousSibling;
//   let next = findLastChildBySelector(cur, selector);
//   while (next) {
//     cur = next;
//     next = findLastChildBySelector(cur, selector);
//   }
//   return cur;
// }

// export function navigateDom(
//   el: Element | null,
//   ref: RefObject<ActiveEntityElement>,
//   evt?: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>,
// ) {
//   if (el && ref.current) {
//     // set the previous one to inactive
//     ref.current.setInactive?.();
//     ref.current = el as ActiveEntityElement;
//     // set the next one to active
//     ref.current.setActive?.();
//     if (evt) {
//       evt.preventDefault;
//     }
//   }
// }

export class FocusManager {
  state = {};
}
