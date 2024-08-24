import { Analytics, TrxRef, trxWrap, trxWrapSync } from '@edvoapp/common';

import { Behavior, DispatchStatus, EventNav, computeSelection } from '../service';
import * as VM from '../viewmodel';
import { Position } from '../viewmodel';

import './drag-behaviors.scss';

import { activeConversationObs } from '../components';
import { EdvoObj, Guard, Observable, OwnedProperty, WeakProperty } from '@edvoapp/util';
import { DEPTH_MASK_Z } from '../constants';

export type PositionAndType = {
  position: Position;
  type: 'move' | 'transclude';
};

export interface Draggable extends VM.Node {
  setDragging(pos: PositionAndType | null): void;
  dragging: Observable<PositionAndType | null>;
  get draggable(): boolean;
  useDragProxy?: boolean;
}

export function isDraggable(thing: VM.Node): thing is Draggable {
  return 'setDragging' in thing && thing.draggable;
}

// const GRID_SIZE = 80;

export class DragItem extends EdvoObj {
  screenOffsets: Position;
  logicalOffsets: Position;
  @OwnedProperty
  node: Draggable;
  constructor(node: Draggable, screenOffsets: Position, logicalOffsets: Position) {
    super();
    this.node = node;
    this.screenOffsets = screenOffsets;
    this.logicalOffsets = logicalOffsets;
  }
}

export class DragInstance extends EdvoObj {
  @OwnedProperty
  items: DragItem[];
  isTransclusion: boolean;
  constructor(items: DragItem[], isTransclusion: boolean) {
    super();
    this.items = items;
    this.isTransclusion = isTransclusion;
  }
}

export class DragDrop extends Behavior {
  @OwnedProperty
  dragInstance: DragInstance | null = null;
  private startPos: Position | null = null;
  private hasMoved = false;
  private dragContainerEl: HTMLElement | null = null;
  constructor(readonly tracking_event?: string) {
    super();
  }

  handleMouseDown(eventNav: EventNav, e: MouseEvent, node: VM.Node): DispatchStatus {
    const isRightClick = eventNav.isRightClick(e);
    const spacePressed = eventNav.downKeys.has('space');
    if (spacePressed || isRightClick) return 'decline';

    // for the purpose of redispatching window events outside of the frame
    this.activeNode = node;

    // Eligibility for drag
    const isLeftClick = e.which === 1 || e.button === 0;
    const isUnmodified = !(e.shiftKey || e.ctrlKey);

    if (!(isLeftClick && isUnmodified)) return 'decline';
    const target = e.target as HTMLElement | null;

    // HACK: don't allow member dragging when over a textarea or input
    const maybeText = target?.matches('textarea, input');
    if (maybeText) return 'decline';

    const dragNodes = eligibleItems(node, e);

    if (!dragNodes.length) {
      this.trace(3, () => ['NO Eligible nodes', dragNodes]);
      return 'decline';
    }

    const items = dragNodes.map((node) => {
      // screen offsets are used for drag and drop because transclusions are in a drag proxy that is absolutely positioned
      const screenOffsets = computeScreenOffsets(e, node);
      // logical offsets are used for placement
      const logicalOffsets = computeLogicalOffsets(e, node);

      return new DragItem(node, screenOffsets, logicalOffsets);
    });

    // OK we're dragging. reset the flags and get started
    this.hasMoved = false;
    eventNav.setGlobalBehaviorOverrides(this, ['handleMouseUp', 'handleMouseMove', 'handleMouseEnter']);

    // initiate dragging
    this.startPos = { x: e.clientX, y: e.clientY };

    this.dragInstance = new DragInstance(items, e.altKey);

    return 'stop'; // make sure that no subsequent event handlers are called for handleMouseDown
  }

  handleMouseEnter(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    // this doesn't actually do anything, it's just to prevent other behaviors from capturing enter events on drag
    return 'stop';
  }

  // weakly referenced
  indicated: Draggable[] = [];

