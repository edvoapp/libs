import { config, Model, globalStore, trxWrapSync, trxWrap } from '@edvoapp/common';
import {
  FilteredObservableList,
  MemoizeOwned,
  Observable,
  ObservableList,
  ObservableReader,
  OwnedProperty,
  debugLog,
  waitForWasm,
} from '@edvoapp/util';
import * as Behaviors from '../behaviors';
import {
  AppLocation,
  BoundingBox,
  ChildNode,
  ChildNodeCA,
  ConditionalNode,
  ListNode,
  Node,
  NodeCA,
  ViewModelContext,
} from './base';
import { ContextMenu } from './context-menu';
import { Dock } from './dock/dock';
import { Header, SearchPanel } from './header';
import { Toolbar } from './toolbar';
import { TSPage, NewTopicPage, MyUniverse, HomePage } from './page';
import { UserSettingsModal } from './user';
import { Lasso, LassoBehavior } from './lasso';
import { TileContainer } from './tile-container';
import { Member, TopicSpace, ViewportState } from './topic-space';
import { Behavior, TYPE, POSITION, createToast } from '../service';
import { TopicSearchList } from './topic-search-list';
import { route } from 'preact-router';
import { FunctionComponent } from 'preact';
import { DebugPanel } from './debug-panel';
import {
  ConditionalPanel,
  MemberSelectionBox,
  Button,
  HelpModal,
  FloatingPanel,
  WelcomeModal,
  ReportBugsModal,
  SyncProfilesModal,
} from '.';
import { AppSettingsModal } from './user/app-settings-modal';
import { toast } from 'react-toastify';
import { ToolCallViewer } from './tool-call-viewer';
import { stringify } from 'flatted';

interface FixedItem extends Node {
  component?: FunctionComponent<{ node: FixedItem }>;
}
import { ChatPanel } from './chat/chatpanel';
import { ToggleChatButton } from './chat/toggle-chat-button';
import { Launch } from './page/launch-space';
import { first } from 'lodash';

export class AppDesktop extends Node<null> {
  static new(args: NodeCA<null>) {
    const me = new AppDesktop(args);
    me.init();
    return me;
  }
  init() {
    super.init();
    if (this.context.location.value?.path?.[0] === 'topic') {
      const user = this.context.authService.currentUserVertexObs.value;
      if (!user) void this.context.authService.signInAnonymously();
    }
  }

  constructor(args: NodeCA<null>) {
    super(args);

    this.addManagedListener(window, 'resize', () => this.handleResize());
    this.onCleanup(
      this.context.location.subscribe(() => {
        // whenever we change page context, reset quickadd
        this.quickAdd.nextMemberType = 'stickynote';
        this.quickAdd.nextMemberColor = undefined;
        this.quickAdd.nextMemberDims = undefined;
        const tsPage = this.topicSpace.value;
      }),
    );
    // this.onCleanup(
    //   this.context.location.subscribe(({ path }) => {
    //     const organizerVisible = this.organizer.visible.value;
    //     if (path[0] === 'organizer' && !organizerVisible) {
    //       // set timeout in case the eventNav is not yet initialized
    //       setTimeout(() => {
    //         // if we go to the organizer route and the organizer is not already visible, set it to visible
    //         this.toggleOrganizer();
    //       }, 1);
    //     }
    //   }),
    // );
  }

  handleResize() {
    (this.clientRectObs as Observable<BoundingBox>).set(
      new BoundingBox({
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        innerScale: 1,
      }),
    );
  }

  get childProps(): (keyof this & string)[] {
    return [
      'homePage',
      'topicSpace',
      'myUniverse',
      'header',
      'searchPanel',
      // 'dockSouth', // TODO: restore later
      'appSettingsModal',
      'userSettingsModal',
      'syncProfilesModal',
      'lasso',
      'tileContainer',
      'newTopic',
      'debugPanel',
      'toolbar',
      'selectionBox',
      'contextMenu',
      'reportBugsButton',
      'reportBugsModal',
      'chatPanel',
      'toggleChatButton',
      'fixedItems', // should always be the last item in the childProps list, because we do getNodeAtScreenPoint using lifo
    ];
  }
  @MemoizeOwned()
  get clientRectObs(): ObservableReader<BoundingBox> {
    return new Observable(
      new BoundingBox({
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        innerScale: 1,
      }),
    );
  }

