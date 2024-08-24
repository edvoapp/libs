import {
  BoundingBox,
  BranchNode,
  BranchNodeCA,
  ConditionalNode,
  ListNode,
  Node,
  NodeAndContext,
  OverrideBoundingBox,
  Position,
  VertexNode,
} from '../base';
import { TopicSpace } from './topic-space';
import { MemberBody } from './member-body';
import {
  debug,
  getWasmBindings,
  MemoizeOwned,
  Observable,
  ObservableList,
  ObservableReader,
  OwnedProperty,
  tryJsonParse,
} from '@edvoapp/util';
import * as Behaviors from '../../behaviors';
import { Draggable, PositionAndType, Resizable, ResizeCorner, FullScreenable } from '../../behaviors';
import { ActionGroup, Behavior, FocusContext, generateBrightColor, uiParams } from '../../index';
import { Model, TrxRef, globalStore, subTrxWrapSync, trxWrap, trxWrapSync } from '@edvoapp/common';
import { renderableMimeTypes } from '../body-content';
import { UpdatablesSet } from '../base/updatables';
import { ActionMenu, AppDesktop, Arrow, ContentCard, ImplicitRelationBlob, MemberHeader } from '..';
import { Sidecar } from './sidecar';
import { SidecarChevron } from './body-sidecar-chevron';
import { ProfileForm } from './profile-form';
import { ProfileSelector } from './profile-selector';
import * as Bindings from '@edvoapp/wasm-bindings';
import { MemberSelectionIndicator } from './member-selection-indicator';

const PARTITION_PREFIX = 'persist:';
const BREAK_THRESHOLD = 200;
const DEFAULT_WH = 300;

interface CA extends BranchNodeCA<ListNode<TopicSpace, Member>> {}

function isDefined<T>(val: T): val is NonNullable<T> {
  return val !== null && val !== undefined;
}

export type CardType = 'sticky' | 'outline' | 'webpage' | 'image' | 'pdf';
export type RenderMode = 'full' | 'snapshot' | 'point';

export class Member extends BranchNode<ListNode<TopicSpace, Member>> implements Draggable, Resizable, FullScreenable {
  readonly label = 'Card';
  hasDepthMask = true;
  selectOnFocus = true;
  zIndexed = true;
  allowHover = true;
  overflow = true;
  // allowChildUnloading = true;
  @OwnedProperty
  rustNode: Bindings.VM_Member;

  static new(args: CA) {
    const me = new Member(args);
    me.init();
    return me;
  }

  init() {
    super.init();

    this.onCleanup(
      this.tiling.subscribe((tiling) => {
        this.zIndexOverride.set(tiling ? 100_000 : null);
        this.zEnumerateRecurse(0);
      }),
    );

    this.onCleanup(
      this.isFocused.subscribe((focused) => {
        if (!focused) return;
        const quickAdd = (this.root as AppDesktop).quickAdd;
        const appearance = this.appearance.value;
        if (appearance) {
          const { color, type } = appearance;
          quickAdd.nextMemberColor = color ?? '#fff';
          quickAdd.nextMemberType = type ?? 'stickynote';
          const { width, height } = this.planeCoords.value;
          quickAdd.nextMemberDims = { width, height };
        }
        const membersList = this.parentNode.upgrade();
        if (!membersList) return;
        const zIndexBehavior = new Behaviors.ZIndex();
        zIndexBehavior.bringToFront(this);
      }),
    );
  }

  getHeritableBehaviors(): Behavior[] {
    return [new SidecarExpand()];
  }

  constructor({ ...args }: CA) {
    super(args);
    this.rustNode = this.initRustNode();

    // Hack: there should probably be a cleaner way for this
    const body = this.body;

    this.managedSubscription(body, (b) => {
      if (b) {
        this.managedSubscription(
          b.content.icon,
          (icon) => {
            // TODO: Move this to get resizable
            // if there is an icon, i wanna be transparent
            if (icon) {
              b.transparent = true;
              // this.body.content.transparent = true;
              // this.resizeCorners = [];
            } else {
              // b.transparent = false;
              // this.body.content.transparent = false;
              // this.resizeCorners = Behaviors.ALL_CORNERS;
            }
          },
          true,
        );
      }
    });
  }

