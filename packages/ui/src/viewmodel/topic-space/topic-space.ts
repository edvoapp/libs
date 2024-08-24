import { arrayEquals, globalStore, Model, subTrxWrap, TrxRef, trxWrap } from '@edvoapp/common';
import {
  debug,
  getWasmBindings,
  Guarded,
  MemoizeOwned,
  Observable,
  ObservableList,
  ObservableReader,
  OwnedProperty,
  tryJsonParse,
  WeakProperty,
} from '@edvoapp/util';
import {
  CloneContext,
  DEFAULT_CARD_DIMS,
  DEFAULT_PDF_DIMS,
  DEFAULT_PORTAL_DIMS,
  DEFAULT_WEBCARD_DIMS,
  uiParams,
} from '../..';
import * as Behaviors from '../../behaviors';
import {
  BoundingBox,
  BoxArgs,
  ConditionalNode,
  globalContext,
  ListNode,
  Node,
  Position,
  PropertyNode,
  VertexNode,
  VertexNodeCA,
} from '../base';
import { ContentCard } from './content-card';
import { Member } from './member';
import { ClearSelection } from '../../behaviors/clear-selection';
import { Name } from '../name';
import { ShareTray } from './share-tray';
import { TSPage } from '../page';
import { OutlineItem } from '../outline/outline-item';
import { UpdatablesSet } from '../base/updatables';
import { DockItemBody } from '../dock/dock-item-body';
import { DockTab } from '../dock/dock-tab';
import { AppDesktop } from '../app-desktop';
import { InfinityMirror } from './infinity-mirror';
import { TopicItem, TopicListItem } from './topic-item';
import * as Bindings from '@edvoapp/wasm-bindings';
import equals from 'fast-deep-equal';
import { Tab } from '../extension';
import { applyTopicSpaceTemplate } from '../template';
import { MemberBody } from './member-body';
import { UserPresence } from '../user-presence';
import { Button } from '../button';
import { TabsPanel } from '../toolbar';
import { ZoomState } from '../';

export interface ViewportData extends Model.BaseMeta {
  planeX?: number;
  planeY?: number;
  positionX?: number;
  positionY?: number;
  scale?: number;
}

export type InputDeviceType = {
  type: 'mouse' | 'touchpad' | 'auto';
};

type PanDirection = {
  natural: boolean;
};

type ZoomDirection = {
  swipeUpToZoomIn: boolean;
};

interface ViewportStateArgs extends BoxArgs {
  planeScale: number;
}

// Describes bounding box of a viewport in plane coordinates and the scale of the plane relative to the screen.
export class ViewportState extends BoundingBox {
  planeScale: number;
  constructor({ planeScale, ...rest }: ViewportStateArgs) {
    super(rest);
    this.planeScale = planeScale;
  }

  exactlyEquals(other: ViewportState) {
    return (
      this.x === other.x &&
      this.y === other.y &&
      this.width === other.width &&
      this.height === other.height &&
      this.planeScale === other.planeScale
    );
  }

  debug() {
    return `${this.x.toFixed(0)}, ${this.y.toFixed(0)} ${this.width.toFixed(0)}x${this.height.toFixed(
      0,
    )} @ ${this.planeScale.toFixed(4)}`;
  }
}

type Parent = TSPage | ConditionalNode<InfinityMirror | TopicSpace, any, MemberBody> | null; // null is for template

interface CA extends VertexNodeCA<Parent> {
  defaultViewport?: ViewportState;
}

export class TopicSpace extends VertexNode<Parent> {
  readonly label = 'topic-space';
  allowHover = true;
  @OwnedProperty
  readonly focusCoordinates = new Observable<Position | null>(null);

  @OwnedProperty
  rustGraph: Bindings.VM_Graph;
  defaultViewport?: ViewportState;

  get focusable() {
    return true;
  }

  constructor({ defaultViewport, ...args }: CA) {
    super(args);
    // TODO CRITICAL: Audit member removing to make sure it's working correctly
    this.rustGraph = getWasmBindings().VM_Graph.new();
    this.defaultViewport = defaultViewport;
  }

  static new(args: CA) {
    const me = new TopicSpace(args);
    me.init();
    return me;
  }

  init() {
    super.init();
    void this.initAutoPositioning();

    void this.initSpaceChats();
  }

  @Guarded
  async initSpaceChats() {
    const rootNode = await globalContext().awaitRootNode;

    if (rootNode instanceof AppDesktop) {
      // Not sure why globalContext().awaitRootNode is returning a dead object
      if (!rootNode.alive) return;

      const chatPanel = rootNode.chatPanel;

      chatPanel.registerSpace(this);
      this.onCleanup(() => {
        chatPanel.deregisterSpace(this);
      });
    }
  }

  get childProps(): (keyof this & string)[] {
    return [
      'urlPart',
      'contentCard',
      'members',
      'shareTray',
      'userPresence',
      'organizeTabsButton',
      'uploadFilesButton',
      'searchButton',
      'zoomState',
    ];
  }

  isPortal(): boolean {
    return this.parentSpace !== null;
  }

