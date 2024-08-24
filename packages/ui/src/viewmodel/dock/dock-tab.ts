import {
  ChangeContext,
  ItemEventOrigin,
  MemoizeOwned,
  Observable,
  ObservableReader,
  OwnedProperty,
  tryJsonParse,
} from '@edvoapp/util';

import { Model, TrxRef } from '@edvoapp/common';
import { Draggable, MemberAppearance, PositionAndType } from '../../behaviors';
import { Behavior, DispatchStatus, EventNav } from '../../service';

import { BoundingBox, BranchNode, BranchNodeCA, Node, PropertyValueNode } from '../base';
import { DockItem } from './dock-item';

interface CA extends BranchNodeCA<DockItem> {}

export class DockTab extends BranchNode<DockItem> implements Draggable {
  static new(args: CA) {
    const me = new DockTab(args);
    me.init();
    return me;
  }

  getLocalBehaviors(): Behavior[] {
    return [new Expand()];
  }

  get draggable() {
    return true;
  }
  @OwnedProperty
  dragging = new Observable<PositionAndType | null>(null);
  setDragging(pos: PositionAndType | null) {
    this.dragging.set(pos);
  }

  @MemoizeOwned()
  get text() {
    return Observable.calculated(({ name, body }) => name || body, {
      name: this.name,
      body: this.bodyText,
    });
  }
  @MemoizeOwned()
  get pressed() {
    return this.meta.mapObs((meta) => {
      return meta?.dockExpanded ?? false;
    });
  }

  /**
   * The positioning and scaling information the topic space plane relative to the browser native coordinate system
   * assuming the root topic space is positioned at 0,0 (which may be offset in practice)
   */
  @MemoizeOwned()
  get clientRectObs(): ObservableReader<BoundingBox> {
    const myPlaneCoords = this.planeCoords;
    const dragging = this.dragging;

    const getval = () => {
      const myCoords = myPlaneCoords.value;
      const drag = dragging.value;
      return myCoords.clone().compose(drag?.position ?? null);
    };

    const obs = new Observable<BoundingBox>(getval());
    const recalc = (_: any, origin: ItemEventOrigin, ctx: ChangeContext) => obs.set(getval(), origin, ctx);

    obs.managedSubscription(myPlaneCoords, recalc);
    obs.managedSubscription(dragging, recalc);
    return obs;
  }

  get dragHandle(): boolean {
    return true;
  }

  @MemoizeOwned()
  get planeCoords() {
    const clientRectObs = this.root!.clientRectObs;
    const meta = this.meta;
    return Observable.fromObservables(() => {
      const { dockCoordinate } = meta.value;
      const rootHeight = clientRectObs.value?.height ?? 1000;
      return new BoundingBox({
        x: dockCoordinate ?? 0,
        y: rootHeight - 32,
        height: 30,
        width: 300,
      });
    }, [clientRectObs, meta]);
  }

  @MemoizeOwned()
  get appearance() {
    // Arguably apparance is NOT a ViewModelNode - we should set this as a property of the inner though!
    return PropertyValueNode.new<MemberAppearance | undefined>({
      property: this.vertex
        .filterProperties({
          role: ['appearance'],
          userID: this.visibleUserIDsForDescendants,
        })
        .firstObs(),
      valueTransform: (p) => {
        // Formatted for your reading pleasure o/
        if (typeof p === 'undefined') return undefined;
        if (!p) return {};

        const jsonObs = p.text.mapObs((c) => tryJsonParse<MemberAppearance>(c) as MemberAppearance | undefined);

        return jsonObs;
      },

      parentNode: this,
    });
  }

  // for the dock-tab
  @MemoizeOwned()
  get dockCoord() {
    return this.meta.mapObs((m) => m.dockCoordinate ?? 0);
  }

  handleDepart(trx: TrxRef) {
    this.backref.archive(trx);
    return true;
  }

  getBehaviors(): Behavior[] {
    return [];
  }

  @MemoizeOwned()
  get relativeBoundingBox() {
    return this.backref.meta.mapObs(cardStateToBoundingBox);
  }

  @MemoizeOwned()
  get meta() {
    return this.backref.meta;
  }
  async getSize() {
    const { height, width, ratio } = await this.backref.meta.get();
    return { height, width, ratio };
  }
  async setSize({ trx, size }: { trx: TrxRef; size: Model.SizedState }) {
    await this.backref.setMetaMerge({ trx, meta: size });
  }
  get childProps(): (keyof this & string)[] {
    return [];
  }
}

function cardStateToBoundingBox(cardState: Model.TopicSpaceCardState): BoundingBox {
  const x = cardState.x_coordinate ?? 0;
  const y = cardState.y_coordinate ?? 0;
  const width = cardState.width ?? 100;
  const height = cardState.height ?? 100;

  return new BoundingBox({ x, y, height, width });
}

class Expand extends Behavior {
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const node = originNode.findClosest((n) => n instanceof DockTab && n)?.parentNode;
    if (!node) return 'decline';
    node.setExpandedProp(!node.expanded.value);
    return 'stop';
  }
}