  handleMouseMove(eventNav: EventNav, event: MouseEvent, node: VM.Node): DispatchStatus {
    if (!this.dragInstance) {
      // Not currently dragging
      // But COULD we start a drag here?
      const items = eligibleItems(node, event);

      // De-indicate all things that were indicated for dragging, and no longer are
      const indicatedList = this.indicated;
      this.indicated = [];
      for (const indicated of indicatedList) {
        let index = items.indexOf(indicated);
        if (index == -1) {
          indicated.upgrade()?.deindicate('drag');
        } else {
          // Let's remove the indicated item from elegible items
          // and add to indicated list

          // The order doesn't matter, then we can swap with the last item and pop
          // instead of using items.splice(index, 1)
          if (index != items.length - 1) items[index] = items[items.length - 1];
          items.pop();

          this.indicated.push(indicated);
        }
      }

      // Now indicate all the things that should be indicate for dragging
      for (let item of items) {
        if (this.indicated.includes(item)) continue;
        item.indicate('drag');
        this.indicated.push(item);
      }

      return 'decline';
    }

    const sp = this.startPos;
    const targets = this.dragInstance.items;
    if (sp && targets.length) {
      const { clientX, clientY } = event;
      const moveDistanceX = clientX - sp.x;
      const moveDistanceY = clientY - sp.y;

      if (Math.abs(moveDistanceX) > 1 || Math.abs(moveDistanceY) > 1) {
        if (!this.hasMoved) {
          document.body.classList.add('global-drag');
        }

        let firstDrag = false;

        if (!this.dragContainerEl) {
          const dragContainerEl = document.createElement('div');
          dragContainerEl.classList.add('drag-container');
          this.dragContainerEl = dragContainerEl;
          document.body.appendChild(dragContainerEl);
          firstDrag = true;
        }

        targets.forEach(({ node, screenOffsets }) => {
          if (node.useDragProxy || this.dragInstance?.isTransclusion) {
            if (!firstDrag) return;
            const cloned = node.domElement?.cloneNode(true) as HTMLElement;
            // add the class AFTER cloning
            this.dragContainerEl!.appendChild(cloned);
            cloned.classList.add('cloned-target');
            cloned.style.left = `${screenOffsets.x}px`;
            cloned.style.top = `${screenOffsets.y}px`;
            const boundingBox = node.domElement?.getBoundingClientRect();
            if (boundingBox) {
              cloned.style.width = `${node.domElement?.offsetWidth || 0}px`;
              cloned.style.height = `${node.domElement?.offsetHeight || 0}px`;
            }

            const space = node.findClosest((n) => n instanceof VM.TopicSpace && n);
            const x = screenOffsets.x + clientX;
            const y = screenOffsets.y + clientY;

            // Technically, since we are using a drag proxy, arguably the node's drag-position is not useful.

            node.setDragging({
              position: {
                x,
                y,
              },
              type: this.dragInstance?.isTransclusion ? 'transclude' : 'move',
            });

            const scale = space?.planeScale ?? 1;
            const t = `scale(${scale})`;
            cloned.style.position = 'absolute'; // override any fixed positioning
            cloned.style.transform = t;
          } else {
            if (firstDrag) {
              // const val = 100_000; //node.zIndex.value + 100_000;
              const val = DEPTH_MASK_Z;
              node.zIndexOverride.set(val);
              node.zEnumerateRecurse(0);
            }
            const x = screenOffsets.x + clientX;
            const y = screenOffsets.y + clientY;
            node.setDragging({
              position: {
                x,
                y,
              },
              type: 'move',
            });
            node.transparent = true;
          }
        });

        // node.zEnumerateAll();

        const dropTarget = this.getDropTarget(eventNav, targets, event);
        const [left, top] = [`${clientX}px`, `${clientY}px`];
        this.dragContainerEl.style.left = left;
        this.dragContainerEl.style.top = top;
        const currentDropTarget = document.body.querySelector('.can-drop');
        if (currentDropTarget) {
          if (currentDropTarget !== dropTarget?.domElement) {
            currentDropTarget?.classList.remove('can-drop');
            dropTarget?.domElement?.classList.add('can-drop');
          }
        } else {
          dropTarget?.domElement?.classList.add('can-drop');
        }
        this.hasMoved = true;
        activeConversationObs.set(null);
      }
    }

    return 'stop';
  }