  @OwnedProperty
  quickAdd = new Behaviors.QuickAdd();

  getHeritableBehaviors(): Behavior[] {
    let quickAdd = this.quickAdd;
    return [
      // Hack - split quickAdd into two behaviors.
      // TODO: Update Behavior system to instantiate behavior objects globally
      //       but sequence them heritably, and with the ability to vary which items are dispatched
      //
      // Something to the effect of the below but maybe a bit more elegant?
      // const { quickAdd, wheel } = context.behaviors;
      // return [ quickAdd.activationOps, wheel.allOps, quickAdd.postActivationOps ]

      // Additional idea: Don't build a total order of ops, but partial orders. Eg: eventNav.registerHappensBefore(text.allOps, quickAdd.activationOps)
      // Then resolve partial orders, and throw errors when cycles are detected
      new Behaviors.CreateArrow(),
      new Behaviors.RadialNavAction(),
      new Behaviors.PointerAction(),
      new Behaviors.Resize(),
      new Behaviors.Undo(),
      new Behaviors.Indent(),
      new Behaviors.OutlineItem(),
      new Behaviors.Text(),
      new Behaviors.Selection(), // After text
      new Behaviors.FullScreen(),
      new Behaviors.KeyFocus(),
      new Behaviors.PointerFocus(),
      new Behaviors.KeyboardShortcut(),
      quickAdd,
      new Behaviors.QuickAddActivate(quickAdd),
      new Behaviors.ClickSelector(),
      new Behaviors.Plane(),
      new Behaviors.DragDrop(),
      new Behaviors.PinTopic(),
      new Behaviors.ContextMenu(),
      new Behaviors.AddAction(),
      new Behaviors.ManualAppearance(),
      new Behaviors.AppearanceType(),
      new Behaviors.OutlineItemAppearanceType(),
      new Behaviors.MouseActionProperty(),
      new Behaviors.JumpTo(),
      new Behaviors.CardColor(),
      new Behaviors.ContentMode(),
      new Behaviors.UnlinkItem(),
      new Behaviors.ZIndex(),
      new Behaviors.CenterViewport(),
      new Behaviors.TopicArchive(),
      new Behaviors.Download(),
      // new Behaviors.AutoBox(),
      new Behaviors.BulletCutCopy(),
      new LassoBehavior(),
      // Wheel at the end -- any time no one handles the wheel event, return native
      new Behaviors.Wheel(),

      // new Behaviors.Hotkeys(),
    ];
  }

  @MemoizeOwned()
  get myUniverse() {
    const userObs = this.context.authService.currentUserVertexObs;
    const locationObs = this.context.location;

    // const precursor = Observable.fromObservables(() => {
    //   const user = userObs.value;
    //   const location = locationObs.value;
    //   return { location, user };
    // }, [userObs, locationObs]);
    const precursor = new Observable(false);

    return ConditionalNode.new<TSPage>({
      parentNode: this,
      precursor,
      factory: ({ location, user }: { location: AppLocation; user: Model.Vertex }, parentNode): TSPage | null => {
        if (!location || !user) return null;
        if (location.path.length > 0) return null;

        return TSPage.new({
          parentNode,
          context: this.context,
          vertex: user,
          label: 'my-universe',
        });
      },
    });
  }
  @MemoizeOwned()
  get homePage() {
    const userObs = this.context.authService.currentUserVertexObs;
    const locationObs = this.context.location;

    const precursor = Observable.fromObservables(() => {
      const user = userObs.value;
      const location = locationObs.value;
      return { location, user };
    }, [userObs, locationObs]);

    return ConditionalNode.new<HomePage>({
      parentNode: this,
      precursor,
      factory: ({ location, user }: { location: AppLocation; user: Model.Vertex }, parentNode): HomePage | null => {
        if (!location || !user) return null;
        if (location.path.length > 0) return null;

        return HomePage.new({
          parentNode,
          context: this.context,
          vertex: user,
        });
      },
    });
  }