  @Guarded
  private async initAutoPositioning() {
    await this.members.load();
    const rustFdgInProgressObs = this.rustFdgInProgress;

    const savePosition = () => {
      if (!rustFdgInProgressObs.value) {
        trxWrap(async (trx) => {
          for (const member of this.members.value) {
            const { autoposition } = member.meta.value;
            // It's conditional because if `autoposition` is `false`,
            // then it indicates that the card is already fixed,
            // meaning that its position has already been updated.
            if (autoposition) {
              await member.savePosition(trx);
            }
          }
        });
      }
    };

    this.onCleanup(
      this.members.subscribe(() => {
        this.rustGraph?.force_direct_debounced(uiParams.animateForceDirection);
      }),
    );

    // TODO(SHOHEI): come back to this later; code review with Daniel
    // Save cards' final position once force direction is done.
    this.managedSubscription(rustFdgInProgressObs, savePosition);
  }

  @MemoizeOwned()
  get rustFdgInProgress(): ObservableReader<boolean> {
    if (!this.rustGraph) throw new Error('rust graph must exist');

    const rustFdgInProgressObs = this.rustGraph.fdg_in_progress;
    const outObs = new Observable(rustFdgInProgressObs.value);

    outObs.onCleanup(
      // @ts-ignore
      rustFdgInProgressObs.subscribe(() => outObs.set(rustFdgInProgressObs.value)),
    );

    return outObs;
  }

  @MemoizeOwned()
  get viewportProp() {
    return this.vertex
      .filterProperties({
        role: ['viewport-state'],
        contentType: 'application/json',
        userID: [globalStore.getCurrentUserID()],
      })
      .chooseObs((props) => {
        if (props.length === 0) return undefined;

        // looks for the most recent updated property
        let selectedProp = props[0];
        let maxTime = selectedProp.updatedAt;
        for (let i = 1; i < props.length; i++) {
          let prop = props[i];
          let time = prop.updatedAt;
          if (globalStore.compareTimestamps(time, maxTime) == 1) {
            selectedProp = prop;
            maxTime = time;
          }
        }
        return selectedProp;
      });
  }

  setViewportProp(newState: ViewportData, trx: TrxRef) {
    const content = JSON.stringify(newState);
    const property = this.viewportProp as Observable<Model.Property | null | undefined>;
    if (property.value) {
      property.value.setContent(trx, content);
    } else {
      const vertex = this.vertex;
      property.set(
        vertex.createProperty({
          trx,
          initialString: content,
          role: ['viewport-state'],
          contentType: 'application/json',
        }),
      );
    }
  }

  @Guarded
  async saveDefaultView() {
    const { x, y, planeScale } = this.viewportState.value;
    await this.vertex.setJsonPropValues(
      'default-viewport-state',
      {
        planeX: x,
        planeY: y,
        positionX: -x * planeScale,
        positionY: -y * planeScale,
        scale: planeScale,
      },
      null,
    );
  }

  @MemoizeOwned()
  get defaultViewportProp() {
    return this.vertex
      .filterProperties({
        role: ['default-viewport-state'],
        contentType: 'application/json',
        userID: this.vertex.userID.mapObs((u) => (u ? [u] : undefined)),
      })
      .firstObs();
  }

  @MemoizeOwned()
  get visible(): ObservableReader<boolean> {
    return super.visible.mapObs<boolean>((v) => v && this.viewportState.mapObs((s) => !!s));
  }
  @MemoizeOwned()
  get userPresence(): ConditionalNode<UserPresence, string | null, TopicSpace> {
    const precursor = Observable.calculated(
      ({ currentUser, hasProperties }) => {
        if (!hasProperties || !currentUser) return null;
        return currentUser.id;
      },
      {
        currentUser: this.context.currentUser,
        hasProperties: this.hasProperties,
      },
    );
    // Bugfix: User change when `this` is a dead node
    const vertexID = this.vertex.id;
    return ConditionalNode.new<UserPresence, string | null, TopicSpace>({
      parentNode: this,
      precursor,
      factory: (userID, parentNode) =>
        userID === null
          ? null
          : UserPresence.new({
              parentNode,
              vertexID,
              userID,
              context: globalContext(),
            }),
    });
  }

  // TODO: This is a weak permissions check, ONLY being used for the cursor/avatars being displayed
  @MemoizeOwned()
  get hasProperties() {
    return this.vertex.filterProperties({ role: ['name', 'body', 'appearance'] }).firstObs();
  }

  get cursor(): string {
    const rootNode = this.findClosest((n) => n instanceof AppDesktop && n);
    if (rootNode?.quickAdding.value) return 'crosshair';
    if (this.panning.value) return 'grabbing';
    if (this.context.eventNav.downKeys.has('space')) return 'grab';
    return 'default';
  }

  getLocalBehaviors() {
    return [new ClearSelection(), new Behaviors.UrlPaste(), new Behaviors.FileDrop()];
  }

  getHeritableBehaviors() {
    return [new Behaviors.UserPresenceBehavior(), new Behaviors.NewBrowser(), new Behaviors.FileDrop()];
  }

