import { Model, TrxRef, trxWrapSync } from '@edvoapp/common';
import { ChildNode, ChildNodeCA, ConditionalNode, ListNode, Node } from './base';
import { MemoizeOwned, Observable, ObservableList, OwnedProperty } from '@edvoapp/util';
import { EntRelation, Lozenge } from './lozenge';
import { AddTag } from './add-tag';
import { TopicSearch } from './topic-search';
import {
  Behavior,
  DEFAULT_CARD_DIMS,
  DEFAULT_PDF_DIMS,
  DEFAULT_PORTAL_DIMS,
  DEFAULT_WEBCARD_DIMS,
  DispatchStatus,
  EventNav,
} from '../service';
import { insertSeq } from '../utils/seq';
import { TopicItem } from './topic-space/topic-item';
import { CreateNewTopicButton } from './create-new-topic-button';
import { Member } from './topic-space';

interface CA extends ChildNodeCA<any> {
  vertex: Model.Vertex;
  relationshipType: string;
  reverse?: boolean;
  limit?: number;
  alwaysShowAddTagButton?: boolean;
  vertexTagToHide?: Model.Vertex;
  readonly?: boolean;
  disableAddTag?: boolean;
  showTooltip?: boolean;
}

export class TagList extends ChildNode<any> {
  @OwnedProperty
  vertex: Model.Vertex;
  relationshipType: string;
  reverse?: boolean;
  limit?: number;
  @OwnedProperty
  caretPosition = new Observable(0);
  alwaysShowAddTagButton?: boolean;
  @OwnedProperty
  vertexTagToHide?: Model.Vertex;
  readonly?: boolean;
  disableAddTag?: boolean;
  showTooltip?: boolean;
  overflow = true;
  constructor({
    vertex,
    relationshipType,
    reverse,
    limit,
    alwaysShowAddTagButton,
    vertexTagToHide,
    readonly,
    disableAddTag,
    showTooltip,
    ...args
  }: CA) {
    super(args);
    this.vertex = vertex;
    this.relationshipType = relationshipType;
    this.reverse = reverse;
    this.limit = limit;
    this.alwaysShowAddTagButton = alwaysShowAddTagButton;
    this.vertexTagToHide = vertexTagToHide;
    this.readonly = readonly;
    this.disableAddTag = disableAddTag;
    this.showTooltip = showTooltip;
  }
  static new(args: CA) {
    const me = new TagList(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['members', 'tagSearch', 'addTagButton'];
  }

  getHeritableBehaviors(): Behavior[] {
    return [new TopicListSelection()];
  }

  get cursor() {
    return this.readonly ? 'default' : 'text';
  }

  @MemoizeOwned()
  get sortedMembers() {
    return ((this.reverse ? this.backrefs : this.edges) as ObservableList<Model.Edge | Model.Backref>).sortObs(
      (a, b) => a.seq.value - b.seq.value || a.id.localeCompare(b.id),
    );
  }

  @MemoizeOwned()
  get sequencedMembers() {
    const sortedMembers = this.sortedMembers;
    return sortedMembers
      .mapObs((branch: Model.Edge | Model.Backref, idx) => {
        const prevSeq = sortedMembers.idx(idx - 1)?.seq.value ?? 1;
        // if backref.seq.value is 0, then we assign it prevSeq + 1
        let seq = branch.seq.value || prevSeq + 1;
        // if somehow seq is less than prevSeq, then increment seq
        // but we need a while loop to ensure that seq is always greater than prevSeq to maintain order in resortedMembers
        while (seq <= prevSeq) seq++;
        return { seq, branch };
      })
      .sortObs((a, b) => a.seq - b.seq);
  }
  @MemoizeOwned()
  get resortedMembers() {
    return this.sequencedMembers.mapObs((a) => a.branch);
  }

  @MemoizeOwned()
  get members(): ListNode<this, Lozenge<EntRelation>, EntRelation> {
    const relationshipType = this.relationshipType;
    return ListNode.new<this, Lozenge<Model.Edge | Model.Backref>, Model.Edge | Model.Backref>({
      parentNode: this,
      precursor: this.resortedMembers,
      factory: (pre, parentNode) => {
        return Lozenge.new({
          parentNode,
          relation: pre,
          relationshipType,
          context: parentNode.context,
        });
      },
    });
  }

  insertLozenge(targetVertex: Model.Vertex, trx: TrxRef) {
    const caretPosition = this.caretPosition.value;

    this.sequencedMembers.forEach(({ branch, seq }) => {
      if (branch.seq.value !== seq) {
        branch.setSeq({ trx, seq });
      }
    });
    const childBeforeCaret = this.sequencedMembers.idx(caretPosition - 1);
    // 0 caretPosition means left of the first child, so this could be undefined if we are at the end of the list
    const childAfterCaret = this.sequencedMembers.idx(caretPosition);
    let seq = insertSeq(childBeforeCaret?.branch.seq.value, childAfterCaret?.branch.seq.value);
    let defaultDims = DEFAULT_CARD_DIMS;
    const member = this.findClosest((n) => n instanceof Member && n);
    const vertex = member?.vertex;
    const appearance = member?.appearance;
    const properties = vertex?.properties;

    const pdfPart = properties?.find((part) => part.contentType === 'application/pdf');
    if (appearance?.value?.type === 'browser') {
      defaultDims = DEFAULT_WEBCARD_DIMS;
    } else if (appearance?.value?.type === 'subspace') {
      defaultDims = DEFAULT_PORTAL_DIMS;
    } else if (pdfPart) {
      defaultDims = DEFAULT_PDF_DIMS;
    }
    if (this.vertex === targetVertex) return; //sanity
    if (this.reverse) {
      targetVertex.createEdge({
        trx,
        role: [this.relationshipType, 'member-of'],
        target: this.vertex,
        seq,
        meta: {},
      });
    } else {
      this.vertex.createEdge({
        trx,
        role: [this.relationshipType, 'member-of'],
        target: targetVertex,
        seq,
        meta: { ...defaultDims },
      });
    }

    this.caretPosition.set(caretPosition + 1);
  }

  @MemoizeOwned()
  get addTagButton() {
    return AddTag.new({ parentNode: this, showTooltip: this.showTooltip });
  }

  // focusable() {
  //   return true;
  // }

  // getDescendingFocusDelegate(): Promise<Node> {
  //   return Promise.resolve(this.tagSearch);
  // }

  // getAscendingFocusDelegate(): Promise<Node> {
  //   return Promise.resolve(this.leftwardNode()?.node || this);
  // }

  @MemoizeOwned()
  get showTopicSearch() {
    return new Observable(false);
  }

  openTopicSearch(newCaretOffset?: number) {
    this.showTopicSearch.set(true);
    newCaretOffset !== undefined && this.caretPosition.set(newCaretOffset);
    const focusTarget = this.findChild((n) => n.focusable && n);
    void this.context.focusState.setFocus(focusTarget ?? this, {});
  }

  @MemoizeOwned()
  get tagSearch() {
    return ConditionalNode.new<TopicSearch, boolean, TagList>({
      precursor: this.showTopicSearch,
      parentNode: this,
      factory: (show, parentNode) =>
        show
          ? TopicSearch.new({
              parentNode,
              fitContentParent: null,
              emptyText: 'Search',
              handleBlur: () => {
                this.showTopicSearch.set(false);
              },
              onSelect: (vertex: Model.Vertex, trx: TrxRef) => {
                this.showTopicSearch.set(false);
                this.insertLozenge(vertex, trx);
                this.context.focusState.setPendingFocus({
                  match: (node) => node instanceof TopicSearch && node.parentNode.parentNode === this && node.textfield,
                  context: {},
                });
              },
            })
          : null,
    });
  }

  @MemoizeOwned()
  get edges() {
    const filteredEdges = this.vertex.filterEdges([this.relationshipType]);
    const vertexTagToHide = this.vertexTagToHide;
    return (
      filteredEdges
        // Tags to hide (ie the current space in topic-card tags, or the current topic-card in topic-item tags)
        .filterObs(({ target }) => target !== vertexTagToHide)
    );
  }

  @MemoizeOwned()
  get backrefs() {
    return this.vertex.filterBackrefs({
      role: [this.relationshipType],
    });
  }

  caretRight() {
    const caretPosition = this.caretPosition.value;

    if (caretPosition <= this.members.length) {
      if (this.members.length !== 0) {
        this.caretPosition.set(caretPosition + 1);
        return true;
      }
    }
    return false;
  }
  caretLeft() {
    const caretPosition = this.caretPosition.value;
    if (caretPosition > 0) {
      this.caretPosition.set(caretPosition - 1);
      return true;
    }
    return false;
  }

  get isSearching() {
    // TODO: this should not really care about the tag search value, but our priorities are wrong so we need to yield here.
    // for now, whenever the tagSearch has a length, we are "searching"
    if (this.tagSearch.value?.textfield.value?.length) return 'decline';
  }
}

class TopicListSelection extends Behavior {
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const node = originNode.findClosest((n) => n instanceof TagList && n);
    const closestItem = originNode.findClosest((n) => n instanceof TopicItem && n);
    const closestCreateTopicButton = originNode.findClosest((n) => n instanceof CreateNewTopicButton && n);
    if (!node) return 'decline';
    if (closestItem && closestItem.tagsReadonly) return 'decline';
    if (closestCreateTopicButton) return 'decline';

