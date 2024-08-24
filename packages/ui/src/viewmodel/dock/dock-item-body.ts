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
import { Draggable, MemberAppearance, PositionAndType, ResizeCorner } from '../../behaviors';
import {
  BoundingBox,
  BranchNode,
  BranchNodeCA,
  ConditionalNode,
  Node,
  OverrideBoundingBox,
  PropertyValueNode,
} from '../base';
import { MemberBody } from '../topic-space';
import { DockItem } from './dock-item';
import { Behavior, DispatchStatus, EventNav } from '../../service';
import { Resizable, ResizeStepArgs } from '../../behaviors/resize';
import { Behaviors } from '../..';

const PARTITION_PREFIX = 'persist:';

interface CA extends BranchNodeCA<ConditionalNode<DockItemBody, boolean, DockItem>> {}

export class DockItemBody
  extends BranchNode<ConditionalNode<DockItemBody, boolean, DockItem>>
  implements Draggable, Resizable
{
  hasDepthMask = true;
  zIndexed = true;
  static new(args: CA) {
    const me = new DockItemBody(args);
    me.init();
    return me;
  }

  getHeritableBehaviors(): Behavior[] {
    return [new Expand()];
  }

  get childProps(): (keyof this & string)[] {
    return ['body'];
  }

  get draggable() {
    return true;
  }
  @OwnedProperty
  dragging = new Observable<PositionAndType | null>(null);
  setDragging(pos: PositionAndType | null) {
    this.dragging.set(pos);
  }

  get resizable(): boolean {
    return true;
  }
  @OwnedProperty
  _resizing = new Observable<OverrideBoundingBox | null>(null);
  resizeStep({ box }: ResizeStepArgs) {
    this._resizing.set(box);
  }
  resizeCorners: ResizeCorner[] = ['n', 'nw', 'w', 'e', 'ne'];
  async resizeDone({ box, trx }: Behaviors.ResizeDoneArgs) {
    //   const rect = this.clientRectObs.value.compose(box);
    //   const topicspace = this.myTopicSpace;
    //   if (!topicspace) return;
    //   const tl = topicspace.clientCoordsToSpaceCoords({ x: rect.x, y: rect.y });
    //   const br = topicspace.clientCoordsToSpaceCoords({
    //     x: rect.right,
    //     y: rect.bottom,
    //   });
    //   await this.updateMeta({
    //     trx,
    //     meta: {
    //       x_coordinate: tl.x,
    //       y_coordinate: tl.y,
    //       width: br.x - tl.x,
    //       height: br.y - tl.y,
    //     },
    //   });
  }
  resizeCancel(): void {
    this._resizing.set(null);
  }
  /**
   * The positioning and scaling information the topic space plane relative to the browser native coordinate system
   * assuming the root topic space is positioned at 0,0 (which may be offset in practice)
   */
  @MemoizeOwned()
  get clientRectObs(): ObservableReader<BoundingBox> {
    // Temporarily assuming that only members can provide offsetting coordinate values
    // But I think the right way to do this in the long run is to treat panning as a negative margin/padding for members and topic spaces respectively.
    // And implement this as a first class primative for all VM Nodes.

    const myPlaneCoords = this.planeCoords;
    const resizing = this._resizing;
    const dragging = this.dragging;

    const getval = () => {
      const myCoords = myPlaneCoords.value;
      const resize = resizing.value;
      const drag = dragging.value;
      const res = myCoords
        .clone()
        .compose(resize)
        .compose(drag?.position ?? null);
      return res;
    };

    const obs = new Observable<BoundingBox>(getval());
    const recalc = (_: any, origin: ItemEventOrigin, ctx: ChangeContext) => obs.set(getval(), origin, ctx);

    obs.managedSubscription(myPlaneCoords, recalc);
    obs.managedSubscription(resizing, recalc);
    obs.managedSubscription(dragging, recalc);
    return obs;
  }

  get dragHandle(): boolean {
    return true;
  }

  @MemoizeOwned()
  get meta() {
    return this.backref.meta;
  }

  async updateMeta(arg: { trx: TrxRef; meta: Model.TopicSpaceCardState }): Promise<void> {
    await this.backref.setMetaMerge(arg);
  }

  handleDepart(trx: TrxRef) {
    this.backref.archive(trx);
    return true;
  }

  @MemoizeOwned()
  get planeCoords() {
    const clientRectObs = this.root?.clientRectObs;
    const metaObs = this.meta;
    return Observable.fromObservables(() => {
      const meta = metaObs.value;
      const x_coordinate = meta.x_coordinate ?? 0;
      const dockCoordinate = meta.dockCoordinate ?? 0;
      const width = meta.width ?? 300;
      const height = meta.height ?? 300;
      const rootHeight = clientRectObs?.value?.height ?? 1000;
      return new BoundingBox({
        // x_coordinate is relative to the dockCoordinate
        x: x_coordinate + dockCoordinate,
        // since the y-coordinate tracks from the top, we have to subtract the value from the total height
        y: rootHeight - height - 30, // 30 is the height of the dock
        height,
        width,
      });
    }, [clientRectObs, metaObs]);
  }

  @MemoizeOwned()
  get body() {
    return MemberBody.new({
      parentNode: this,
      vertex: this.vertex,
      context: this.context,
    });
  }

  get isVisible(): boolean {
    return this.parentNode.parentNode.expanded.value;
  }

  @MemoizeOwned()
  get visible(): ObservableReader<boolean> {
    return this.parentNode.parentNode.expanded;
  }

  @MemoizeOwned()
  get appearance() {
    // Arguably apparance is NOT a Node - we should set this as a property of the inner though!
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

        return p.text.mapObs((c) => tryJsonParse<MemberAppearance>(c) as MemberAppearance | undefined);
      },

      parentNode: this,
    });
  }

  @MemoizeOwned()
  get activeProfile() {
    return this.vertex
      .filterEdges(['using-profile'])
      .firstObs()
      .mapObs((x) => x && x.target);
  }

  @MemoizeOwned()
  get partition() {
    return Observable.calculated(
      ({ activeProfile, defaultProfile }) => {
        const profile = (activeProfile ||= defaultProfile);
        return profile && `${PARTITION_PREFIX}${profile.id}`;
      },
      { activeProfile: this.activeProfile, defaultProfile: this.context.authService.defaultProfile },
    );
  }
}

export class Expand extends Behavior {
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const node = originNode.findClosest((n) => n instanceof DockItem && n);
    if (!node) return 'decline';
    node.setExpandedProp(true);
    return 'continue';
  }
}