  // @MemoizeOwned()
  get parentSpace(): TopicSpace | null {
    const ps = this.parentNode?.findClosest((n) => n instanceof TopicSpace && n);
    return ps ?? null;
  }

  @MemoizeOwned()
  get handleSingleClick(): ObservableReader<boolean> {
    return this.parentSpace?.handleSingleClick ?? new Observable(false);
  }
  setHandleSingleClick(value: boolean) {
    if (this.parentSpace) {
      this.parentSpace.setHandleSingleClick(value);
    } else {
      (this.handleSingleClick as Observable<boolean>).set(value);
    }
  }

  // TODO: could probably consolidate template open with nextMember type
  @MemoizeOwned()
  get templateOpen(): ObservableReader<boolean> {
    return this.parentSpace?.templateOpen ?? new Observable(false);
  }
  setTemplateOpen(value: boolean) {
    if (this.parentSpace) {
      this.parentSpace.setTemplateOpen(value);
    } else {
      (this.templateOpen as Observable<boolean>).set(value);
    }
  }

  @MemoizeOwned()
  get shareTray() {
    return ShareTray.new({ parentNode: this, vertex: this.vertex });
  }

  @MemoizeOwned()
  get members(): ListNode<TopicSpace, Member, Model.Backref> {
    const itemRoles = ['member-of'];

    // LEFT OFF HERE. Action items:
    // [X] Implement PrivUpdateAccumulator object
    // [X] Replace reevaluatePrivs and recursivelyAccumulatePrivUpdates with individual node recognizance
    // [X] Convert updatables to return null | ObservableList<_>
    //     [X] Enforce that updatables ObservableList may not contain any items whose privileges aren't loaded
    //     [X] trigger updatables load on VM.Node load
    //     [X] subscribe to updatables from VM.Node constructor
    // [ ] Update VM node creation to include an updatecontext so we can attach to the transaction that created a node
    // [.] Audit accumulatePrivUpdates calls
    // [~] Audit loading
    // [X] Implement lazyloading for culled members
    // [~] Verify that foreign share id filtering is sufficient to avoid
    //     different resident Nodes with the same updatables overwriting each other.
    //     ideally there'd be some proxy for the updatable that actually does its own updating or something like this??
    // [ ] Change member to overflow: false, or otherwise prevent getNodeAtScreenpoint from loading member children
    // [X] VM tree crawl on instruction change to load culled items
    // [X] children unloading
    // [ ] Model freeing
    // [ ] Quiesce storm of empty transactions when members come into view. Some kind of priv update noop?

    let precursor: ObservableList<Model.Backref> = this.vertex
      .filterBackrefs({
        role: itemRoles,
        userID: this.parentNode?.visibleUserIDsForDescendants,
      })
      .sortObs(
        (a, b) =>
          (a.seq.value ?? Number.MAX_SAFE_INTEGER) - (b.seq.value ?? Number.MAX_SAFE_INTEGER) ||
          globalStore.compareTimestamps(a.createdAt, b.createdAt),
      );

    return ListNode.new<TopicSpace, Member, Model.Backref>({
      label: 'members',
      parentNode: this,
      precursor,
      factory: (backref, parentNode, index) => {
        return Member.new({
          parentNode,
          index,
          vertex: backref.target,
          backref,
          context: this.context,
          overflow: true,
        });
      },
    });
  }

  // TODO: determine if we still need this

  @MemoizeOwned()
  get plainBody() {
    return ConditionalNode.new<PropertyNode, Model.Property | null | undefined>({
      parentNode: this,
      label: 'plainBody',
      precursor: this.vertex
        .filterProperties({
          role: ['body'],
          contentType: 'text/plain',
          userID: this.parentNode?.visibleUserIDsForDescendants,
        })
        .firstObs(),
      factory: (property, parentNode) => property && PropertyNode.new({ property, parentNode }),
    });
  }
  @MemoizeOwned()
  get urlPart() {
    return ConditionalNode.new<PropertyNode, Model.Property | null | undefined>({
      parentNode: this,
      label: 'urlPart',
      precursor: this.vertex
        .filterProperties({
          role: ['body'],
          contentType: 'text/x-uri',
          userID: this.parentNode?.visibleUserIDsForDescendants,
        })
        .firstObs(),
      factory: (property, parentNode) => property && PropertyNode.new({ property, parentNode }),
    });
  }
  @MemoizeOwned()
  get contentCard() {
    return ConditionalNode.new<ContentCard, Model.Property | null | undefined, TopicSpace>({
      parentNode: this,
      label: 'contentCard',
      precursor: this.vertex
        .filterProperties({
          role: ['urlReference', 'body'],
          userID: this.parentNode?.visibleUserIDsForDescendants,
        })
        .firstObs(),
      factory: (property, parentNode) =>
        property &&
        ContentCard.new({
          property,
          vertex: this.vertex,
          parentNode,
          context: parentNode.context,
        }),
    });
  }

  @MemoizeOwned()
  get topicSearchCard() {
    const tsPage = this.findClosest((n) => n instanceof TSPage && n)!;
    return tsPage.topicSearchCard;
  }

