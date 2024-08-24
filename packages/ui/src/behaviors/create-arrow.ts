import { Behavior, DispatchStatus, EventNav } from '..';
import { Model, trxWrap } from '@edvoapp/common';
import * as VM from '../viewmodel';
import equals from 'fast-deep-equal';
import { OwnedProperty } from '@edvoapp/util';

export class CreateArrow extends Behavior {
  isDragging = false;
  @OwnedProperty
  fromNode: null | VM.VertexNode = null;
  handleMouseDown(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    const sortedDk = [...eventNav.downKeys].sort();

    // const node = equals(sortedDk, ['alt', 'shift'])
    //   ? originNode.findClosest((n) => n instanceof VM.VertexNode && n)
    //   : originNode.findClosest((n) => n instanceof VM.ArrowDragHandle && n)
    //       ?.parentNode;

    const node = originNode.findClosest((n) => n instanceof VM.ArrowDragHandle && n)?.parentNode;

    if (!node) return 'decline';

    this.isDragging = true;
    eventNav.setGlobalBehaviorOverrides(this, ['handleMouseMove', 'handleMouseUp']);

    this.fromNode = node;

    return 'stop';
  }

  handleMouseMove(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    if (!this.isDragging) return 'decline';

    const linkableNode = originNode.findClosest((n) => n instanceof VM.Member && n && n);

    if (linkableNode && this.fromNode?.contains(linkableNode)) return 'stop';

    // if (this.lastHover && this.lastHover !== linkableNode) {
    //   this.lastHover.setHover(false, true);
    // }

    // linkableNode?.setHover('arrow', true);
    // this.lastHover = linkableNode ?? null;
    // node.setHover(true, true);

    return 'stop';
  }

  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    const node = this.fromNode;
    if (!this.isDragging || !node) return 'decline';

    // this.lastHover?.(false, true);
    const closestVertexNode = originNode.findClosest(
      // TODO: this is correct, but we need to fix the positioning logic for things like outline items
      // (n) => n instanceof VM.VertexNode && n,
      (n) => (n instanceof VM.Member || n instanceof VM.ContentCard) && n,
    );
    if (!closestVertexNode) return 'decline';
    eventNav.unsetGlobalBehaviorOverrides(this);
    const targetVertex = closestVertexNode.vertex;
    void trxWrap(async (trx) => {
      node.vertex.createEdge({
        role: ['arrow'],
        trx,
        target: targetVertex,
        meta: {},
      });
    });
    this.isDragging = false;
    return 'stop';
  }
}