  get childProps(): (keyof this & string)[] {
    return [
      'inboundBlobs',
      'inboundArrows',
      'arrowDragHandleN',
      'arrowDragHandleE',
      'arrowDragHandleS',
      'arrowDragHandleW',
      'body',
      'sidecar',
      'selectionIndicator',
      'profileSelector',
      'profileForm',
      'header',
      'actionMenu',
    ];
  }

  get opaque() {
    return !this.isFocused.value;
  }

  get dragHandle(): boolean {
    return true;
  }

  // TODO: figure out how to initialize inside of init rather than the constructor
  private initRustNode(): Bindings.VM_Member {
    const topicSpace = this.closestInstance(TopicSpace);
    if (!topicSpace) throw new Error('TopicSpace node must exist');
    if (!topicSpace.alive) throw new Error('TopicSpace node is not alive');
    if (!topicSpace.rustGraph) throw new Error('sanity error: rust graph must exist');

    const { width, height, x_coordinate, y_coordinate, autoposition, left_align } = this.meta.value;

    const member_meta = getWasmBindings().MemberMeta.init(
      width ?? undefined,
      height ?? undefined,
      !!autoposition,
      x_coordinate ?? undefined,
      y_coordinate ?? undefined,
      !!left_align,
    );
    const rustNode = topicSpace.rustGraph.new_member(member_meta);

    this.onCleanup(
      this.meta.subscribe((meta) => {
        const { x_coordinate, y_coordinate, width, height, autoposition } = meta;
        rustNode.set_meta(
          x_coordinate ?? undefined,
          y_coordinate ?? undefined,
          height ?? undefined,
          width ?? undefined,
          autoposition ?? undefined,
        );
      }),
    );
    this.onCleanup(
      this.dragging.subscribe((pos_and_type) => {
        if (pos_and_type) {
          const { x, y } = pos_and_type.position;
          rustNode.update_coordinates(x, y);
        }
      }),
    );

    return rustNode;
  }

  protected cleanup() {
    this.parentNode?.parentNode?.rustGraph?.remove_member(this.rustNode);
    super.cleanup();
  }

  get focusable(): boolean {
    return true;
  }

  @MemoizeOwned()
  get progressiveRenderingEnabled(): ObservableReader<boolean | null | undefined> {
    return this.context.authService.currentUserVertexObs.mapObs<boolean | null | undefined>((user) =>
      user ? user.getFlagPropertyObs('progressive-rendering-enabled').mapObs((v) => !!v) : null,
    );
  }

  @MemoizeOwned()
  get body(): ConditionalNode<
    MemberBody, // | MemberBodyPlaceholder | MemberBodySnapshot,
    boolean,
    Member
  > {
    const precursor = Observable.calculated(
      ({ visible, renderMode, prEnabled }) => {
        if (!visible) return false;
        if (!prEnabled || renderMode == 'full') return true;
        return false;
      },
      {
        visible: this.visible,
        renderMode: this.renderMode,
        prEnabled: this.progressiveRenderingEnabled,
      },
    );

    return ConditionalNode.new<
      MemberBody, // | MemberBodyPlaceholder | MemberBodySnapshot,
      boolean,
      Member
    >({
      parentNode: this,
      precursor,
      factory: (want, parentNode) =>
        want
          ? MemberBody.new({
              parentNode: this,
              vertex: this.vertex,
              context: parentNode.context,
            })
          : null,
    });
  }

  @MemoizeOwned()
  get header(): ConditionalNode<MemberHeader, boolean, Member> {
    const precursor = Observable.calculated(
      ({ visible, appearance, renderMode }) => {
        if (!visible) return false;
        // Only render the header if we're in snapshot or full mode
        if (!['snapshot', 'full'].includes(renderMode)) return false;

        // Stickynotes and clean cards don't have headers
        const type = appearance?.type;
        return !['stickynote', 'clean'].includes(type ?? '');
      },
      { visible: this.visible, appearance: this.appearance, renderMode: this.renderMode },
    );
    return ConditionalNode.new<MemberHeader, boolean, Member>({
      precursor,
      parentNode: this,
      factory: (want, parentNode) =>
        want
          ? MemberHeader.new({
              parentNode,
              // collapsible: this.collapsible,
              // showCount: this.isRecent,
              // members: this.members,
            })
          : null,
    });
  }
  @MemoizeOwned()
  get actionMenu(): ConditionalNode<ActionMenu, boolean, Member | ContentCard> {
    const root = this.context.rootNode;
    let tileContainer: Node | null = null;
    if (root && root instanceof AppDesktop) {
      tileContainer = root.tileContainer;
    }

    const precursor = Observable.calculated(
      ({ visible, isFocused, isTiling, renderMode }) => {
        if (!visible) return false;
        // Only render the action menu if we're in snapshot or full mode
        if (!['snapshot', 'full'].includes(renderMode)) return false;

        const tileContainerItems = tileContainer?.children;
        return Boolean(isFocused || (isTiling && tileContainerItems && tileContainerItems.includes(this)));
      },
      {
        visible: this.visible,
        isFocused: this.isFocused,
        isTiling: this.isTiling,
        renderMode: this.renderMode,
      },
    );

    return ConditionalNode.new<ActionMenu, boolean, Member | ContentCard>({
      precursor,
      parentNode: this,
      factory: (want, parentNode) =>
        want
          ? ActionMenu.new({
              parentNode,
              context: this.context,
              vertex: this.vertex,
            })
          : null,
    });
  }