  @MemoizeOwned()
  get updatables(): UpdatablesSet {
    return new UpdatablesSet([this.defaultViewportProp]);
  }
  zoomToMember(node: Member) {
    const isMyChild = node.findClosest((n) => n === this);
    if (!isMyChild) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    const unsub = node.planeCoords.subscribe(({ x: x_coordinate, y: y_coordinate }) => {
      if (interval) clearInterval(interval);
      const clientRect = node.clientRectObs.value;
      const vps = this.viewportState.value;
      const tsClientRect = this.clientRectObs.value;
      const localScale = this.localScale;
      const { width: tsWidth, height: tsHeight } = tsClientRect;
      const { width, height, innerScale } = clientRect;

      const { x: initialVpX, y: initialVpY, width: initialVpWidth, height: initialVpHeight } = vps;

      // logical coords
      const { width: metaWidth, height: metaHeight } = node.meta.value;

      const maxTargetWidth = tsWidth - 20;
      const maxTargetHeight = tsHeight - 80;
      const targetScaleDiff = Math.min(maxTargetWidth / width, maxTargetHeight / height);
      const targetScale = localScale * targetScaleDiff;

      // logical coords
      const vpWidth = tsWidth / targetScale;
      const vpHeight = tsHeight / targetScale;

      const x = x_coordinate - (vpWidth - (metaWidth ?? 0)) / 2;
      const y = y_coordinate - (vpHeight - (metaHeight ?? 0)) / 2;

      let counter = 1;

      const CYCLES = 50;

      const deltaX = (x - initialVpX) / CYCLES;
      const deltaY = (y - initialVpY) / CYCLES;
      const deltaWidth = (vpWidth - initialVpWidth) / CYCLES;
      const deltaHeight = (vpHeight - initialVpHeight) / CYCLES;
      const deltaScale = (targetScale - localScale) / CYCLES;

      // animate!
      interval = setInterval(() => {
        if (counter === CYCLES) {
          this.viewportState.set(
            new ViewportState({
              ...vps,
              x,
              y,
              width: vpWidth,
              height: vpHeight,
              planeScale: targetScale,
            }),
          );
          return interval ? clearInterval(interval) : void 0;
        }
        this.viewportState.set(
          new ViewportState({
            x: initialVpX + deltaX * counter,
            y: initialVpY + deltaY * counter,
            width: initialVpWidth + deltaWidth * counter,
            height: initialVpHeight + deltaHeight * counter,
            planeScale: localScale + deltaScale * counter,
          }),
        );
        counter++;
      }, 10);
    });

    // FIXME: this is a bit hokey, but this gives us time to ensure that autopositioning is done.
    setTimeout(() => unsub(), 1_500);
  }

  /**
   * The scaling factor of the topic space component (but crucially, NOT the topic space plane) relative to the browser native coordinate system
   */
  get baseScale(): number {
    return this.parentSpace?.planeScale ?? 1;
  }
  /**
   * The scaling factor of this topic space plane relative to its immediate parent
   */
  get localScale() {
    return this.viewportState.value?.planeScale ?? 1;
  }
  /**
   *  The scaling factor of the topic space plane relative to the browser native coordinate system
   *  */
  get planeScale(): number {
    return this.localScale * this.baseScale;
  }

  /**
   *  The scaling factor of the topic space plane relative to the browser native coordinate system
   *  */
  @MemoizeOwned()
  get planeScaleObs(): ObservableReader<number> {
    const parentSpace = this.parentSpace;

    if (parentSpace) {
      return Observable.calculated(({ localScale, parentScale }) => localScale * parentScale, {
        localScale: this.localPlaneScaleObs,
        parentScale: parentSpace.planeScaleObs,
      });
    } else {
      return this.localPlaneScaleObs;
    }
  }

  // Applies a template to space
  async applyTemplate(templateVertexID: string) {
    await applyTopicSpaceTemplate(this.vertex, templateVertexID, this.context);
  }

  @MemoizeOwned()
  get clientRectObs(): ObservableReader<BoundingBox> {
    const p = this.parentNode;
    if (p instanceof TSPage) return p.clientRectObs;
    return p?.parentNode?.clientRectObs ?? new Observable(new BoundingBox({ x: 0, y: 0, width: 0, height: 0 }));
  }
  /**
   * The bounding box outside of which the component is forbidden to render
   * expressed in client screen coordinates
   */
  @MemoizeOwned()
  get clipBox(): ObservableReader<BoundingBox | null> | null {
    const parentPortal = this.parentNode?.closestInstance(MemberBody);
    if (!parentPortal) return null;
    // Only use clipping for portals

    return Observable.calculated(
      ({ parentRect, parentClipBox }) => (parentClipBox ? parentRect?.intersect(parentClipBox) || null : parentRect),
      {
        parentRect: parentPortal.clientRectObs,
        parentClipBox: this.parentNode?.clipBox ?? undefined,
      },
    );
  }

  /**
   *  The scaling factor of the topic space plane relative to the browser native coordinate system
   *  */
  get localPlaneScaleObs(): ObservableReader<number> {
    return this.viewportState.mapObs((v) => v?.planeScale ?? 1);
  }

