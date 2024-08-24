import { Model } from '@edvoapp/common';
import { EdvoObj, OwnedProperty, WeakObservableList } from '@edvoapp/util';

import * as VM from '../viewmodel';

/*

** A brief note about selection vs focus **

Selection is just a construct of things that are grouped together
IE, by dragging a lasso around multiple entities, you can select them

Focus is what the user is currently operating on. It may or may not be a selection.
For example, if someone clicks on a bullet, it is not focused, but not selected. The
selection is empty because nothing is selected.

If the user clicks and drags on multiple bullets, now those bullets are selected, and that selection
is the current focus.

Presumably, we could have selections that are not focused (for example, if someone else selects a bunch of things,
we oughta be able to see what they have selected, even if we are not focused)

This is not in the current scope, but something to keep in mind. Thus, for the time being,
when the selection is _not_ empty, we presume that it is focused.



** What can be focused? **

In short, only ViewModel and Selection nodes can be focused. Selection is not a ViewModel node because it is sort of ephemeral

More specifically, I can use arrow keys to navigate bullets and change the focus there.
On focus, the bullet textarea should be focused.
I can click bullets and cards to manage my focus.

A node's focus state should be irrespective of its actual rendering state.
If I focus on a node that has been culled (for example, by doing a center on node in some way)
I should be able to do so.

As a result of a certain ViewModel node being focused, a DOM element MAY be focused. Again, the focused element
may not even be rendered. But if it is rendered, then the element should be "focused," which typically indicates some sort of styling

** What should happen when an node is un-focused? **

When a node is un-focused, it may have some clean-up to do. Going back to the above note of selections that 
are not focused, if we focus on someone's selection, and then un-focus it, nothing should happen.

But, if I un-focus my own selection, presumably it would clear the selection.

Again, this is probably not something we need to "focus" (har har) on right now, so for the time being we can
simply just "blur" anything that loses focus. The individual nodes ought to specify what happens when a node is
un-focused.

*/
export class SelectionState extends EdvoObj {
  @OwnedProperty
  selection = new WeakObservableList<VM.Node>();
  implicit: Record<
    string,
    {
      vertex: Model.Backref;
      selected: Record<string, Model.Backref>;
    }
  > = {};
  // selectStartElement: BoundElement | null = null;
  // selectEndElement: BoundElement | null = null;
  // currentVertex: Model.Vertex | null = null;

  clear() {
    // needs to be a shallow copy otherwise it will get mutated while deselecting
    this.deSelect([...this.selection.value]);
  }
  get size() {
    return this.selection.length;
  }

  addSelect(nodes: VM.Node[]) {
    for (const node of nodes) {
      this.selection.insert(node, undefined, {}, true);
      node.isSelected.set(true);

      // Remove destroyed items from the selection
      node.onCleanup(() => {
        // TBH it's a little weird that we are just binding this in perpetuity
        // as items get removed from the selection all the time. I think we're getting away with it in this case however
        if (this.selection.contains(node)) {
          this.selection.remove(node);
        }
      });
      // when a node is selected, we must deselect all its child nodes too
      this.deSelect(node.children);
    }
  }

  deSelect(nodes: VM.Node[]) {
    nodes.forEach((node) => {
      node.isSelected.set(false);
      this.selection.remove(node);
      // this is just a small cleanup step, it probably isn't necessary
      this.deSelect(node.children);
    });
  }

  setSelect(nodes: VM.Node[]): void {
    this.clear();
    this.addSelect(nodes);
  }

  toggleSelect(nodes: VM.Node[]) {
    nodes.forEach((node) => {
      if (this.selection.contains(node)) {
        this.deSelect([node]);
      } else {
        this.addSelect([node]);
      }
    });

    const size = this.selection.length;

    if (size === 0) {
      this.clear();
    } else {
      // this.setFocus({
      //   viewNode: this.selected,
      //   onBlur: () => this.selected.onBlur(),
      // });
    }
  }
}

export function computeSelection(originNode: VM.Node, destNode: VM.Node): VM.Node[] {
  // we need to compute the elements between the destination node and the origin node, such that the following are true:
  // - no parent is selected without its children also being selected
  // - if destNode is a descendant of a sibling of originNode, then the parent must be selected
  // - every item in the resulting array must be siblings
  //
  // some cases:
  //
  // * A
  //   * B
  // * C <- originNode
  // * D
  //   * E
  //
  // an arrow-up from C should select C, B, and A
  // an arrow-down from C should select C, D, and E (transitively)

  //
  //
  // * A
  // * B
  // * C <- originNode
  //   * D
  // * E
  //
  // an arrow-up from C should select C and B
  // an arrow-down from C should select C, E, and D (transitively)
  //
  //
  // * A
  // * B
  //   * C <- originNode
  //   * D
  // * E
  //
  // an arrow-up from C should select C, B, and D (transitively)
  // an arrow-down from C should select C and D
  //
  //
  // * A
  // * B
  //   * C <- originNode
  // * D
  // * E
  //
  // an arrow-up from C should select C, B
  // an arrow-down from C should select B and D

  if (originNode === destNode) return [destNode];

  // siblings
  if (originNode.parentNode === destNode.parentNode)
    return debug([originNode, ...originNode.siblingsBetween(destNode), destNode], 'siblings');

  // case where destNode is a descendant of a sibling
  // one of these actually shouldn't happen, but I always forget how node ordering works
  const prev = originNode.prevSibling();
  if (prev?.contains(destNode)) return debug([originNode, prev], 'prevSibling');

  const next = originNode.nextSibling();
  if (next?.contains(destNode)) return debug([originNode, next], 'nextSibling');

  if (destNode.contains(originNode)) return debug([destNode], 'destNode contains originNode');
  if (originNode.contains(destNode)) return debug([originNode], 'originNode contains destNode');
  const siblingAncestors = originNode.lowestCommonSiblingAncestors(destNode);
  const [a1, a2] = siblingAncestors;
  if (a1 && a2) return debug([a1, ...a1.siblingsBetween(a2), a2], 'sibling ancestors');

  console.warn('unhandled edge case', originNode, destNode);
  return [];
}

export function getLowestCommonSiblingAncestors(nodes: VM.Node[]): VM.Node[] {
  let lowestDepth = 99999;

  // first get the lowest depth
  nodes.forEach((node) => {
    lowestDepth = Math.min(lowestDepth, node.depth);
  });

  // then, get the parent node until all nodes are in the same depth
  const parentNodes = nodes.map((node) => {
    while (node.depth !== lowestDepth) {
      node = node.parentNode!;
    }
    return node;
  });

  return [...new Set(parentNodes)];
}

// maybe make this a utility function
function debug<T>(v: T, msg?: string): T {
  // console.log('debug', msg, v);
  return v;
}
