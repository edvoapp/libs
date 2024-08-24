import { MemoizeOwned, Observable, ObservableReader, OwnedProperty } from '@edvoapp/util';
import { Model, TrxRef, globalStore, trxWrapSync } from '@edvoapp/common';
import {
  BranchNode,
  BranchNodeCA,
  ChildNode,
  ChildNodeCA,
  ConditionalNode,
  ListNode,
  Node,
  NodeAndContext,
  VertexNode,
  VertexNodeCA,
} from '../base';
import { NameTagField } from '../name-tag-field';
import { MemberBody } from './member-body';
import { Draggable, PositionAndType } from '../../behaviors';
import { FileIcon } from '../file-icon';
import { Behavior, DispatchStatus, EventNav, useNavigator } from '../../service';
import { ContextMenuButton } from './context-menu-button';
import { isClosable } from '../conditional-panel';
import { SearchPanelResults } from '../search-panel-results';
import { Button } from '../button';
import { Behaviors, copyAndToast } from '../..';
import { toast } from 'react-toastify';
import { POSITION, TYPE } from '../../service/toast';
import { downloadableMimeTypes } from '../body-content';

interface CA extends VertexNodeCA<Node> {
  alwaysShowAddTagButton?: boolean;
  nameReadonly?: boolean;
  draggable?: boolean;
  onSelect?: ((vertex: Model.Vertex, trx: TrxRef) => void) | null;
  singleLine?: boolean;
  disableAddTag?: boolean;
  tagsReadonly?: boolean;
  visitEvent?: Model.TimelineEvent;
  showQuickActions?: boolean;
  label?: string;
}

export class TopicItem extends VertexNode<Node> {
  alwaysShowAddTagButton?: boolean;
  isListItem = this.parentNode instanceof ListNode;
  allowHover = true;
  nameReadonly: boolean;
  tagsReadonly?: boolean;
  zIndexed = true;
  // hasDepthMask = true;
  _draggable: boolean;
  overflow = true;
  onSelect: ((vertex: Model.Vertex, trx: TrxRef) => void) | null;
  singleLine?: boolean;
  disableAddTag?: boolean;
  _visitEvent?: Model.TimelineEvent;
  showQuickActions?: boolean;
  label?: string;
  constructor({
    alwaysShowAddTagButton,
    nameReadonly = true,
    draggable = false,
    onSelect,
    singleLine,
    disableAddTag,
    tagsReadonly,
    visitEvent,
    showQuickActions,
    label,
    ...args
  }: CA) {
    super(args);
    this.alwaysShowAddTagButton = alwaysShowAddTagButton;
    this.nameReadonly = nameReadonly;
    this._draggable = draggable;
    this.onSelect = onSelect || null;
    this.singleLine = singleLine;
    this.disableAddTag = disableAddTag;
    this.tagsReadonly = tagsReadonly;
    this._visitEvent = visitEvent;
    this.showQuickActions = showQuickActions;
    this.label = label;
  }
  static new(args: CA) {
    const me = new TopicItem(args);
    me.init();
    return me;
  }

  // get focusable(): boolean {
  //   // TODO consider whether TopicItem should actually be focusable
  //   // This really hinges on what exactly a TopicItem is. Is it always a result item? Or is it used to render anything that's not a list?
  //   // If not, maybe it should have a SearchResultItem wrapper node or something that IS focusable
  //   return true;
  // }

  get draggable() {
    return this._draggable && !this.isInsideOpaque;
  }
  get dragHandle() {
    return this._draggable && !this.isInsideOpaque;
  }
  useDragProxy = true;

  @OwnedProperty
  dragging = new Observable<PositionAndType | null>(null);
  setDragging(pos: PositionAndType | null) {
    this.dragging.set(pos);
  }

  getHeritableBehaviors() {
    return [new TopicItemClick()];
  }

  get childProps(): (keyof this & string)[] {
    return ['icon', 'nameTagField', 'actions'];
  }

  get cursor() {
    if (this.dragging.value) {
      return 'grabbing';
    } else if (this.isInsideOpaque) {
      return this._cursorFromParent ?? 'grab';
    } else {
      return 'pointer';
    }
  }
  @MemoizeOwned()
  get nameTagField(): NameTagField {
    const closestCard = this.findClosest((n) => n instanceof MemberBody && n);
    const vertexTagToHide = closestCard?.vertex;
    return NameTagField.new({
      parentNode: this,
      vertex: this.vertex,
      nameReadonly: this.nameReadonly,
      allowHover: false,
      vertexTagToHide,
      cursor: this.cursor,
      alwaysShowAddTagButton: this.alwaysShowAddTagButton,
      disableAddTag: this.disableAddTag,
      tagsReadonly: this.tagsReadonly,
    });
  }

