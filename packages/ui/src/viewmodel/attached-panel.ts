import { BoundingBox, ChildNode, ChildNodeCA, Node } from './base';
import { getWasmBindings, MemoizeOwned, Observable, ObservableReader, OwnedProperty } from '@edvoapp/util';
import { Behavior, DispatchStatus, EventNav } from '../service';
import { config } from '@edvoapp/common';

export interface AttachedPanelCA<ParentNode extends Node> extends ChildNodeCA<ParentNode> {
  maxWidth?: number;
  maxHeight?: number;
}

export abstract class AttachedPanel<ParentNode extends Node = Node> extends ChildNode<ParentNode> {
  maxHeight?: number;
  maxWidth?: number;
  hasDepthMask = true;
  zIndexed = true;

  @OwnedProperty
  trigger?: Observable<boolean>;
  overflow = true;
  constructor({ maxWidth, maxHeight, ...args }: AttachedPanelCA<ParentNode>) {
    super(args);
    this.maxWidth = maxWidth;
    this.maxHeight = maxHeight;
    this.context.floatingPanels.add(this);
    this.onCleanup(() => {
      this.context?.floatingPanels.delete(this);
    });
  }

  @MemoizeOwned()
  get clientRectObs() {
    return this.parentRect.mapObs((x) => x ?? BoundingBox.ZERO);
  }

  @MemoizeOwned()
  get parentRect() {
    return new Observable<null | BoundingBox>(null);
  }

  show() {
    const p = this.parentNode;
    void p?.waitForDomElement().then(() => {
      const rect = p.upgrade()?.clientRectObs.value;
      if (rect) this.upgrade()?.parentRect.set(rect);
    });
  }

  hide() {
    this.parentRect.set(null);
  }

  @MemoizeOwned()
  get visible(): ObservableReader<boolean> {
    const position = this.parentRect;
    return Observable.fromObservables(() => position.value !== null, [position]);
  }

  // Workaround with the visible=true and final depthmask update not happening with inherited initdepthmask.
  // TODO: get rid of this and find a way to get zIndex to the correct value instead
  initDepthMask() {
    const zIndex = this.zIndex;
    const clientRectObs = this.clientRectObs;
    const visible = this.visible;
    const parentRect = this.parentRect;
    const depthMaskService = this.context.depthMaskService;

    {
      const { x, y, width, height } = this.clientRectObs.value;
      const z = zIndex.value;
      this.depthMaskId = depthMaskService?.add_instance(x, y, z, width, height);
    }

    const calc = () => {
      if (!this.depthMaskId) return;
      if (parentRect.value) {
        const { x, y, width, height } = clientRectObs.value;
        const z = this._depthMaskZ ?? (zIndex.value || 100000); //HACK to fix attached panel zindex assignment issues
        depthMaskService?.update_instance(this.depthMaskId, x, y, width, height, z);
      } else {
        depthMaskService?.remove_instance(this.depthMaskId);
      }
    };

    this.managedSubscription(visible, calc);
    this.managedSubscription(parentRect, calc);
    this.managedSubscription(clientRectObs, calc);
    calc();
  }

  getHeritableBehaviors(): Behavior[] {
    return [new EscKey()];
  }
}

class EscKey extends Behavior {
  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: Node): DispatchStatus {
    const panel = originNode.findClosest((n) => n instanceof AttachedPanel && n);
    if (!panel) return 'decline';
    const key = e.key.toLowerCase();
    if (['escape', 'esc'].includes(key)) {
      panel.hide();
      return 'stop';
    }
    return 'decline';
  }
}