  @MemoizeOwned()
  get renderMode(): ObservableReader<RenderMode> {
    return Observable.calculated(
      ({ planeScale, planeCoords, appearance }) => {
        if (planeScale > 0.5) return 'full';
        // Consider the size of the card on screen, but only after we're below 50% scale

        const width = planeCoords.width * planeScale;
        const height = planeCoords.height * planeScale;

        if (width < 20) return 'point';
        if (height < 6) return 'point';
        if (appearance?.type === 'stickynote') return 'full';
        if (width < 100) return 'snapshot';
        return 'full';
      },
      {
        planeScale: this.planeScaleObs,
        planeCoords: this.planeCoords,
        appearance: this.appearance,
      },
    );
  }

  @MemoizeOwned()
  get colorPanelOpen() {
    return new Observable(false);
  }

  isValidMemberAppearanceType(type: any): type is Behaviors.MemberAppearanceType {
    return ['subspace', 'stickynote', 'normal', 'clean', 'browser', 'list', 'card-search', 'file'].includes(type);
  }

  @MemoizeOwned()
  get appearanceProperty(): ObservableReader<Model.Property | null | undefined> {
    return this.vertex
      .filterProperties({
        role: ['appearance'],
        userID: this.visibleUserIDsForDescendants,
      })
      .firstObs();
  }

  @MemoizeOwned()
  get appearance(): ObservableReader<Behaviors.MemberAppearance | undefined> {
    return this.appearanceProperty.mapObs<Behaviors.MemberAppearance | undefined>((p) => {
      // Formatted for your reading pleasure o/
      if (typeof p === 'undefined') return undefined;
      if (!p) return { type: 'normal' };

      const app = p.text.mapObs((c) => tryJsonParse<Behaviors.MemberAppearance>(c));

      // If the appearance property is not a valid member card appearance type, return a default card appearance
      if (app && app.value && this.isValidMemberAppearanceType(app.value.type)) {
        return app;
      } else {
        return { type: 'normal' };
      }
    });
  }

  @MemoizeOwned()
  get computedAppearance(): ObservableReader<Behaviors.MemberAppearance | undefined> {
    const app = this.appearance;
    const prop = this.bodyProperty;
    return Observable.fromObservables((): Behaviors.MemberAppearance | undefined => {
      const property = prop.value;
      const appearance = app.value;

      // this can probably be made cleaner / saner
      const contentType = property?.contentType;
      if (contentType === 'text/x-uri' || contentType === 'text/x-embed-uri') return { type: 'browser' };
      if (renderableMimeTypes.includes(contentType ?? '') && appearance?.type !== 'stickynote')
        return { type: 'clean' };
      if (contentType && !renderableMimeTypes.includes(contentType)) return { type: 'file' };

      if (appearance) {
        return appearance;
      }

      return undefined;
    }, [app, prop]);
  }

  // Tiling

  @MemoizeOwned()
  get tiling(): ObservableReader<boolean> {
    return this._tiling.mapObs((t) => !!t);
  }

  @OwnedProperty
  _tiling = new Observable<OverrideBoundingBox | null>(null);
  /** This gets called with a new OverrideBoundingBox for every animation frame, ending with the last one with a blend of 1 */
  setFullScreen(box: OverrideBoundingBox | null) {
    this._tiling.set(box);
  }

  renderedInPortal(): boolean {
    return this.parentNode.parentNode.parentSpace !== null;
  }