  /**
   * The positioning and scaling information the topic space plane relative to the browser native coordinate system
   */
  // @MemoizeOwned()
  // get mergedPlaneState(): Observable<PlaneState> {
  //   const obs = new Observable<PlaneState | undefined>(undefined);

  //   // Temporarily assuming that only members can provide offsetting coordinate values
  //   // But I think the right way to do this in the long run is to treat panning as a negative margin/padding for members and topic spaces respectively.
  //   // And implement this as a first class primitive for all VM Nodes.

  //   const myMember = this.findClosest((n) => n instanceof Member && n);
  //   const superTopicSpace = this.parentNode?.findClosest(
  //     (n) => n instanceof TopicSpace && n,
  //   );

  //   const calc = () => {
  //     const superState = superTopicSpace?.mergedPlaneState.value ?? {
  //       scale: 1,
  //       top: 0,
  //       left: 0,
  //     };

  //     // TODO: account for offset between outside of member and the portal edge
  //     const myCoordsInParentPlane = myMember?.planeCoords.value ?? {
  //       left: 0,
  //       top: 0,
  //     };

  //     const scale =
  //       superState.scale * (superTopicSpace?.viewport.scale.value ?? 1);
  //     const left = superState.left + myCoordsInParentPlane.left; // scaled by what?
  //     const top = superState.left + myCoordsInParentPlane.left;

  //     obs.set({
  //       scale,
  //       left,
  //       top,
  //     });
  //   };

  //   obs.managedSubscription(this.viewport.scale, calc)

  //   if (myMember) {
  //     obs.managedSubscription(myMember.planeCoords, calc)
  //   }

  //   if (superTopicSpace) {
  //     obs.managedSubscription(superTopicSpace.mergedPlaneState, calc)
  //   }

  //   if (myMember) {
  //     obs.managedSubscription(myMember.planeCoords, calc)
  //   }
  //   calc();

  //   return obs as Observable<PlaneState>;
  // }

  /**
   * overwriting VertexNode.shallowClone because we want to traverse the tree and also clone the default viewport prop, which is not represented as a VM node and thus would not otherwise get cloned.
   */
  @Guarded
  async shallowClone(targetParentVertex: Model.Vertex, cloneContext: CloneContext): Promise<Model.Vertex | null> {
    // clone my default viewport, but do NOT clone the non-default viewport
    const defaultViewportProp = await this.defaultViewportProp.get();
    if (defaultViewportProp) cloneContext.cloneProperty(targetParentVertex, defaultViewportProp);
    return super.shallowClone(targetParentVertex, cloneContext);
  }

  // TODO: is this redundant with this.droppable?
  isDropEligible(dragItems: Behaviors.DragItem[]) {
    return !(
      dragItems.length === 0 ||
      dragItems.find(
        (i) =>
          !(
            i.node instanceof Member ||
            i.node instanceof Tab ||
            i.node instanceof ContentCard ||
            i.node instanceof DockItemBody ||
            i.node instanceof DockTab ||
            i.node instanceof TopicListItem ||
            i.node instanceof TopicItem ||
            i.node instanceof OutlineItem
          ),
      )
    );
  }

  clientCoordsToSpaceCoords(
    clientCoords: Position,
    vps?: ViewportState | null,
    scaleOverride?: number | null,
  ): Position {
    const scale = scaleOverride ?? this.planeScale;
    const { x: clientMouseX, y: clientMouseY } = clientCoords;
    const tsRect = this.clientRectObs.value;
    const { x: clientTopicSpaceX, y: clientTopicSpaceY } = tsRect;
    const viewportClientX = (clientMouseX - clientTopicSpaceX) / scale;
    const viewportClientY = (clientMouseY - clientTopicSpaceY) / scale;

    const viewportState = vps ?? this.viewportState.value;
    const { x: viewportLogicalX, y: viewportLogicalY } = viewportState;

    const logicalMouseCoordX = viewportLogicalX + viewportClientX;
    const logicalMouseCoordY = viewportLogicalY + viewportClientY;

    return { x: logicalMouseCoordX, y: logicalMouseCoordY };
  }

  spaceCoordsToClientCoords(spaceCoords: Position): Position {
    const superMemberBody = this.parentNode?.closestInstance(MemberBody);
    const superClientCoords = superMemberBody?.clientRectObs;

    const viewportState = this.viewportState.value;
    // const scale = this.planeScale;
    const scale = this.localScale;
    const { x: viewportX = 0, y: viewportY = 0 } = viewportState ?? {};
    const { x: spaceX, y: spaceY } = spaceCoords;
    const spaceClientRect = this.clientRectObs.value;

    const supX = superClientCoords?.value.x ?? 0;
    const supY = superClientCoords?.value.y ?? 0;

    const { x: clientTopicSpaceX, y: clientTopicSpaceY } = spaceClientRect;

    // how far from the edges in SCREEN coords
    const offsetX = (spaceX - viewportX) * scale;
    const offsetY = (spaceY - viewportY) * scale;
    const x = supX + offsetX + clientTopicSpaceX;
    const y = supY + offsetY + clientTopicSpaceY;

    return { x, y };
  }

