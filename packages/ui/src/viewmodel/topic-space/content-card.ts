import {
  ChangeContext,
  Destroy,
  IObservable,
  ItemEventOrigin,
  MemoizeOwned,
  Observable,
  ObservableReader,
  OwnedProperty,
} from '@edvoapp/util';
import { Behavior } from '../../service';
import { Model, TrxRef, trxWrap, trxWrapSync } from '@edvoapp/common';
import {
  ContentMode,
  DragDrop,
  Draggable,
  PositionAndType,
  Resizable,
  Resize,
  ResizeCorner,
  ResizeDoneArgs,
  ResizeStepArgs,
  FullScreen,
  FullScreenable,
} from '../../behaviors';
import { BoundingBox, ConditionalNode, Node, OverrideBoundingBox, VertexNode, VertexNodeCA } from '../base';
import { BodyContent } from '../body-content';
import {
  ActionMenu,
  Member,
  MemberBody,
  MemberSelectionIndicator,
  ProfileForm,
  ProfileSelector,
  TopicSpace,
} from './index';
import { ResizeHandle } from '../resize-handle';
import { Behaviors, DEFAULT_WEBCARD_DIMS } from '../..';
import { AppDesktop } from '../app-desktop';

const PARTITION_PREFIX = 'persist:';
const DEFAULT_WEBCARD_POSITION = { x: 150, y: 150 };

interface CA extends VertexNodeCA<ConditionalNode<any, any, TopicSpace>> {
  property: Model.Property;
}