  @OwnedProperty
  _fixedItems = new ObservableList<FixedItem>();
  /**
   * fixedItems contains the items which utilize fixed positioning, and whose events should be bubbled only from the root node
   * BE AWARE: Nodes here are "children" of the root node, but may or not have the root node as their parent
   * I think this is ok, because events bubble from root to leaf
   */
  @MemoizeOwned()
  get fixedItems(): ListNode<this, FixedItem> {
    // Just a passthrough to make _fixedItems valid "child" nodes for event bubbling
    return ListNode.new({
      parentNode: this,
      precursor: this._fixedItems,
      factory: (node, parentNode) => node,
    });
  }
  addFixedItem(node: Node) {
    this._fixedItems.insert(node);
  }
  removeFixedItem(node: Node) {
    this._fixedItems.remove(node);
  }
  showMask() {
    // this could just be a fixed item that gets added and removed, or it could have a dedicated child property with a ConditionalNode
    // either way we have to manage its zindex
    // Is this dynamic? (what do you do when you have multiple fixed items?)
    // I think we can get away with it being static in the short term AS LONG AS modals set their zindex to the const modal zindex
  }
  hideMask() {}

  // @MemoizeOwned()
  // get expandButton() {
  //   return new Button({
  //     parentNode: this,
  //     label: 'Expand',
  //     onClick: () => {
  //       this.addFixedItem(ToolCallViewer.spawn({}));
  //     },
  //   });
  // }

  @MemoizeOwned()
  get tsPagePrecursor() {
    return Observable.calculated(
      ({ user, location }) => {
        if (!location || !user) return null;
        const [first, topicId] = location.path;
        // /topic/abc123?centerMemberId=123abc
        if (first !== 'topic' || !topicId) return null;
        // only launch if we are in webapp, and we are not explicitly skipping launch, and we are not in test
        const launch = this.context.runtime !== 'electron' && !location.params.skipLaunch && config.env !== 'test';
        const centerMemberId = location.params['centerMemberId'];
        const vertex = Model.Vertex.getById({ id: topicId });
        return {
          vertex,
          launch,
          centerMemberId,
        };
      },
      {
        user: this.context.authService.currentUserVertexObs,
        location: this.context.location,
      },
    );
  }

  @MemoizeOwned()
  get topicSpace() {
    const precursor = this.tsPagePrecursor;

    return ConditionalNode.new<TSPage>({
      parentNode: this,
      precursor,
      factory: (pre, parentNode) => {
        if (!pre) return null;
        const { vertex, centerMemberId, launch } = pre;
        if (launch) return null;

        return TSPage.new({
          parentNode,
          context: this.context,
          vertex,
          centerMemberId,
          label: 'topic-space-page',
        });
      },
    });
  }

  @MemoizeOwned()
  get launch() {
    type Pre = { launch: boolean; vertex: Model.Vertex | null } | null;
    // also launch if the location is /launch
    const precursor: ObservableReader<Pre> = Observable.calculated(
      ({ user, location, tsPre }) => {
        if (user && location.path[0] === 'launch') return { vertex: null, launch: true };
        return tsPre;
      },
      {
        user: this.context.authService.currentUserVertexObs,
        location: this.context.location,
        tsPre: this.tsPagePrecursor,
      },
    );

    return ConditionalNode.new<Launch, Pre>({
      parentNode: this,
      precursor,
      factory: (pre, parentNode) => {
        if (!pre) return null;
        const { vertex, launch } = pre;
        if (!launch) return null;

        return Launch.new({
          parentNode,
          context: this.context,
          vertex,
          label: 'launch-space',
        });
      },
    });
  }