  scaleClientCoords({ x: clientMouseX, y: clientMouseY }: Position): Position {
    const scale = this.planeScale;
    const tsRect = this.clientRectObs.value;
    const { x: clientTopicSpaceX, y: clientTopicSpaceY } = tsRect;
    const x = (clientMouseX - clientTopicSpaceX) / scale;
    const y = (clientMouseY - clientTopicSpaceY) / scale;
    return { x, y };
  }

  // TODO: Consider moving drop behavior into... a Behavior and have DragDrop scan for that?

  async handleDrop(
    dragItems: Behaviors.DragItem[],
    event: MouseEvent,
    trx: TrxRef,
    isTransclusion: boolean,
  ): Promise<Node[]> {
    // for now, not handling non-homogenous collections
    if (!this.isDropEligible(dragItems)) return [];
    // Transformations:
    // 1. Transform clientX/Y into eventWithinHaloX/Y ( both scale = 1 )
    // 2. Transform that into logical coordinate system

    // Variables including the words "client" or "screen" mean they are 1-1 scale with screen pixels (ignoring Mac retina or whatever)
    // Variables including the words "logical" mean they are in the logical coordinate system of the topic space plane

    const { clientX: clientMouseX, clientY: clientMouseY } = event;
    const { x: logicalMouseCoordX, y: logicalMouseCoordY } = this.clientCoordsToSpaceCoords({
      x: clientMouseX,
      y: clientMouseY,
    });

    const items: Node[] = [];

    let newOutlineCard: Model.Vertex | undefined = undefined;

    // we do a forEach instead of a Promise.all because we need to iterate through the dragged outline items
    // synchronously so they can all be attached to the same card
    // but this is kind of messy
    for (const { node, logicalOffsets: virtualOffsets } of dragItems) {
      const logicalOffsetX = virtualOffsets.x;
      const logicalOffsetY = virtualOffsets.y;

      const x_coordinate = logicalMouseCoordX + logicalOffsetX;
      const y_coordinate = logicalMouseCoordY + logicalOffsetY;

      let dropped: Node | null = null;

      const commandkey = equals([...this.context.eventNav.downKeys].sort(), ['meta']);
      // subTrxWrap just queues, so all this really does is just returns the value of the inner method
      dropped = await subTrxWrap(trx, async (trx) => {
        if (node instanceof Tab) {
          await this.handleSaveTab(
            trx,
            node,
            // don't do any offset calcs for tabs
            x_coordinate,
            y_coordinate,
            isTransclusion,
            commandkey,
          );
        } else if (
          node instanceof Member ||
          node instanceof ContentCard ||
          node instanceof DockItemBody ||
          node instanceof TopicListItem ||
          node instanceof TopicItem ||
          node instanceof DockTab
        ) {
          return await this.handleSaveMember(trx, node, x_coordinate, y_coordinate, isTransclusion, commandkey);
        }
        if (node instanceof OutlineItem) {
          const { node: n = null, newCard: nc } = await this.handleSaveNewCard(
            trx,
            node,
            x_coordinate,
            y_coordinate,
            isTransclusion,
            newOutlineCard,
          );
          newOutlineCard = nc;
          return n;
        }
        return null;
      });

      if (dropped) items.push(dropped);
    }

    return items;
  }

  async handleSaveNewCard(
    trx: TrxRef,
    node: OutlineItem,
    x_coordinate: number,
    y_coordinate: number,
    isTransclusion: boolean,
    newCard?: Model.Vertex,
    autoposition = false,
  ): Promise<{ node?: Node; newCard?: Model.Vertex }> {
    const oldParent = node.parentNode;

    if (!oldParent) {
      console.warn('parent failure', node);
      return {};
    }

    if (!newCard) {
      newCard = Model.Vertex.create({ trx });

      // TODO: verify if this is necessary
      await newCard.setJsonPropValues<Behaviors.MemberAppearance>('appearance', { type: 'normal' }, trx);

      newCard.createEdge({
        trx,
        role: ['member-of', 'tag'],
        target: this.vertex,
        meta: {
          x_coordinate,
          y_coordinate,
          autoposition,
        },
      });
    }

    node.vertex.createEdge({
      trx,
      target: newCard,
      seq: node.seq,
      role: ['category-item'],
      meta: {},
    });

    return { node, newCard };
  }

  async handleSaveTab(
    trx: TrxRef,
    node: Tab,
    x_coordinate: number,
    y_coordinate: number,
    isTransclustion: boolean,
    autoposition: boolean,
  ) {
    const role = ['member-of', 'tag'];
    const vertex = await node.upsert(trx);

    if (!vertex) return null;

    vertex.createEdge({
      trx,
      role,
      target: this.vertex,
      seq: 0,
      meta: {
        x_coordinate,
        y_coordinate,
        autoposition,
        ...DEFAULT_WEBCARD_DIMS,
      },
    });

    return node;
  }

