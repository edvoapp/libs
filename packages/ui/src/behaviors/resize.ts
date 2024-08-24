import * as VM from '../viewmodel';
import { BoundingBox, OverrideBoundingBox } from '../viewmodel';
import { Behavior, DispatchStatus, EventNav } from '../service';
import { clamp, Observable, OwnedProperty } from '@edvoapp/util';
import { TrxRef, trxWrap } from '@edvoapp/common';
import { RESIZE_THRESHOLD } from '../constants';

export type ResizeCorner = 'n' | 'nw' | 'w' | 'sw' | 's' | 'se' | 'e' | 'ne';
export const ALL_CORNERS: ResizeCorner[] = ['n', 'nw', 'w', 'sw', 's', 'se', 'e', 'ne'];
export type ResizeStepArgs = {
  box: OverrideBoundingBox;
  corner: ResizeCorner;
};
export type ResizeDoneArgs = {
  box: OverrideBoundingBox;
  corner: ResizeCorner;
  trx: TrxRef;
};

export interface Resizable extends VM.Node {
  get resizable(): boolean;
  resizeCorners?: ResizeCorner[];
  resizeStep(args: ResizeStepArgs): void;
  resizeDone(args: ResizeDoneArgs): Promise<void>;
  resizeCancel(): void;
  _resizing: Observable<OverrideBoundingBox | null>;
}

export function isResizable(node: VM.Node): node is Resizable {
  return (
    'resizable' in node &&
    (node as Resizable).resizable &&
    'resizeStep' in node &&
    'resizeDone' in node &&
    'resizeCancel' in node
  );
}

export class Resize extends Behavior {
  @OwnedProperty
  activeNode: Resizable | null = null;
  // @OwnedProperty
  // memberSelectionBox: VM.MemberSelectionBox | null = null;
  resizeCorner: ResizeCorner | null = null;
  startPos: VM.Position | null = null;
  startingRect: BoundingBox | null = null;

  handleMouseDown(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    const found = this.findEligibleNodeCorner(originNode, e);
    if (!found) return 'decline';
    const [node, resizeCorner] = found;

    this.activeNode = node;
    this.resizeCorner = resizeCorner;
    this.startPos = { x: e.clientX, y: e.clientY };
    this.startingRect = node.clientRectObs.value;

    eventNav.setGlobalBehaviorOverrides(this, ['handleMouseMove', 'handleMouseUp']);
    return 'stop';
  }

  handleMouseMove(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    // Actively dragging
    if (this.activeNode) {
      if (!(this.startPos && this.resizeCorner && this.startingRect)) {
        throw new Error('Invalid state');
      }
      // Make sure the node is still resizable
      if (!this.activeNode.resizable) {
        eventNav.unsetGlobalBehaviorOverrides(this);
        this.activeNode.resizeCancel();
        this.activeNode = null;
        this.resizeCorner = null;
        this.startPos = null;
        this.startingRect = null;
        return 'continue';
      }

      // necessary to make iframes ignore our events
      document.body.classList.add('global-resize');
      const box = this.getCurrentBox(this.startingRect, this.activeNode, this.resizeCorner, e);
      const corner = this.resizeCorner;
      if (!(box && corner)) return 'decline';

      this.activeNode.resizeStep({
        box,
        corner,
      });
      setCursor(corner);
    } else {
      // Not dragging. Are we hovering?
      const found = this.findEligibleNodeCorner(originNode, e);
      if (!found) return 'decline';

      const [, resizeCorner] = found;
      setCursor(resizeCorner);

      return 'continue';
    }

    return 'stop';
  }
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    eventNav.unsetGlobalBehaviorOverrides(this);

    const node = this.activeNode;
    const startPos = this.startPos;
    const corner = this.resizeCorner;
    const startingRect = this.startingRect;

    this.activeNode = null;
    this.startPos = null;
    this.resizeCorner = null;
    this.startingRect = null;

    if (!(node && node.alive && corner && startPos && startingRect)) {
      return 'decline';
    }

    const resizable = node.resizable;
    if (!resizable) {
      node.resizeCancel();
      return 'decline';
    }