  // Dragging

  get draggable() {
    // only draggable when not tiling
    return !this._tiling.value;
  }

  @MemoizeOwned()
  get implicitEdges() {
    return this.vertex.filterEdges(['implicit']);
  }

  @MemoizeOwned()
  get implicitBackrefs() {
    return this.vertex.filterBackrefs({
      role: ['implicit'],
    });
  }

  @MemoizeOwned()
  get implicitRelationships() {
    const edges = this.implicitEdges;
    const backrefs = this.implicitBackrefs;

    const value = () => {
      const e = edges.value;
      const b = backrefs.value;
      return [...e, ...b];
    };

    const calc = () => obs.replaceAll(value());

    const obs = new ObservableList<Model.Edge | Model.Backref>([]);
    obs.managedSubscription(edges, calc);
    obs.managedSubscription(backrefs, calc);

    return obs;
  }

  @OwnedProperty
  dragging = new Observable<PositionAndType | null>(null);
  setDragging(pos: PositionAndType | null) {
    this.dragging.set(pos);
    if (pos) {
      this.makeAndBreakImplicitRelationships();
    }
    document.documentElement.style.cursor = this.cursor;
  }

  async savePosition(trx: TrxRef) {
    if (!this.rustNode) throw new Error('rust node must exist');
    const coordinates = this.rustNode.coordinates();
    const { x_coordinate, y_coordinate } = this.meta.value;
    if (
      x_coordinate &&
      y_coordinate &&
      Math.trunc(coordinates.x) === Math.trunc(x_coordinate) &&
      Math.trunc(coordinates.y) === Math.trunc(y_coordinate)
    ) {
      return;
    }
    await this.updateMeta({
      trx,
      meta: {
        x_coordinate: coordinates.x,
        y_coordinate: coordinates.y,
      },
    });
  }

  private makeAndBreakImplicitRelationships() {
    this.makeImplicitRelationships();
    this.breakImplicitRelationships(BREAK_THRESHOLD);
  }

  // TODO: Later, break this out of this file and make its own behavior.
  private makeImplicitRelationships() {
    const MAKE_THRESHOLD = 30;

    const rect = this.clientRectObs.value;
    const expandedRect = new BoundingBox({
      x: rect.x - MAKE_THRESHOLD,
      y: rect.y - MAKE_THRESHOLD,
      width: rect.width + MAKE_THRESHOLD * 2,
      height: rect.height + MAKE_THRESHOLD * 2,
      innerScale: this.planeScaleObs?.value ?? 1,
    });

    const surroundingNodes = this.parentNode.getNodesInBoundingBox(
      expandedRect,
      (node) => node !== this && node.parentNode === this.parentNode, // only get my siblings that are within this buffer
    ) as Member[];

    const [targetNode] = surroundingNodes;
    if (!targetNode) return; // eventually we should think about what to do with all other nodes that are within the threshold

    // If a relationship already exists between these two nodes,
    // whether it's an edge or backref, do not create a new one!
    if (this.relationExists(targetNode)) return;

    // don't create relationship between two transcluded nodes
    if (this.vertex === targetNode.vertex) return;

    const [implicit1] = this.implicitRelationships.value;
    const [implicit2] = targetNode.implicitRelationships.value;
    const col1 = implicit1?.meta.value.clusterColor;
    const col2 = implicit2?.meta.value.clusterColor;
    const clusterColor = col1 ?? col2 ?? generateBrightColor();

    trxWrapSync((trx) => {
      this.vertex.createEdge({
        trx,
        role: ['implicit'],
        target: targetNode.vertex,
        meta: {
          clusterColor,
        },
      });
    });
  }