  @MemoizeOwned()
  get newTopic() {
    return ConditionalNode.new<NewTopicPage>({
      parentNode: this,
      precursor: this.context.location,
      factory: (location, parentNode): NewTopicPage | null => {
        const [type] = location.path;
        if (type !== 'new-topic' && type !== 'recent-topic') return null;
        return NewTopicPage.new({ parentNode, type });
      },
    });
  }

  @MemoizeOwned()
  get organizerPage() {
    const precursor = this.context.location.mapObs(({ path }) => path[0] === 'organizer');
    return ConditionalNode.new<OrganizerPage, boolean, AppDesktop>({
      parentNode: this,
      precursor,
      factory: (want, parentNode) => (want ? OrganizerPage.new({ parentNode }) : null),
    });
  }

  // @MemoizeOwned()
  // get extensionPopup() {
  //   const userObs = this.context.authService.currentUserVertexObs;
  //   const locationObs = this.context.location;
  //
  //   const precursor = Observable.fromObservables(() => {
  //     const user = userObs.value;
  //     const location = locationObs.value;
  //     return user && location.path[0] === 'extension-popup';
  //   }, [userObs, locationObs]);
  //
  //   return ConditionalNode.new<ExtensionPopup>({
  //     parentNode: this,
  //     precursor,
  //     factory: (want, parentNode) => {
  //       if (want) {
  //         return null;
  //         // let qp = ExtensionPopup.new({ parentNode, context: this.context });
  //         // this.context.focusState.setPendingFocus({
  //         //   match: (n) => n instanceof TopicSearch && n.parentNode === qp,
  //         //   context: {},
  //         // });
  //         // return qp;
  //       } else {
  //         return null;
  //       }
  //     },
  //   });
  // }

  @OwnedProperty
  quickAdding = new Observable(false);

  @MemoizeOwned()
  get toolbar() {
    return Toolbar.new({
      parentNode: this,
    });
  }

  @MemoizeOwned()
  get header() {
    return Header.new({
      parentNode: this,
    });
  }

  @MemoizeOwned()
  get tileContainer() {
    return TileContainer.new({ parentNode: this, context: this.context });
  }

  @MemoizeOwned()
  get contextMenu() {
    return ContextMenu.new({
      parentNode: this,
    });
  }