  async handleSaveMember(
    trx: TrxRef,
    node: Member | ContentCard | DockItemBody | TopicListItem | DockTab | TopicItem,
    x_coordinate: number,
    y_coordinate: number,
    isTransclusion: boolean,
    autoposition: boolean,
  ): Promise<Node | null> {
    const oldParent = node.parentNode?.parentNode;

    if (!oldParent) {
      console.warn('parent failure', node);
      return null;
    }
    const backref =
      node instanceof Member || node instanceof DockItemBody || node instanceof TopicListItem || node instanceof DockTab
        ? node.backref
        : null;
    const vertex = node.vertex;
    const metaContainer = backref || vertex;

    const role = ['member-of'];
    // TODO: this is kinda goofy
    if (await node.name.get()) {
      role.push('tag');
    }

    // TODO: audit this logic, I don't really know what it's meant to do but it will break RT-1827
    // More specifically, if the computed role (on line 957) and the backref's current role are different
    // it will archive the backref and create a new one on drag/drop, which seems kinda strange to me
    // if there is no backref, then we dont want to create an edge
    const sameRole = backref?.role ? arrayEquals(backref.role || [], role) : true;

    if (
      (node instanceof Member ||
        node instanceof DockItemBody ||
        node instanceof TopicListItem ||
        node instanceof TopicItem ||
        node instanceof DockTab) &&
      (isTransclusion || !oldParent.equals(this) || !sameRole)
    ) {
      if (backref && !backref.editable.value) return null;
      let defaultDims = DEFAULT_CARD_DIMS;
      const vertex = node.vertex;
      const appearanceObs = vertex
        .filterProperties({
          role: ['appearance'],
          contentType: 'application/json',
        })
        .firstObs();
      const appearance = appearanceObs.value?.text.mapObs((c) => tryJsonParse<Behaviors.MemberAppearance>(c)).value
        .type;

      const properties = vertex?.properties;

      const pdfPart = properties?.find((part) => part.contentType === 'application/pdf');

      if (appearance === 'browser') {
        defaultDims = DEFAULT_WEBCARD_DIMS;
      } else if (appearance === 'subspace') {
        defaultDims = DEFAULT_PORTAL_DIMS;
      } else if (pdfPart) {
        defaultDims = DEFAULT_PDF_DIMS;
      }
      if (backref && !backref.editable.value) return null;
      const backrefMeta = await backref?.meta.get();
      const meta = backrefMeta?.width || backrefMeta?.height ? backrefMeta : { ...defaultDims };

      // sever old relationships, create new ones!
      node.vertex.createEdge({
        trx,
        role,
        target: this.vertex,
        seq: 0,
        meta: {
          ...meta,
          x_coordinate,
          y_coordinate,
          autoposition,
        },
      });
      // Analytics.track('topic_space_member_remove', {});
      return node;
    } else {
      await metaContainer.setMetaMerge({
        trx,
        meta: {
          x_coordinate,
          y_coordinate,
          autoposition,
        },
      });
      if (node instanceof Member) {
        const { height, width } = node.meta.value;
        node.rustNode?.set_meta(x_coordinate, y_coordinate, height ?? undefined, width ?? undefined, autoposition);
        if (node.rustNode?.num_of_relations() !== 0 || autoposition) {
          node.myTopicSpace?.rustGraph?.force_direct_debounced(uiParams.animateForceDirection);
        }
      }
      return null;
    }
  }

  droppable(items: Node[]): boolean {
    return items.every(
      (x) =>
        x instanceof Member ||
        x instanceof Tab ||
        x instanceof DockItemBody ||
        x instanceof TopicListItem ||
        x instanceof TopicItem ||
        x instanceof DockTab ||
        x instanceof ContentCard ||
        x instanceof OutlineItem,
    );
  }

  @WeakProperty
  get parentTopicSpace() {
    return this.parentNode?.findClosest((n) => n instanceof TopicSpace);
  }

  _isRootTopicSpace: boolean | undefined;
  get isRootTopicSpace() {
    this._isRootTopicSpace ??= !this.parentNode?.closest((n) => n instanceof TopicSpace);
    return this._isRootTopicSpace;
  }

  @MemoizeOwned()
  get panDirection(): ObservableReader<PanDirection | null | undefined> {
    return this.context.authService.currentUserVertexObs.mapObs<PanDirection | null | undefined>((user) =>
      user?.getJsonPropValuesObs<PanDirection>('pan-direction'),
    );
  }

  @MemoizeOwned()
  get zoomDirection(): ObservableReader<ZoomDirection | null | undefined> {
    return this.context.authService.currentUserVertexObs.mapObs<ZoomDirection | null | undefined>((user) =>
      user?.getJsonPropValuesObs<ZoomDirection>('zoom-direction'),
    );
  }

  async toggleZoomDirection() {
    const zoomDirection = await this.zoomDirection.get();
    const swipeUpToZoomIn = !zoomDirection?.swipeUpToZoomIn;
    // set to natural                     : true => false
    // not set to natural                 : false => true
    // not set at all: defaults to natural: true => false
    this.context.authService.currentUserVertexObs.value?.setJsonPropValues('zoom-direction', { swipeUpToZoomIn }, null);
  }
  async setZoomDirection(swipeUpToZoomIn: boolean) {
    this.context.authService.currentUserVertexObs.value?.setJsonPropValues('zoom-direction', { swipeUpToZoomIn }, null);
  }