    const { clientX, clientY } = e;
    // our margin is 8, but we also have a padding of 12, so 20 should be sufficient. We don't have lozenges smaller than
    // 20px so we won't be missing anything.
    const MARGIN = 8 + 12;
    const leftNode = node.getNodeAtScreenPoint({ x: clientX - MARGIN, y: clientY }, true, (n) => n instanceof Lozenge);
    const rightNode = node.getNodeAtScreenPoint({ x: clientX + MARGIN, y: clientY }, true, (n) => n instanceof Lozenge);
    let newCaretOffset: number;
    // if we have both a leftNode AND a rightNode, we are clicking between two lozenges. Select right node's index
    if (leftNode && rightNode) {
      newCaretOffset = node.members.findChildIdx((n) => n === rightNode);
    } else if (rightNode) {
      // if we only have a rightNode, we are clicking at the beginning of the list. This means the index is 0
      newCaretOffset = 0;
    } else {
      // if we only have a leftNode, OR we have neither a leftNode nor a rightNode, then we are clicking at the end of the list. Index to the end
      newCaretOffset = node.members.length;
    }
    if (newCaretOffset < 0) return 'decline'; // this shouldn't happen, but just a sanity check

    node.openTopicSearch(newCaretOffset);
    return 'stop';
  }

  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: Node): DispatchStatus {
    const node = originNode.findClosest((n) => n instanceof TagList && n);

    if (!node) return 'decline';
    if (node.isSearching) return 'decline';

    const key = e.key.toLowerCase();
    if (key.includes('right')) {
      return node.caretRight() ? 'stop' : 'decline';
    }
    if (key.includes('left')) {
      return node.caretLeft() ? 'stop' : 'decline';
    }
    if (key === 'backspace') {
      const lozenge = node.members.idx(node.caretPosition.value - 1);
      const memberLength = node.members.length;
      lozenge && trxWrapSync((trx) => lozenge.archiveRelation(trx));

      if (node.caretLeft()) {
        if (memberLength === 1 && node.caretPosition.value === 0) {
          eventNav.focusState.setPendingFocus({
            match: (n) => n instanceof TopicSearch && n.parentNode.parentNode === node && n.textfield,
            context: {},
          });
        }
        return 'stop';
      }
      // if there is no caretLeft, then we want to actually move focus to the the tagList's previous sibling (usually the name).
      const leftwardNode = node.leftwardNode();
      if (leftwardNode) {
        void eventNav.focusState.setFocus(leftwardNode.node, leftwardNode.ctx ?? {});
      }
      return 'stop';
    }
    return 'decline';
  }
}
