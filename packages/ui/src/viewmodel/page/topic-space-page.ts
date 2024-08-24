import { BoundingBox, ConditionalNode, VertexNode, VertexNodeCA } from './../base';
import { Model } from '@edvoapp/common';
import { MemoizeOwned, Observable, ObservableReader, OwnedProperty } from '@edvoapp/util';
import { Outline } from '../outline/outline';
import { TopicSearchCard, TopicSpace, TopicSpaceTitle, ViewportState } from '../topic-space';
import { Sharing } from '../../behaviors';
import { ActiveConversation, ConversationModal } from '../conversation-modal';
import { activeConversationObs } from '../../components';
import { Behavior } from '../../service';
import { RadialNav } from '../wgpu';
import { AppDesktop } from '../app-desktop';
import { Button } from '../button';
import { CloneContext } from '../../utils';

interface TSPageCA extends VertexNodeCA {
  centerMemberId?: string;
  defaultViewport?: ViewportState;
}

export class TSPage extends VertexNode {
  readonly centerMemberId?: string;
  readonly defaultViewport?: ViewportState;
  constructor({ centerMemberId, defaultViewport, ...args }: TSPageCA) {
    super(args);
    this.centerMemberId = centerMemberId;
    this.defaultViewport = defaultViewport;
  }
  static new(args: TSPageCA) {
    if (!args.vertex) debugger;
    const me = new TSPage(args);
    me.init();
    return me;
  }
  init() {
    super.init();

    this.onCleanup(
      this.name.subscribe((name) => {
        document.title = name ? `${name} - Edvo` : 'Edvo';
      }, true) ?? (() => {}),
    );
  }
  get childProps(): (keyof this & string)[] {
    return ['topicSpace', 'sidebar', 'sidebarToggle', 'title', 'topicSearchCard', 'conversationModal', 'radialNav'];
  }

  getHeritableBehaviors(): Behavior[] {
    return [new Sharing()];
  }

  @MemoizeOwned()
  get clientRectObs(): ObservableReader<BoundingBox> {
    const appDesktop = this.findClosest((n) => n instanceof AppDesktop && n);
    const clientRect = appDesktop?.clientRectObs;
    return Observable.calculated(
      ({ clientRect: c }) => {
        const clientRect = c as BoundingBox | undefined;
        return new BoundingBox({
          x: clientRect?.x ?? 0,
          y: (clientRect?.y ?? 0) + 60, // header
          width: clientRect?.width ?? 0,
          height: clientRect?.height ?? 0,
        });
      },
      { clientRect },
    );
  }

  @MemoizeOwned()
  get radialNavOpen() {
    return new Observable(false);
  }

  // TODO: use rendermodule to derender children too
  @MemoizeOwned()
  get radialNav() {
    return ConditionalNode.new<RadialNav, boolean, TSPage>({
      parentNode: this,
      precursor: this.radialNavOpen,
      factory: (open, parentNode) => {
        return open
          ? RadialNav.new({
              parentNode,
              context: this.context,
              label: 'radial-nav',
            })
          : null;
      },
    });
  }

  @MemoizeOwned()
  get topicSearchCardOpen() {
    return new Observable(false);
  }

  @MemoizeOwned()
  get topicSearchCard() {
    return ConditionalNode.new<TopicSearchCard, boolean, TSPage>({
      parentNode: this,
      precursor: this.topicSearchCardOpen,
      factory: (open, parentNode) => {
        return open
          ? TopicSearchCard.new({
              parentNode,
              label: 'topicSearchCard',
            })
          : null;
      },
    });
  }

  @MemoizeOwned()
  get title() {
    return TopicSpaceTitle.new({
      parentNode: this,
      vertex: this.vertex,
      observeResize: true,
      context: this.context,
    });
  }

  @MemoizeOwned()
  get topicSpace() {
    return TopicSpace.new({
      parentNode: this,
      context: this.context,
      vertex: this.vertex,
      defaultViewport: this.defaultViewport,
    });
  }
  @OwnedProperty
  _sidebarExpanded = new Observable<null | boolean>(null);