  // TODO: Later, break this out of this file and make its own behavior.
  breakImplicitRelationships(breakThreshold?: number) {
    let siblingsToRemove: Member[] = [];
    const siblings = this.parentNode.children.filter((n) => n !== this);

    if (!breakThreshold) {
      siblingsToRemove = siblings.filter((sib) => this.relationExists(sib));
    } else {
      const rect = this.clientRectObs.value;
      const expandedRect = new BoundingBox({
        x: rect.x - breakThreshold,
        y: rect.y - breakThreshold,
        width: rect.width + breakThreshold * 2,
        height: rect.height + breakThreshold * 2,
        innerScale: this.planeScaleObs?.value ?? 1,
      });

      const surroundingNodes = this.parentNode.getNodesInBoundingBox(
        expandedRect,
        (node) => node !== this && node.parentNode === this.parentNode, // only get my siblings that are within this buffer
      ) as Member[];

      siblingsToRemove = siblings.filter((sib) => !surroundingNodes.includes(sib) && this.relationExists(sib));
    }

    if (siblingsToRemove.length === 0) return;

    trxWrapSync((trx) => {
      for (const sibling of siblingsToRemove) {
        this.implicitRelationships.forEach((r) => {
          if (sibling.vertex === r.target) {
            r.archive(trx);
            if (sibling.rustNode?.num_of_relations() === 0) sibling.updateMetaHelper(trx);
          }
        });
      }
      if (this.rustNode?.num_of_relations() === 0) this.updateMetaHelper(trx);
    });
  }

  private updateMetaHelper(trx: TrxRef) {
    const { autoposition } = this.meta.value;
    if (autoposition && this.rustNode) {
      const coordinates = this.rustNode.coordinates();
      trx.addOp(undefined, (trx) =>
        this.updateMeta({
          trx,
          meta: {
            x_coordinate: coordinates.x,
            y_coordinate: coordinates.y,
          },
        }),
      );
    }
  }

  private relationExists(targetNode: Member) {
    return this.implicitRelationships.value.some((r) => r.target === targetNode.vertex);
  }

  @MemoizeOwned()
  get inboundBlobs(): ListNode<Member, ImplicitRelationBlob, [Model.Backref, VertexNode]> {
    const precursor = this.getCrosslinkObs({
      role: ['implicit'],
      filter: (n) => n instanceof Member && n.parentNode === this.parentNode,
    });
    return ListNode.new({
      parentNode: this as Member,
      precursor,
      factory: ([backref, originNode], parentNode) => {
        return ImplicitRelationBlob.new({
          parentNode,
          backref,
          targetNode: this,
          originNode,
          clusterColor: backref.meta.value.clusterColor ?? [0, 0, 0],
        });
      },
    });
  }

  @MemoizeOwned()
  get inboundArrows(): ListNode<Member, Arrow, [Model.Backref, VertexNode]> {
    const precursor = this.getCrosslinkObs({
      role: ['arrow'],
      filter: (n) => n instanceof Member && n.parentNode === this.parentNode,
    });
    return ListNode.new({
      parentNode: this as Member,
      precursor,
      factory: ([backref, originNode], parentNode) => {
        return Arrow.new({
          parentNode,
          backref,
          targetNode: this,
          sourceNode: originNode,
        });
      },
    });
  }

  get resizable() {
    if (this.renderMode.value == 'point') return false;
    if (this._tiling.value) return false;
    if ((this.planeScaleObs?.value ?? 0) < 0.1) return false;
    return true;
  }