  @MemoizeOwned()
  get reportBugsButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        this.reportBugsModal.toggle();
      },
    });
  }

  @MemoizeOwned()
  get reportBugsModal(): ConditionalPanel<ReportBugsModal, AppDesktop> {
    return ConditionalPanel.new<ReportBugsModal, AppDesktop>({
      parentNode: this,
      factory: (parentNode) =>
        ReportBugsModal.new({
          parentNode,
          context: this.context,
        }),
    });
  }

  @MemoizeOwned()
  get chatPanel() {
    return ChatPanel.new({
      parentNode: this,
    });
  }
  @MemoizeOwned()
  get toggleChatButton() {
    return ToggleChatButton.new({
      parentNode: this,
      chatPanel: this.chatPanel,
    });
  }

  @MemoizeOwned()
  get searchPanel() {
    return SearchPanel.new({
      parentNode: this,
      fitContentParent: null,
      observeResize: true,
    });
  }

  @OwnedProperty
  _searchMode = new Observable<'hidden' | 'share' | 'standard'>('hidden');

  get searchMode(): ObservableReader<'hidden' | 'share' | 'standard'> {
    return this._searchMode;
  }
  setSearchMode(mode: 'hidden' | 'share' | 'standard') {
    this._searchMode.set(mode);
    if (mode !== 'hidden') {
      this.context.focusState.setFocus(this.searchPanel.textfield, {});
    }
  }

  // TODO: restore later
  // @MemoizeOwned()
  // get dockSouth() {
  //   const precursor = new Observable<Model.Vertex | undefined>(
  //     undefined,
  //     async () => {
  //       const user =
  //         await this.context.authService.currentUserVertexObs.awaitDefined();
  //       if (user) {
  //         const dockVertex = await Dock.getVertex(user);
  //         precursor.set(dockVertex);
  //       }
  //     },
  //   );
  //
  //   return ConditionalNode.new<Dock, Model.Vertex | undefined, AppDesktop>({
  //     parentNode: this,
  //     label: 'dockSouth',
  //     precursor,
  //     factory: (vertex, parentNode) => {
  //       return vertex
  //         ? Dock.new({
  //             context: this.context,
  //             parentNode,
  //             vertex,
  //           })
  //         : null;
  //     },
  //   });
  // }

  @MemoizeOwned()
  get userSettingsModal(): ConditionalPanel<UserSettingsModal, AppDesktop> {
    return ConditionalPanel.new<UserSettingsModal, AppDesktop>({
      parentNode: this,
      factory: (parentNode) =>
        UserSettingsModal.new({
          parentNode,
          context: this.context,
          vertex: Model.Vertex.getById({
            id: this.context.currentUser.value!.id,
          }),
        }),
    });
  }

  @MemoizeOwned()
  get appSettingsModal(): ConditionalPanel<AppSettingsModal, AppDesktop> {
    return ConditionalPanel.new<AppSettingsModal, AppDesktop>({
      parentNode: this,
      factory: (parentNode) =>
        AppSettingsModal.new({
          parentNode,
          context: this.context,
        }),
    });
  }

  @MemoizeOwned()
  get syncProfilesModal(): ConditionalPanel<SyncProfilesModal, AppDesktop> {
    return ConditionalPanel.new<SyncProfilesModal, AppDesktop>({
      parentNode: this,
      factory: (parentNode) =>
        SyncProfilesModal.new({
          parentNode,
          context: this.context,
          vertex: Model.Vertex.getById({
            id: this.context.currentUser.value!.id,
          }),
        }),
    });
  }

  @MemoizeOwned()
  get lassoOpen(): ObservableReader<boolean> {
    return new Observable(false);
  }
  setLassoOpen(value: boolean) {
    (this.lassoOpen as Observable<boolean>).set(value);
  }

  @MemoizeOwned()
  get lasso() {
    return ConditionalNode.new<Lasso, boolean, AppDesktop>({
      parentNode: this,
      precursor: this.lassoOpen,
      factory: (open, parentNode) => {
        return open
          ? Lasso.new({
              parentNode,
            })
          : null;
      },
    });
  }

  @MemoizeOwned()
  get selectionBox(): ConditionalNode<MemberSelectionBox, Node[], AppDesktop> {
    return ConditionalNode.new<MemberSelectionBox, Node[], AppDesktop>({
      //
      parentNode: this,
      label: 'selectionBox',
      precursor: this.context.selectionState.selection.filterObs((node) => node instanceof Member),
      factory: (selection, parentNode) =>
        selection.length > 0 ? MemberSelectionBox.new({ selection, parentNode }) : null,
    });
  }

  @MemoizeOwned()
  get debugPanel() {
    const precursor = this.context.authService.currentUserVertexObs.mapObs<boolean>(
      (user) => user?.getFlagPropertyObs('debug-panel-enabled').mapObs((v) => !!v) ?? false,
    );

    return ConditionalNode.new<DebugPanel, boolean, AppDesktop>({
      precursor,
      parentNode: this,
      factory: (want, parentNode) => (want ? DebugPanel.new({ parentNode }) : null),
    });
  }
}

interface OrganizerPageCA extends ChildNodeCA<ConditionalNode<OrganizerPage, boolean, AppDesktop>> {}

class OrganizerPage extends ChildNode<ConditionalNode<OrganizerPage, boolean, AppDesktop>> {
  static new(args: OrganizerPageCA) {
    const me = new OrganizerPage(args);
    me.init();
    return me;
  }
}

waitForWasm().then((wasm) => {
  wasm.setTrxAccessDeniedHook((msg) => {
    toast(msg, {
      type: TYPE.WARNING,
      autoClose: 5000,
      draggable: false,
      closeOnClick: true,
    });
  });
});