    const box = this.getCurrentBox(startingRect, node, corner, e);

    void trxWrap(async (trx) => {
      await node.resizeDone({ box: box, corner, trx });
    });
    document.body.classList.remove('global-resize');
    this.activeNode = null;
    this.resizeCorner = null;
    return 'stop';
  }

  findEligibleNodeCorner(originNode: VM.Node, e: MouseEvent): [Resizable, ResizeCorner] | undefined {
    return originNode.findClosest((n) => {
      if (!(isResizable(n) && n.resizable)) return false;
      const corner = getResizeCorner(n.clientRectObs.value, e);
      if (!corner) return false;
      const corners = n.resizeCorners ?? ALL_CORNERS;
      return corners.includes(corner) && [n, corner];
    });
  }
  getCurrentBox(rect: BoundingBox, node: Resizable, corner: ResizeCorner, e: MouseEvent): OverrideBoundingBox {
    const { clientX, clientY } = e;

    let x: number | undefined = undefined;
    let y: number | undefined = undefined;
    let width: number | undefined = undefined;
    let height: number | undefined = undefined;

    // note: the box is in screen coords
    if (corner.includes('n')) {
      height = clamp(node.minHeight, node.maxHeight ?? Infinity, rect.bottom - clientY);
      // south edge moves based on the constrained height
      y = rect.bottom - height;
    }
    if (corner.includes('w')) {
      width = clamp(node.minWidth, node.maxWidth ?? Infinity, rect.right - clientX);
      // east edge moves based on the constrained width
      x = rect.right - width;
    }
    if (corner.includes('s')) {
      height = clamp(node.minHeight, node.maxHeight ?? Infinity, clientY - rect.top);
      // north edge never moves
      y = rect.y;
    }
    if (corner.includes('e')) {
      width = clamp(node.minWidth, node.maxWidth ?? Infinity, clientX - rect.left);
      // west edge never moves
      x = rect.x;
    }

    return new OverrideBoundingBox({
      x,
      y,
      width,
      height,
      // note: innerScale is set to 1 by default in OverrideBoundingBox, so we have to copy the scale over
      innerScale: rect.innerScale,
      totalScale: rect.totalScale,
      blend: 1,
    });
  }
}

function setCursor(resizeCorner: string) {
  let cursor: string;
  switch (resizeCorner) {
    case 'n':
    case 's':
      cursor = 'ns-resize';
      break;
    case 'e':
    case 'w':
      cursor = 'ew-resize';
      break;
    case 'ne':
    case 'sw':
      cursor = 'nesw-resize';
      break;
    case 'nw':
    case 'se':
      cursor = 'nwse-resize';
      break;
    default:
      throw new Error('Invalid resize corner');
      break;
  }

  document.documentElement.style.cursor = cursor;
}

export function getResizeCorner(boundingBox: BoundingBox, e: MouseEvent): ResizeCorner | null {
  const { clientX, clientY } = e;
  const { left, right, top, bottom } = boundingBox;
  // // There is some duplicate logic in this if statement and the ifLeft/Right/Top/Bottom; there's probably a cleverer way to do this
  if (
    clientX > right + RESIZE_THRESHOLD ||
    clientX < left - RESIZE_THRESHOLD ||
    clientY < top - RESIZE_THRESHOLD ||
    clientY > bottom + RESIZE_THRESHOLD
  )
    return null;

  const isLeft = Math.abs(left - clientX) < RESIZE_THRESHOLD;
  const isRight = Math.abs(right - clientX) < RESIZE_THRESHOLD;
  const isTop = Math.abs(top - clientY) < RESIZE_THRESHOLD;
  const isBottom = Math.abs(bottom - clientY) < RESIZE_THRESHOLD;
  if (isTop) {
    if (isLeft) return 'nw';
    if (isRight) return 'ne';
    return 'n';
  }
  if (isBottom) {
    if (isLeft) return 'sw';
    if (isRight) return 'se';
    return 's';
  }
  if (isLeft) return 'w';
  if (isRight) return 'e';

  return null;
}