export class ContentCard
  extends VertexNode<ConditionalNode<any, any, TopicSpace>>
  implements Draggable, Resizable, FullScreenable
{
  @OwnedProperty
  readonly property: Model.Property;
  allowHover = true;
  selectOnFocus = true;

  get selectable(): boolean {
    return true;
  }

  constructor({ property, ...args }: CA) {
    super(args);
    this.property = property;
  }

  static new(args: CA) {
    const me = new ContentCard(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return [
      'arrowDragHandleN',
      'arrowDragHandleE',
      'arrowDragHandleS',
      'arrowDragHandleW',
      'content',
      'profileForm',
      'profileSelector',
      'selectionIndicator',
      'actionMenu',
    ];
  }

  getLocalBehaviors(): Behavior[] {
    return [new Resize(), new FullScreen(), new DragDrop(), new ContentMode()];
  }

  @MemoizeOwned()
  get planeScaleObs() {
    return this.parentNode.parentNode.planeScaleObs ?? null;
  }
  @MemoizeOwned()
  get localPlaneScaleObs() {
    return this.parentNode.parentNode.localPlaneScaleObs ?? null;
  }

  get myTopicSpace(): TopicSpace {
    return this.parentNode.parentNode;
  }

  get body() {
    return new Observable(null);
  }

  @MemoizeOwned()
  get actionMenu(): ConditionalNode<ActionMenu, boolean, Member | ContentCard> {
    const root = this.context.rootNode;
    let tileContainer: Node | null = null;

    if (root && root instanceof AppDesktop) {
      tileContainer = root.tileContainer;
    }

    const precursor = Observable.calculated(
      ({ isFocused, isTiling }) => {
        const tileContainerItems = tileContainer?.children;
        return Boolean(isFocused || (isTiling && tileContainerItems && tileContainerItems.includes(this)));
      },
      { isFocused: this.isFocused, isTiling: this.isTiling },
    );

    return ConditionalNode.new<ActionMenu, boolean, Member | ContentCard>({
      precursor,
      parentNode: this,
      factory: (want, parentNode) => {
        return want
          ? ActionMenu.new({
              parentNode,
              context: this.context,
              vertex: this.vertex,
            })
          : null;
      },
    });
  }

  /**
   * Coordinates of this member card in the coordinate system of the parent topic space.
   * This coordinate system may be substantially different from the screen coordinate system.
   *
   * NOTE - height and width are currently an overstated estimate. See note in cardStateToPlaneCoords
   */
  @MemoizeOwned()
  get planeCoords(): ObservableReader<BoundingBox> {
    return Observable.calculated(
      ({ meta: { x_coordinate: x, y_coordinate: y, width, height, ratio } }) => {
        let defaultWidth = DEFAULT_WEBCARD_DIMS.width;
        let defaultHeight = DEFAULT_WEBCARD_DIMS.height;
        // TODO: probably a cleaner way to do this.
        let overrideWidth: null | number = null;
        let overrideHeight: null | number = null;

        const w = width ?? overrideWidth ?? defaultWidth;
        const h = ratio ? w * ratio : height ?? overrideHeight ?? defaultHeight;

        return new BoundingBox({
          x: x ?? DEFAULT_WEBCARD_POSITION.x,
          y: y ?? DEFAULT_WEBCARD_POSITION.y,
          height: h,
          width: w,
          // inner scale is always 1 because this is relative to the LOGICAL plane coordinate system
          innerScale: 1,
        });
      },
      { meta: this.meta },
    );
  }
  get resizable(): boolean {
    return true;
  }

  @OwnedProperty
  _resizing = new Observable<OverrideBoundingBox | null>(null);
  resizeCorners: ResizeCorner[] = Behaviors.ALL_CORNERS;

  resizeStep({ box }: Behaviors.ResizeStepArgs) {
    const meta = this.meta.value;
    const ratio = meta?.ratio;

    if (box) {
      const { width, height } = box;

      if (height !== undefined) {
        box = new OverrideBoundingBox({
          ...box,
          height: Math.max(50 * box.innerScale, height),
        });
      }

      if (width !== undefined) {
        box = new OverrideBoundingBox({
          ...box,
          width: Math.max(100 * box.innerScale, width),
        });
      }

      if (ratio) {
        const { width, height } = box;
        if (height !== undefined) {
          box = new OverrideBoundingBox({ ...box, width: height / ratio });
        } else if (width !== undefined) {
          box = new OverrideBoundingBox({ ...box, height: width * ratio });
        }
      }
    }

    this._resizing.set(box);
  }

  resizeCancel(): void {
    this._resizing.set(null);
  }

  async resizeDone({ box, trx }: ResizeDoneArgs) {
    this._resizing.set(null);

    const rect = this.clientRectObs.value.compose(box);
    const topicspace = this.parentNode.parentNode;
    if (!topicspace) return;

    const tl = topicspace.clientCoordsToSpaceCoords({
      x: rect.x,
      y: rect.y,
    });
    const br = topicspace.clientCoordsToSpaceCoords({
      x: rect.right,
      y: rect.bottom,
    });
    await this.updateMeta({
      trx,
      meta: {
        x_coordinate: tl.x,
        y_coordinate: tl.y,
        width: br.x - tl.x,
        height: br.y - tl.y,
      },
    });
  }

  @OwnedProperty
  _tiling = new Observable<OverrideBoundingBox | null>(null);
  setFullScreen(box: OverrideBoundingBox | null) {
    this._tiling.set(box);
  }

  @OwnedProperty
  dragging = new Observable<PositionAndType | null>(null);
  setDragging(pos: PositionAndType | null) {
    this.dragging.set(pos);
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

    const myTopicSpace = this.closestInstance(TopicSpace);
    if (!myTopicSpace) throw 'sanity error - must be a child of TopicSpace';

    const superTopicSpace = myTopicSpace.parentNode?.closestInstance(TopicSpace);

    // TODO: inline these into the calculated deps object
    const superPlaneScale = superTopicSpace?.planeScaleObs;
    const myPlaneCoords = this.planeCoords;
    const myViewportObs = myTopicSpace.viewportState;
    const spaceClientRectObs = myTopicSpace.clientRectObs;

    const resizing = this._resizing;
    const tiling = this._tiling;
    const dragging = this.dragging;

    return Observable.calculated(
      ({ viewport, planeCoords, spaceClientRect, resizing, tiling, dragging, superPlaneScale }) => {
        const myScale = viewport?.planeScale ?? 1;
        const superScale = superPlaneScale ?? 1;
        const scale = myScale * superScale;
        const supX = spaceClientRect.left; // where is the left edge of my parent topic space?
        const supY = spaceClientRect.top;

        const resize = resizing;
        const tile = tiling;
        const drag = dragging?.position ?? null;

        // Both myCoords and myViewportCoords are in LOGICAL coords, so we need to scale it
        const x = supX + (planeCoords.left - (viewport?.left ?? 0)) * scale;
        const y = supY + (planeCoords.top - (viewport?.top ?? 0)) * scale;

        const height = planeCoords.height * scale;
        const width = planeCoords.width * scale;

        const myBox = new BoundingBox({
          x,
          y,
          height,
          width,
          innerScale: myScale,
          totalScale: scale,
        });

        let res = myBox.compose(resize).compose(tile).compose(drag);

        return res;
      },
      {
        viewport: myViewportObs,
        planeCoords: myPlaneCoords,
        spaceClientRect: spaceClientRectObs,
        resizing,
        tiling,
        dragging,
        superPlaneScale,
      },
    );
  }

  /** CSS clip-path for this card.
   * false means the card is fully clipped/off screen.
   * null means the card needs no clipping and is fully visible  */
  @MemoizeOwned()
  get clipPath(): ObservableReader<string | null | false> | null {
    const clipBoxObs = this.clipBox;
    if (!clipBoxObs) return null;

    const clientRectObs = this.clientRectObs;
    const planeScaleObs = this.planeScaleObs;
    const localScaleObs = this.localPlaneScaleObs;

    const value = (): string | false | null => {
      const clipBox = clipBoxObs?.value;
      const myRect = clientRectObs.value;
      if (!clipBox) return null;

      const intersect = clipBox.intersect(myRect);
      if (!intersect) {
        return false;
      } else if (clipBox.fullyContains(myRect)) {
        return null;
      } else {
        const planeScale = planeScaleObs?.value ?? 1;

        const myBox = clipBox.map_origin(myRect).unscale(planeScale);

        const { left, top, right, bottom } = myBox;
        const polygon = `polygon(${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px)`;
        return polygon;
      }
    };

    const obs = new Observable(value());
    const calc = () => obs.set(value());
    obs.managedSubscription(clipBoxObs, calc);
    obs.managedSubscription(clientRectObs, calc);
    if (planeScaleObs) obs.managedSubscription(planeScaleObs, calc);
    if (localScaleObs) obs.managedSubscription(localScaleObs, calc);

    return obs;
  }

  @MemoizeOwned()
  get content() {
    return BodyContent.new({
      vertex: this.vertex,
      parentNode: this,
    });
  }

  get dragHandle(): boolean {
    return true;
  }

  // @MemoizeOwned()
  get meta() {
    return this.vertex.meta;
  }
  get cursor() {
    return 'grab';
  }

  async updateMeta(arg: { trx: TrxRef; meta: Model.TopicSpaceCardState }) {
    await this.vertex.setMetaMerge(arg);
  }

  get editable() {
    return this.vertex.editable.value;
  }
  async getSize() {
    const { height, width, ratio } = await this.vertex.meta.get();
    return { height, width, ratio };
  }

  async setSize({ trx, size }: { trx: TrxRef; size: Model.SizedState }) {
    await this.vertex.setMetaMerge({ trx, meta: size });
  }

  @MemoizeOwned()
  get sizeObs() {
    return this.vertex.meta;
  }

  get draggable() {
    // only draggable when not tiling
    return !this._tiling.value;
  }

  @MemoizeOwned()
  get tiling(): ObservableReader<boolean> {
    return this._tiling.mapObs((t) => !!t);

    // this.onCleanup(
    //   obs.subscribe((val) => {
    //     const spaces = document.getElementsByClassName('topic-space-parent');
    //     for (const space of spaces) {
    //       (space as HTMLElement).style.visibility = val ? 'hidden' : 'visible';
    //     }
    //   }),
    // );
    // return obs;
  }

  @MemoizeOwned()
  get selectionIndicator(): ConditionalNode<MemberSelectionIndicator, boolean, Member | ContentCard> {
    // only show if is selected and not tiling
    const precursor = Observable.calculated(({ isSelected, isTiling }) => isSelected && !isTiling, {
      isSelected: this.isSelected,
      isTiling: this.isTiling,
    });
    return ConditionalNode.new<MemberSelectionIndicator, boolean, Member | ContentCard>({
      parentNode: this,
      label: 'selectionIndicator',
      precursor,
      factory: (selected, parentNode) => (selected ? MemberSelectionIndicator.new({ precursor, parentNode }) : null),
    });
  }

  // native app stuff below?

  @MemoizeOwned()
  get profileFormOpen() {
    return new Observable(false);
  }
  @MemoizeOwned()
  get profileSelectorOpen() {
    return new Observable(false);
  }

  @MemoizeOwned()
  get profileName() {
    return new Observable<string | null>(null);
  }

  @MemoizeOwned()
  get profileForm() {
    return ProfileForm.new({
      parentNode: this,
      vertex: this.vertex,
      context: this.context,
      open: this.profileFormOpen,
    });
  }
  @MemoizeOwned()
  get profileSelector() {
    return ProfileSelector.new({
      vertex: this.vertex,
      parentNode: this,
      context: this.context,
      open: this.profileSelectorOpen,
    });
  }

  @MemoizeOwned()
  get activeProfile() {
    return this.vertex
      .filterEdges(['using-profile'])
      .firstObs()
      .mapObs((x) => x && x.target);
  }

  handleCreateProfile() {
    const profileName = this.profileName.value;
    const currentUser = this.context.authService.currentUserVertexObs.value;

    if (!currentUser || !profileName) {
      return;
    }

    trxWrapSync((trx) => {
      const profile = this.context.eventNav.authService.createProfile(trx, profileName);
      if (profile) {
        this.profileFormOpen.set(false);
        this.profileName.set(null);
        this.switchProfile(profile);
      }
    });
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

  switchProfile(profile?: Model.Vertex) {
    void trxWrap(async (trx) => {
      if (profile) {
        this.vertex.filterEdges(['using-profile']).map((p) => p.archive(trx));
        const args = {
          trx,
          target: profile,
          role: ['using-profile'],
          meta: {},
        };
        this.vertex.createEdge(args);
      } else {
        this.vertex.filterEdges(['using-profile']).map((p) => p.archive(trx));
      }
    });
  }
}

function cardStateToPlaneCoords(cardState: Model.TopicSpaceCardState): BoundingBox {
  const x = cardState.x_coordinate ?? 0;
  const y = cardState.y_coordinate ?? 0;
  const width = cardState.width ?? 300;
  const height = cardState.height ?? 300;

  return new BoundingBox({ x, y, height, width });
}