  getDropTarget(eventNav: EventNav, targets: DragItem[], e: MouseEvent): VM.Node | null {
    const dragNodes = targets.map((x) => x.node);

    return eventNav.rootNode.getNodeAtScreenPoint(
      {
        x: e.clientX,
        y: e.clientY,
      },
      false,
      (node) => {
        // If dropping on self, self is the target
        if (dragNodes.find((n) => n === node)) return true;
        // Disallow dropping on any children of the dragNodes to prevent self-references
        if (dragNodes.find((n) => n.contains(node))) {
          return false;
        }
        return node.droppable(dragNodes);
      },
    );
  }

  handleMouseUp(
    eventNav: EventNav,
    e: MouseEvent,
    originNode: VM.Node,
    // purposely ignoring originNode because we want to recalculate
  ): DispatchStatus {
    this.activeNode = null;
    if (!this.dragInstance) return 'decline';

    // Disable our temporary priority override
    eventNav.unsetGlobalBehaviorOverrides(this);

    document.body.querySelectorAll('.can-drop').forEach((e) => e.classList.remove('can-drop'));
    const targets = this.dragInstance.items || [];
    const dropTarget = this.getDropTarget(eventNav, targets, e);
    const hasMoved = this.hasMoved;
    this.trace(4, () => ['DRAG', targets, dropTarget, hasMoved]);
    if (hasMoved && dropTarget) {
      void this.dropEnd(e, dropTarget);
    }

    document.body.classList.remove('global-drag');
    const clonedTarget = this.dragContainerEl;
    this.dragContainerEl = null;
    if (clonedTarget) {
      document.body.removeChild(clonedTarget);
    }
    // if we haven't moved, then there's nothing left to do
    if (!this.hasMoved || !this.startPos) {
      this.dragInstance = null;
      return 'continue';
    }

    const topicspace = targets[0].node.closestInstance(VM.Member)?.myTopicSpace;
    const targetsMovedToDifferentTopicSpace = topicspace !== dropTarget;

    // Reset to non-dragging state
    targets.forEach(({ node }) => {
      node.zIndexOverride.set(null);
      node.setDragging(null);
      node.transparent = false;

      if (targetsMovedToDifferentTopicSpace) {
        node.isSelected.set(false);
        // TODO: now how do we set the selection state of a created node in portal to true?
      }
    });

    this.hasMoved = false;
    this.dragInstance = null;
    this.startPos = null;

    eventNav.rootNode.zEnumerateAll();
    this.trace(2, () => ['DragDrop onMouseUp']);

    // Do tracking after everything else in case it's slow or crashes
    if (hasMoved && this.tracking_event) {
      Analytics.event('Something', {
        action: this.tracking_event,
      });
    }
    document.body.classList.remove('global-drag');
    return 'stop';
  }
  async dropEnd(event: MouseEvent, dropNode: VM.Node) {
    if (!this.dragInstance) return;
    return Guard.while(this.dragInstance, async (dragInstance) => {
      const { items: selection, isTransclusion } = dragInstance;
      this.trace(4, () => [
        'DROP END 1',
        dropNode,
        selection,
        ' DROPPABLE: ',
        dropNode.droppable(selection.map((x) => x.node)),
      ]);
      if (!dropNode.droppable(selection.map((x) => x.node))) {
        // console.log('MARK not droppable');
        return;
      }
      await trxWrap(async (trx) => {
        // TODO implement prospectiveDropNode.isDropEligible
        const droppedItems = await dropNode.handleDrop(selection, event, trx, isTransclusion);
        this.trace(4, () => ['DROP END 2 DROPPED ITEMS', droppedItems]);

        droppedItems.forEach((item) => {
          if (!isTransclusion) {
            item.handleDepart(trx);
          }
        });

        // everything stops dragging
        dragInstance.items.forEach((item) => {
          item.node.setDragging(null);
          item.node.transparent = false;
        });
      });
    });
  }