  @MemoizeOwned()
  get inputDevice(): ObservableReader<InputDeviceType | null | undefined> {
    return this.context.authService.currentUserVertexObs.mapObs<InputDeviceType | null | undefined>((user) =>
      user?.getJsonPropValuesObs<InputDeviceType>('input-device'),
    );
  }

  async toggleInputDevice() {
    const inputDevice = await this.inputDevice.get();
    const currentType = inputDevice?.type;
    const value = { type: 'mouse' };
    switch (currentType) {
      case 'auto':
        value.type = 'mouse';
        break;
      case 'mouse':
        value.type = 'touchpad';
        break;
      case 'touchpad':
        value.type = 'auto';
        break;
      default:
        value.type = 'mouse';
        break;
    }
    this.context.authService.currentUserVertexObs.value?.setJsonPropValues('input-device', value, null);
  }
  async setInputDevice(value: InputDeviceType) {
    this.context.authService.currentUserVertexObs.value?.setJsonPropValues('input-device', value, null);
  }

  @MemoizeOwned()
  get dbViewportState(): ObservableReader<ViewportState | null> {
    const prop = this.viewportProp;
    const propContent = prop.mapObs<string | null | undefined>((p) => (p ? p.text : p));
    const defaultProp = this.defaultViewportProp;
    const defaultPropContent = defaultProp.mapObs<string | null | undefined>((p) => (p ? p.text : p));
    const clientRect = this.clientRectObs;
    const superSpace = this.parentSpace;
    const parentPlaneScale = superSpace?.planeScaleObs;
    return Observable.calculated(
      ({ propContent, defaultPropContent, clientRect, parentPlaneScale }) => {
        const vpsContent = propContent || defaultPropContent;
        if (!vpsContent) return null;

        let { planeX, planeY, positionX = 0, positionY = 0, scale = 0.5 } = tryJsonParse<ViewportData>(vpsContent);

        // planeX/Y represent the LOGICAL (plane) coordinate of the top-left corner of the viewport, so should NOT be scaled
        const x = planeX ?? -positionX;
        const y = planeY ?? -positionY;
        const innerScale = scale * parentPlaneScale;

        // x, y, height and width are all in the Plane coordinate system
        // innerHeight/innerWidth are all in the screen coordinate system
        const vps = new ViewportState({
          x,
          y,
          // we SHOULD scale the height/width, because clientRect.height/width is in SCREEN coords, and we want PLANE coords
          height: debug(clientRect.height / innerScale, 'CLIENT RECT HEIGHT', true),
          width: debug(clientRect.width / innerScale, 'CLIENT RECT WIDTH', true),
          planeScale: scale, // MY scale
          innerScale, // composite scale
        });

        return vps;
      },
      {
        propContent,
        defaultPropContent,
        clientRect,
        parentPlaneScale: parentPlaneScale ?? new Observable(1),
      },
    );
  }

  /** BoundingBox within the plane coordinate system which describes the current frustum into the topic space */
  @MemoizeOwned()
  get viewportState(): Observable<ViewportState> {
    const obs = new Observable<ViewportState>(
      this.defaultViewport ??
        new ViewportState({
          x: 0,
          y: 0,
          width: this.clientRectObs.value.width / 0.5,
          height: this.clientRectObs.value.height / 0.5,
          innerScale: 0.5,
          planeScale: 0.5,
        }),
    );

    void this.dbViewportState.get().then((v) => {
      if (v && obs.alive) {
        obs.set(v);
      }
    });

    return obs;
  }

  @MemoizeOwned()
  get panning() {
    return new Observable(false);
  }
  @MemoizeOwned()
  get zooming() {
    return new Observable(false);
  }

  @MemoizeOwned()
  get organizeTabsButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        const toolbar = (this.context.rootNode as AppDesktop)!.toolbar;
        toolbar.tabsPanel.open();
        toolbar.context.focusState.setPendingFocus({
          match: (x) => x instanceof TabsPanel,
          context: {},
        });
      },
    });
  }
  @MemoizeOwned()
  get uploadFilesButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {},
    });
  }

  @MemoizeOwned()
  get searchButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        const root = this.context.rootNode as AppDesktop;
        if (!root.searchPanel.isFocused.value) {
          root.setSearchMode('standard');
        } else {
          if (root.searchMode.value !== 'standard') {
            root.setSearchMode('standard');
          } else {
            root.setSearchMode('hidden');
          }
        }
      },
    });
  }

  @MemoizeOwned()
  get zoomState() {
    return ZoomState.new({ parentNode: this, context: this.context });
  }

  @WeakProperty
  get isChatWindowOpen() {
    const root = this.context.rootNode as AppDesktop;
    return root.chatPanel.expanded;
  }

  @WeakProperty
  get chatWindowClientRectObs() {
    const root = this.context.rootNode as AppDesktop;
    const chatClientRectObs = root.chatPanel.clientRectObs;
    return chatClientRectObs;
  }
}