  resizeCorners: ResizeCorner[] = Behaviors.ALL_CORNERS;
  @OwnedProperty
  _resizing = new Observable<OverrideBoundingBox | null>(null);
  resizeStep({ box }: Behaviors.ResizeStepArgs) {
    // TODO: Make this a lot simpler
    const meta = this.meta.value;
    const ratio = meta?.ratio;
    if (box) {
      // TODO: Move this to the resize behavior. It needs to know
      if (ratio) {
        // re-declaring in case it changed above
        const { width, height } = box;
        // if we are resizing by the corner, we are changing both the width and the height.
        // eventually we should probably do some smart mathy stuff, but for now we can just choose one
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
  async resizeDone({ trx }: Behaviors.ResizeDoneArgs) {
    const resizedRect = this._resizing.value; // this is the box that was set in final resizeStep
    this._resizing.set(null);
    const rect = this.clientRectObs.value.compose(resizedRect);
    const topicspace = this.myTopicSpace;
    if (!topicspace) return;

    const tl = topicspace.clientCoordsToSpaceCoords({ x: rect.x, y: rect.y });
    const br = topicspace.clientCoordsToSpaceCoords({
      x: rect.right,
      y: rect.bottom,
    });
    const meta = {
      x_coordinate: tl.x,
      y_coordinate: tl.y,
      width: br.x - tl.x,
      height: br.y - tl.y,
    };
    await this.updateMeta({
      trx,
      meta,
    });
  }

  // size and position

  async getSize() {
    const { height, width, ratio } = await this.backref.meta.get();
    return { height, width, ratio };
  }
  async setSize({ trx, size }: { trx: TrxRef; size: Model.SizedState }) {
    await this.backref.setMetaMerge({ trx, meta: size });
  }
  @MemoizeOwned()
  get sizeObs(): ObservableReader<Model.TopicSpaceCardState> {
    return this.backref.meta;
  }

  get myTopicSpace() {
    return this.closestInstance(TopicSpace);
  }

  /**
   * Coordinates of this member card in the coordinate system of the parent topic space.
   * This coordinate system may be substantially different from the screen coordinate system.
   */
  @MemoizeOwned()
  get planeCoords(): ObservableReader<BoundingBox> {
    return Observable.calculated(
      ({ meta }) => {
        const { x_coordinate, y_coordinate, width: w, height: h } = meta;

        const x = x_coordinate ?? 0;
        const y = y_coordinate ?? 0;
        const width = w ?? DEFAULT_WH;
        const height = h ?? DEFAULT_WH;

        return new BoundingBox({
          x,
          y,
          height,
          width,
          innerScale: 1,
        });
      },
      { meta: this.meta },
    );
  }

  @MemoizeOwned()
  get planeScaleObs() {
    return this.parentNode.parentNode.planeScaleObs ?? null;
  }
  @MemoizeOwned()
  get localPlaneScaleObs() {
    const myTopicSpace = this.findClosest((n) => n instanceof TopicSpace && n)!;
    return myTopicSpace.localPlaneScaleObs;
  }
  /**
   * The positioning and scaling information the topic space plane relative to the browser native coordinate system.
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

        return debug(res, 'MEMBER BOUNDING BOX', true);
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

  /**
   * The bounding box outside of which the component is forbidden to render
   * expressed in client screen coordinates
   */
  @MemoizeOwned()
  get clipBox(): ObservableReader<BoundingBox | null> | null {
    const parentClipBox = this.parentNode.clipBox;
    if (!parentClipBox) return null;
    const dragging = this.dragging;
    const tiling = this._tiling;

    return Observable.calculated(
      ({ dragging, tiling, parentClipBox }) => {
        if (dragging || tiling) {
          return null;
        } else {
          return parentClipBox;
        }
      },
      {
        dragging,
        tiling,
        parentClipBox,
      },
    );
  }

  /** CSS clip-path for this member.
   * false means the member is fully clipped/off screen.
   * null means the member needs no clipping and is fully visible  */
  @MemoizeOwned()
  get clipPath(): ObservableReader<string | null | false> | null {
    const clipBoxObs = this.clipBox;
    if (!clipBoxObs) return null;

    const clientRectObs = this.clientRectObs;
    const planeScaleObs = this.planeScaleObs;
    const localScaleObs = this.localPlaneScaleObs;

    const value = (): string | false | null => {
      const clipBox = clipBoxObs.value;
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
  get visible() {
    // HACK
    const forceVisibility = this.context.forceLoadChildren;
    return Observable.calculated(({ rect, space_rect }) => forceVisibility || rect.intersects(space_rect), {
      rect: this.clientRectObs,
      space_rect: this.parentNode.parentNode.clientRectObs,
    }).debounced((v) => (v === true ? null : (uiParams.memberCullTimeout ?? 0) * 1000));
  }

  @MemoizeOwned()
  get updatables() {
    return new UpdatablesSet([this.backref, this.appearanceProperty]);
  }

  @MemoizeOwned()
  get selectionIndicator(): ConditionalNode<MemberSelectionIndicator, boolean, Member | ContentCard> {
    // only show if is selected and not tiling
    const precursor = Observable.calculated(({ visible, isSelected, isTiling }) => visible && isSelected && !isTiling, {
      visible: this.visible,
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

  // Sidecar

  @MemoizeOwned()
  get sidecar(): ConditionalNode<Sidecar, boolean, Member> {
    const precursor = Observable.calculated(
      ({ visible, body, appearance, bodyProp, renderMode }) => {
        if (!visible) return false;
        if (renderMode == 'point') return false;

        const content = body?.content;
        const module = appearance?.module;
        const chartConfig = appearance?.chartConfig;
        const contentProperty = content?.property.value;
        if (chartConfig && module === 'chart-totals-by-day') return true;
        const type = appearance?.type;
        if (!type) return false;
        if (['subspace', 'list'].includes(type)) return true;
        if (type === 'browser' && !content?.domElement) return true;
        if (type === 'stickynote' || contentProperty || bodyProp) return true;
        return false;
      },
      {
        visible: this.visible,
        body: this.body,
        bodyProp: this.bodyProperty,
        appearance: this.appearance,
        renderMode: this.renderMode,
      },
    );

    return ConditionalNode.new<Sidecar, boolean, Member>({
      parentNode: this,
      precursor,
      factory: (want, parentNode) =>
        want
          ? Sidecar.new({
              parentNode,
              vertex: this.vertex,
              context: this.context,
            })
          : null,
    });
  }

  @MemoizeOwned()
  get sidecarExpandedProperty() {
    return this.vertex.getJsonPropValuesObs('sidecar-expanded');
  }

  // This is kinda silly to save an expanded and collapsed property, but also necessary because we either have a property or we don't
  // And the only time we know that the user has not explicitly collapsed or expanded the sidecar is if BOTH properties are false
  // otherwise, once they toggle or collapse it, they will be antithetical to each other
  @MemoizeOwned()
  get sidecarCollapsedProperty() {
    return this.vertex.getJsonPropValuesObs('sidecar-collapsed');
  }

  // only true if the user has never specifically toggled sidecar
  @MemoizeOwned()
  get pristine() {
    return Observable.calculated(
      ({ sidecarExpanded, sidecarCollapsed }) => sidecarExpanded === null && sidecarCollapsed === null,
      {
        sidecarExpanded: this.sidecarExpandedProperty,
        sidecarCollapsed: this.sidecarCollapsedProperty,
      },
    );
  }

  @MemoizeOwned()
  get sidecarExpanded(): ObservableReader<boolean> {
    return this.sidecarExpandedProperty.mapObs((x) => !!x);
  }

  async toggleSidecarExpanded(trx: TrxRef | null) {
    const property = this.sidecarExpandedProperty.value;
    subTrxWrapSync(
      trx,
      (trx) => {
        trx.addOp(undefined, (trx) => {
          this.vertex.setFlagProperty('sidecar-expanded', !property, trx);
          this.vertex.setFlagProperty('sidecar-collapsed', !!property, trx);
        });
      },
      'toggleSidecarExpanded',
    );
  }
  setSidecarExpanded(trx: TrxRef | null, expanded: boolean) {
    subTrxWrapSync(
      trx,
      (trx) => {
        trx.addOp(undefined, (trx) => {
          this.vertex.setFlagProperty('sidecar-expanded', expanded, trx);
          this.vertex.setFlagProperty('sidecar-collapsed', !expanded, trx);
        });
      },
      'setSidecarExpanded',
    );
  }

  @MemoizeOwned()
  get sidecarChevron() {
    return SidecarChevron.new({
      parentNode: this,
    });
  }

  @MemoizeOwned()
  get fitContentObs(): ObservableReader<boolean> {
    return this.vertex
      .filterProperties({
        role: ['appearance'],
        userID: this.visibleUserIDsForDescendants,
      })
      .firstObs()
      .mapObs<boolean>((property) => {
        let el = property?.text.mapObs((c) => {
          const type = (JSON.parse(c || '{}') as Behaviors.MemberAppearance).type;
          return type === 'stickynote';
        });
        return el ?? false;
      });
  }

  handleDepart(trx: TrxRef) {
    this.backref.archive(trx);
    return true;
  }

  get editable() {
    return this.backref.editable;
  }

  get selectable(): boolean {
    return true;
  }

  @MemoizeOwned()
  get highlightModeProp() {
    return this.vertex
      .filterProperties({
        role: ['highlight-mode'],
        contentType: 'application/json',
        userID: [globalStore.getCurrentUserID()],
      })
      .filterObs((p) => p.status.value === 'active')
      .firstObs();
  }
  get highlightMode() {
    return this.highlightModeProp.mapObs((p) => !!p);
  }

  toggleHighlightMode(trx: TrxRef) {
    const enabled = !this.highlightMode.value;
    trx.addOp(undefined, (trx) => this.vertex.setFlagProperty('highlight-mode', enabled, trx));
  }
  doLayout(): void {
    this.body.doLayout();
  }
  @MemoizeOwned()
  get viewport() {
    const myTopicSpace = this.findClosest((n) => n instanceof TopicSpace && n);
    return myTopicSpace?.viewportState ?? null;
  }
  handleFocus(focusType: 'leaf' | 'branch', ctx: FocusContext, prevState: false | 'leaf' | 'branch'): void {
    // I wasn't previously focused in any way, and I was triggered by keyboard
    if (ctx.trigger === 'key' && !prevState) {
      this.center();
    }
  }
  center() {
    const ts = this.findClosest((n) => n instanceof TopicSpace && n);
    if (ts) ts.zoomToMember(this);
  }
  upwardNode(): NodeAndContext | null {
    const space = this.findClosest((n) => n instanceof TopicSpace && n);
    if (!space) return super.upwardNode();
    const myBox = this.clientRect;
    if (!myBox) return null;

    const node = nearestXY(
      // The origin for our search is the middle of the upper edge
      { x: (myBox.left + myBox.right) / 2, y: myBox.top },
      space.members.value,

      // our point of comparison for other nodes is the middle of the lower edge
      (b) => b.bottom < myBox.top && { x: (b.left + b.right) / 2, y: b.bottom },
    );
    if (!node) return null;
    return { node };
  }
  downwardNode(): NodeAndContext | null {
    const space = this.findClosest((n) => n instanceof TopicSpace && n);
    if (!space) return super.downwardNode();
    const myBox = this.clientRect;
    if (!myBox) return null;

    const node = nearestXY(
      // The origin for our search is the middle of the lower edge
      { x: (myBox.left + myBox.right) / 2, y: myBox.bottom },
      space.members.value,
      // our point of comparison for other nodes is the middle of the upper edge
      (b) => b.top > myBox.bottom && { x: (b.left + b.right) / 2, y: b.top },
    );
    if (!node) return null;
    return { node };
  }

  leftwardNode(): NodeAndContext | null {
    const space = this.findClosest((n) => n instanceof TopicSpace && n);
    if (!space) return super.leftwardNode();
    const myBox = this.clientRect;
    if (!myBox) return null;

    const node = nearestXY(
      // The origin for our search is the middle of the left edge
      { x: myBox.left, y: (myBox.top + myBox.bottom) / 2 },
      space.members.value,
      // our point of comparison for other nodes is the middle of the right edge
      (b) => b.right < myBox.left && { x: b.right, y: (b.top + b.bottom) / 2 },
    );
    if (!node) return null;
    return { node };
  }
  rightwardNode(): NodeAndContext | null {
    const space = this.findClosest((n) => n instanceof TopicSpace && n);
    if (!space) return super.rightwardNode();
    const myBox = this.clientRect;
    if (!myBox) return null;

    const node = nearestXY(
      // The origin for our search is the middle of the right edge
      { x: myBox.right, y: (myBox.top + myBox.bottom) / 2 },
      space.members.value,
      // our point of comparison for other nodes is the middle of the left edge
      (b) => b.left > myBox.right && { x: b.left, y: (b.top + b.bottom) / 2 },
    );
    if (!node) return null;
    return { node };
  }

  get cursor() {
    return this.dragging.value === null ? 'grab' : 'grabbing';
  }

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

  get cardType(): CardType {
    // return the correct member type for the value of the appearance property
    const appearance = this.appearance.value;
    if (appearance?.type === 'browser') return 'webpage';
    if (appearance?.type === 'stickynote') return 'sticky';
    // if (appearance?.type === 'clean') return 'clean';
    // if (appearance?.type === 'file') return 'file';
    return 'outline';
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

export class SidecarExpand extends Behavior {
  getActions(originNode: Node): ActionGroup[] {
    const card = originNode.closestInstance(Member);
    if (!card) return [];
    const noteOpen = card.sidecarExpanded.value;
    const label = noteOpen ? 'Close Note' : 'Open Note';
    return [
      {
        label: 'Card',
        actions: [
          {
            label,
            apply: () => {
              void card.toggleSidecarExpanded(null);
            },
          },
        ],
      },
    ];
  }
}

function nearestXY(
  origin: Position,
  nodes: Node[],
  getPoint: (node: BoundingBox) => Position | undefined | false,
): Node | null {
  let minDist = Infinity;
  let winner: Node | null = null;

  for (const node of nodes) {
    let b = node.clientRect;
    if (!b) continue;

    const other = getPoint(b);
    if (!other) continue;

    // Display thine golden thigh
    const dist = Math.sqrt((origin.x - other.x) ** 2 + (origin.y - other.y) ** 2);
    if (dist < minDist) {
      minDist = dist;
      winner = node;
    }
  }

  return winner;
}