  @MemoizeOwned()
  get pinProperty(): ObservableReader<Model.Property | null | undefined> {
    return this.vertex
      .filterProperties({
        role: ['pin'],
        contentType: 'application/json',
        userID: [globalStore.getCurrentUserID()],
      })
      .filterObs((p) => p.status.value === 'active')
      .firstObs();
  }

  // TODO: consider consolidating this with BodyContent's icon
  @MemoizeOwned()
  get icon(): FileIcon {
    const faviconProperty = this.vertex
      .filterProperties({
        role: ['favicon'],
        userID: this.parentNode.visibleUserIDsForDescendants,
      })
      .firstObs();

    const fileExtensionProperty = this.vertex
      .filterProperties({
        role: ['file-extension'],
        contentType: 'text/x-file-extension',
        userID: this.parentNode.visibleUserIDsForDescendants,
      })
      .firstObs();
    return FileIcon.new({
      parentNode: this,
      property: this.bodyProperty,
      fileExtensionProperty,
      faviconProperty,
      cursor: this.cursor,
    });
  }

  @MemoizeOwned()
  get actions() {
    const precursor = Observable.calculated(
      ({ hover }) => (hover === 'branch' || hover === 'leaf') && this.showQuickActions && !this.isInsideOpaque,
      {
        hover: this.hover,
      },
    );
    return ConditionalNode.new<TopicItemActions, boolean | undefined, TopicItem>({
      parentNode: this,
      precursor: precursor,
      factory: (want) => {
        if (!want) return null;
        return TopicItemActions.new({
          parentNode: this,
        });
      },
    });
  }

  upwardNode(): NodeAndContext | null {
    if (this.parentNode instanceof ListNode) {
      const nextSibling = super.prevSibling();
      if (nextSibling) return { node: nextSibling };
      if (this.parentNode.parentNode instanceof SearchPanelResults) {
        const node = this.parentNode.parentNode! as SearchPanelResults;
        return { node: node.parentNode.textfield };
      }
    }
    return super.downwardNode();
  }
  downwardNode(): NodeAndContext | null {
    if (this.parentNode instanceof ListNode) {
      const nextSibling = super.nextSibling();
      if (nextSibling) return { node: nextSibling };
      if (this.parentNode.parentNode instanceof SearchPanelResults) {
        const node = this.parentNode.parentNode;
        const trimmedLength = node.queryTextDebounced.value?.trim().length ?? 0;
        if (trimmedLength) {
          return { node: node.createNewTopicButton };
        } else {
          return { node: node.parentNode.textfield };
        }
      }
    }
    return super.downwardNode();
  }
  leftwardNode(): NodeAndContext | null {
    return this.upwardNode();
  }
  rightwardNode(): NodeAndContext | null {
    return this.downwardNode();
  }

  get isInsideOpaque() {
    return this.findClosest((n) => n.opaque);
  }
  handleDepart(trx: TrxRef) {
    return this.parentNode?.handleDepart(trx) ?? false;
  }
}

class TopicItemClick extends Behavior {
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    return hanldeTopicSelected(originNode);
  }

  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: Node<Node<any> | null>): DispatchStatus {
    if (e.key == 'Enter') {
      return hanldeTopicSelected(originNode);
    }
    return 'decline';
  }
}

function hanldeTopicSelected(originNode: Node): DispatchStatus {
  if (originNode.findClosest((n) => n.opaque)) return 'decline';
  const closestTopicItem = originNode.findClosest((n) => n instanceof TopicItem && n);
  const closablePanel = originNode.findClosest((n) => isClosable(n) && n.closable && n.isOpen && n);
  const onSelect = closestTopicItem?.onSelect;
  if (!onSelect) return 'decline';
  trxWrapSync((trx) => onSelect(closestTopicItem.vertex, trx), 'hanldeTopicSelected');
  if (closablePanel) {
    closablePanel.close();
  }
  return 'stop';
}

interface ListItemCA extends BranchNodeCA<Node> {
  alwaysShowAddTagButton?: boolean;
  nameReadonly?: boolean;
}