  // getEligibleDropTargets(dragItems: DragItem[]): BoundElement[] {
  //   const allBoundEls = document.body.querySelectorAll<BoundElement>(
  //     BOUND_ENTITY_SELECTOR,
  //   );
  //   if (!allBoundEls) return [];
  //   // returns an array of arrays of eligible drop roles
  //   const allRoles = dragItems.map(({ element: dragItem }) => {
  //     const dragRole = dragItem.nodeBinding.role;
  //     return this.getEligibleDropRoles(dragRole);
  //   });
  //   // this ensures that we only look at roles that are the same between the different types
  //   const eligibleDropRoles = intersection(...allRoles);
  //   const eligibleEls: BoundElement[] = [];
  //   allBoundEls?.forEach((boundEl) => {
  //     if (eligibleDropRoles.includes(boundEl.nodeBinding?.role)) {
  //       eligibleEls.push(boundEl);
  //     }
  //   });
  //   return eligibleEls;
  // }
}

const snapToGrid = (grid: number, val: number) => {
  const snap = Math.round(val / grid) * grid;
  if (Math.abs(val - snap) <= 3) return snap;
  return val;
};

function eligibleItems(node: VM.Node, e: MouseEvent): Draggable[] {
  const closestDragHandle = node.closest((x) => x.dragHandle);
  if (!closestDragHandle) return [];

  const selection = node.context.selectionState.selection.value;

  let nodes: VM.Node[] = [];

  // Am I attempting to drag something that is part of the selection
  if (
    selection.length > 0 &&
    selection.find(
      (n) =>
        // we only want to drag the selection if I am dragging a drag handle that belongs to an item in the selection
        // eg. if I am trying to drag an outline item from within a selected card; and outline item's drag handle does NOT belong to
        // the member despite it existing within
        closestDragHandle.findClosest((x) => isDraggable(x) && x.draggable && x) === n,
    )
  ) {
    nodes = selection;
  } else {
    // Otherwise, nevermind what's selected (or focused) - drag this thing!
    nodes = [closestDragHandle];
  }

  const dragNodes = [];

  for (let dragHandle of nodes) {
    const node = dragHandle.findClosest((x) => isDraggable(x) && x.draggable && x);
    if (node) dragNodes.push(node);
  }

  return dragNodes;
}

// offsets are how far away from the edges the click event occurred.
// Storing this lets us keep the mouse at the same place it clicked on,
// relative to the items that are dragging
function computeScreenOffsets(e: { clientX: number; clientY: number }, node: VM.Node): Position {
  const { left, top } = node.clientRectObs.value;

  return {
    x: left - e.clientX,
    y: top - e.clientY,
  };
}

function computeLogicalOffsets(e: { clientX: number; clientY: number }, node: VM.Node): Position {
  const closestMember = node.closestInstance(VM.Member) ?? node.closestInstance(VM.ContentCard);

  const { left, top } = node.clientRectObs.value;

  const memberSpace = closestMember?.myTopicSpace;

  if (!memberSpace)
    return {
      x: left - e.clientX,
      y: top - e.clientY,
    };

  const memberLogicalCoords = closestMember.planeCoords.value;
  const offsetLogicalCoords = memberSpace.clientCoordsToSpaceCoords({
    x: e.clientX,
    y: e.clientY,
  });

  return {
    x: memberLogicalCoords.left - offsetLogicalCoords.x,
    y: memberLogicalCoords.top - offsetLogicalCoords.y,
  };
}