  @MemoizeOwned()
  get sidebarExpanded(): ObservableReader<boolean | null> {
    return this._sidebarExpanded;
  }

  collapseSidebar() {
    this._sidebarExpanded.set(false);
  }

  expandSidebar() {
    this._sidebarExpanded.set(true);
  }

  @MemoizeOwned()
  get sidebarToggle() {
    return ConditionalNode.new<Button, boolean, this>({
      parentNode: this,
      precursor: this.sidebar.visible,
      factory: (visible, parentNode) =>
        // do not show the button if it is visible
        visible
          ? null
          : Button.new({
              parentNode,
              onClick: () => this.expandSidebar(),
            }),
    });
  }

  @MemoizeOwned()
  get sidebar() {
    return TSSidebar.new({
      vertex: this.vertex,
      context: this.context,
      parentNode: this,
    });
  }

  @MemoizeOwned()
  get conversationModal() {
    return ConditionalNode.new<ConversationModal, ActiveConversation | null | undefined>({
      parentNode: this,
      precursor: activeConversationObs,
      factory: (activeConversation, parentNode) =>
        activeConversation &&
        ConversationModal.new({
          parentNode,
          activeConversation,
        }),
    });
  }

  // TODO: This is a weak permissions check, ONLY being used for analytics currently
  @MemoizeOwned()
  get isShared() {
    return Observable.calculated(({ shares }) => shares.length > 0, {
      shares: this.vertex.shares,
    });
  }
}

export class TSSidebar extends VertexNode<TSPage> {
  readonly label = 'ts-sidebar';
  hasDepthMask = true;
  zIndexed = true;
  static new(args: VertexNodeCA<TSPage>) {
    const me = new TSSidebar(args);
    me.init();
    return me;
  }

  @MemoizeOwned()
  get visible() {
    return Observable.calculated(({ expanded, items }) => expanded ?? items.length > 0, {
      expanded: this.parentNode.sidebarExpanded,
      items: this.outlineBackrefs,
    });
  }

  get childProps(): (keyof this & string)[] {
    return ['outline', 'closeButton'];
  }

  // TODO: make this resizable at some point
  @MemoizeOwned()
  get clientRectObs() {
    const root = this.root;
    if (!(root instanceof AppDesktop)) return new Observable(BoundingBox.ZERO);
    return Observable.calculated(
      ({ panelRect, pageRect, panelOpen }) => {
        const { width: pageWidth, height: pageHeight, x: pageLeft, y: pageTop } = pageRect;
        const { top: panelTop } = panelRect;
        const width = 400;
        const y = pageTop + 70;
        // TODO: panelTop should be undefined or 0 something if the panel is closed. That is not currently the case, thus we need to do an open check.
        const height = (panelOpen ? panelTop : pageHeight - 100) - y - 30;
        return new BoundingBox({
          x: pageLeft + (pageWidth - width) - 12,
          y,
          width,
          height,
        });
      },
      {
        panelOpen: root.chatPanel.expanded,
        panelRect: root.chatPanel.clientRectObs,
        pageRect: this.parentNode.clientRectObs,
      },
    );
  }

  @MemoizeOwned()
  get outlineBackrefs() {
    const itemRoles = ['category-item'];
    return (
      this.vertex
        .filterBackrefs({
          role: itemRoles,
          userID: this.parentNode?.visibleUserIDsForDescendants,
        })
        // TODO: Handle 0 and negative seq numbers
        .sortObs((a, b) => a.seq.value - b.seq.value)
    );
  }

  @MemoizeOwned()
  get outline() {
    return Outline.new({
      vertex: this.vertex,
      context: this.context,
      parentNode: this,
    });
  }

  @MemoizeOwned()
  get closeButton() {
    return Button.new({
      parentNode: this,
      onClick: () => this.parentNode.collapseSidebar(),
    });
  }

  /**
   * overwriting VMNode.shallowClone because we want to ensure we traverse this node's tree, and TSSidebar is not a VertexNode.
   */
  shallowClone(targetParentVertex: Model.Vertex, cloneContext: CloneContext): Promise<Model.Vertex | null> {
    return Promise.resolve(targetParentVertex);
  }
}