export class TopicListItem extends BranchNode<Node> implements Draggable {
  alwaysShowAddTagButton: boolean;
  nameReadonly: boolean;
  allowHover: boolean = true;
  constructor({ alwaysShowAddTagButton, nameReadonly = true, ...args }: ListItemCA) {
    super(args);
    this.alwaysShowAddTagButton = alwaysShowAddTagButton ?? false;
    this.nameReadonly = nameReadonly;
  }
  static new(args: ListItemCA) {
    const me = new TopicListItem(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['item'];
  }

  onSelect(vertex: Model.Vertex) {
    const nav = useNavigator();
    nav.openTopic(vertex, undefined, undefined);
  }

  @MemoizeOwned()
  get item() {
    return TopicItem.new({
      vertex: this.vertex,
      parentNode: this,
      context: this.context,
      disableAddTag: true,
      nameReadonly: this.nameReadonly,
      allowHover: true,
      onSelect: this.onSelect.bind(this),
      draggable: true,
      tagsReadonly: true,
      showQuickActions: true,
      label: 'list-item',
    });
  }
  handleDepart(trx: TrxRef) {
    this.backref?.archive(trx);
    return true;
  }

  get isInsideOpaque() {
    return this.findClosest((n) => n.opaque);
  }

  get dragHandle() {
    return !this.isInsideOpaque;
  }

  useDragProxy = true;

  get draggable() {
    return !this.isInsideOpaque;
  }

  @OwnedProperty
  dragging = new Observable<PositionAndType | null>(null);
  setDragging(pos: PositionAndType | null) {
    this.dragging.set(pos);
  }

  get seq() {
    return this.backref?.seq.value ?? 0;
  }
}
interface TopicItemActionsCA extends ChildNodeCA<TopicItem> {}

export class TopicItemActions extends ChildNode<TopicItem> {
  constructor({ ...args }: TopicItemActionsCA) {
    super(args);
  }
  static new(args: TopicItemActionsCA) {
    const me = new TopicItemActions(args);
    me.init();
    return me;
  }
  get cursor() {
    return 'pointer';
  }

  get childProps(): (keyof this & string)[] {
    return ['downloadButton', 'linkButton', 'shareButton'];
  }

  onSelect(vertex: Model.Vertex) {
    const nav = useNavigator();
    nav.openTopic(vertex, undefined, undefined);
  }

  @MemoizeOwned()
  get downloadButton() {
    const precursor = Observable.calculated(
      ({ bodyProperty }) => downloadableMimeTypes.includes(bodyProperty?.contentType ?? ''),
      {
        bodyProperty: this.parentNode.bodyProperty,
      },
    );
    return ConditionalNode.new<Button<Node>, boolean | string, TopicItemActions>({
      parentNode: this,
      precursor: precursor,
      factory: (want, parentNode) => {
        if (!want) return null;
        return Button.new({
          parentNode,
          onClick: () => {
            const bodyProperty = this.parentNode.bodyProperty.value;

            if (!bodyProperty) return;

            Behaviors.handleDownload(bodyProperty, this.parentNode.vertex);
          },
        });
      },
    });
  }
  @MemoizeOwned()
  get linkButton() {
    const precursor = Observable.calculated(
      ({ bodyProperty }) =>
        bodyProperty?.contentType === 'text/x-uri' || bodyProperty?.contentType === 'text/x-embed-uri',
      {
        bodyProperty: this.parentNode.bodyProperty,
      },
    );
    return ConditionalNode.new<Button<Node>, boolean | undefined, TopicItemActions>({
      parentNode: this,
      precursor: precursor,
      factory: (want, parentNode) => {
        if (!want) return null;
        return Button.new({
          parentNode,
          onClick: () => {
            const property = this.parentNode.bodyProperty.value;
            const contentType = property?.contentType;
            const content = property?.text.value;
            if ((contentType === 'text/x-uri' || contentType === 'text/x-embed-uri') && content) {
              void navigator.clipboard.writeText(content);
              toast.info('Link copied to clipboard!', {
                type: TYPE.INFO,
                autoClose: 2000,
                hideProgressBar: true,
                closeOnClick: true,
                draggable: false,
                position: POSITION.TOP_CENTER,
              });
            } else {
              copyAndToast(this.parentNode.vertex.id, 'Link copied to clipboard');
            }
          },
        });
      },
    });
  }
  @MemoizeOwned()
  get shareButton() {
    const precursor = Observable.calculated(
      ({ bodyProperty }) =>
        bodyProperty?.contentType !== 'text/x-uri' && bodyProperty?.contentType !== 'text/x-embed-uri',
      {
        bodyProperty: this.parentNode.bodyProperty,
      },
    );
    return ConditionalNode.new<Button<Node>, boolean | string, TopicItemActions>({
      parentNode: this,
      precursor: precursor,
      factory: (want, parentNode) => {
        if (!want) return null;
        return Button.new({
          parentNode,
          onClick: () => {
            const nav = useNavigator();
            nav.openTopic(this.parentNode.vertex, undefined, { share: 'true' });
          },
        });
      },
    });
  }
}
