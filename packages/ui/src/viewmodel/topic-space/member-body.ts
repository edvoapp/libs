import { Guarded, MemoizeOwned, Observable, ObservableReader, OwnedProperty, tryJsonParse } from '@edvoapp/util';
import { Model, subTrxWrap, TrxRef, trxWrapSync } from '@edvoapp/common';
import { BoundingBox, ConditionalNode, ListNode, Node, VertexNode, VertexNodeCA } from '../base';
import * as Behaviors from '../../behaviors';
import { DragItem, MemberAppearance, UrlPaste } from '../../behaviors';
import { MemberFooter } from './member-footer';
import { InfinityMirror } from './infinity-mirror';
import {
  CloneContext,
  DEFAULT_CARD_DIMS,
  DEFAULT_PDF_DIMS,
  DEFAULT_PORTAL_DIMS,
  DEFAULT_WEBCARD_DIMS,
  FocusContext,
  makeRelations,
} from '../..';
import { TopicSpace } from './topic-space';
import { EmptyBrowser } from './empty-browser';
import { Outline } from '../outline/outline';
import { TopicItem, TopicListItem } from './topic-item';
import { UpdatablesSet } from '../base/updatables';
import { BodyContent } from '../body-content';
import { Member } from './member';
import { Tab } from '../extension';
import { insertSeq } from '../../utils/seq';

const GOOGLE_SEARCH = 'https://www.google.com/search?q=';

interface CA extends VertexNodeCA<Node> {
  index?: number;
  appearanceOverride?: Observable<MemberAppearance | undefined>;
  collapsible?: boolean;
  isRecent?: boolean;
}

/**
 * Member of a topic space. Each card and sticky note has a "Member" VM node.
 */
export class MemberBody extends VertexNode<Node> {
  @OwnedProperty
  appearanceOverride?: Observable<MemberAppearance | undefined>;
  allowHover = true;
  collapsible?: boolean;
  isRecent?: boolean;
  overflow = false;

  constructor({ appearanceOverride, collapsible, isRecent, ...args }: CA) {
    super(args);
    this.appearanceOverride = appearanceOverride;
    this.collapsible = collapsible;
    this.isRecent = isRecent;
  }

  static new(args: CA) {
    const me = new MemberBody(args);
    me.init();
    return me;
  }

  get cursor() {
    return (this.parentNode as Member).dragging.value === null ? 'grab' : 'grabbing';
  }

  @MemoizeOwned()
  get clientRectObs() {
    return this.parentNode?.clientRectObs ?? new Observable(BoundingBox.ZERO);
  }

  get childProps(): (keyof this & string)[] {
    return [
      'emptyBrowser',
      'outline',
      'portal',
      'content',
      'topicItems',
      // the non-sequentiality (if that is even a word) is because footer and header may be overflow items due to the topic-search menu
      // and we want these to get first dibs before body takes over
      'footer',
      // 'header',
    ];
  }

  // TODO: necessary for member header outside of topic card?
  // eslint-disable-next-line @typescript-eslint/require-await
  // async getDescendingFocusDelegate(ctx: FocusContext): Promise<Node> {
  //   if (ctx.occasion === 'create')
  //     return (
  //       this.header.value?.nameTagField.getDescendingFocusDelegate(ctx) ?? this
  //     );
  //   return this;
  // }

  @MemoizeOwned()
  get appearanceProperty(): ObservableReader<Model.Property | undefined | null> {
    return this.vertex
      .filterProperties({
        role: ['appearance'],
        userID: this.visibleUserIDsForDescendants,
      })
      .firstObs();
  }

  // @MemoizeOwned()
  // get appearance(): ObservableReader<Behaviors.MemberAppearance | undefined> {
  //   if (this.appearanceOverride) return this.appearanceOverride;
  //   return this.appearanceProperty.mapObs<
  //     Behaviors.MemberAppearance | undefined
  //   >((p) => {
  //     // Formatted for your reading pleasure o/
  //     if (typeof p === 'undefined') return undefined;
  //     if (!p) return {} as Behaviors.MemberAppearance;

  //     return p.contentState.mapObs((c) =>
  //       tryJsonParse<Behaviors.MemberAppearance>(c.to_lossy_string()),
  //     );
  //   });
  // }

  @MemoizeOwned()
  get appearance() {
    return (this.parentNode as Member)?.computedAppearance;
  }

  @MemoizeOwned()
  get content() {
    return BodyContent.new({
      vertex: this.vertex,
      parentNode: this,
    });
  }

  async getFullText() {
    // if we have an outline we should get the full text of the outline
    const outline = this.outline;
    if (outline.value) return outline.value.toMarkdown();
    // otherwise we should get the full text of the content
    return this.content.getFullText();
  }

  @MemoizeOwned()
  get fitContentObs(): ObservableReader<boolean> {
    return this.appearanceProperty.mapObs<boolean>((property) => {
      let el = property?.content.mapObs((c) => {
        const type = tryJsonParse<Behaviors.MemberAppearance>(c).type;
        return type === 'stickynote';
      });
      return el ?? false;
    });
  }

  @MemoizeOwned()
  get expanded() {
    return new Observable(true);
  }

  @MemoizeOwned()
  get members() {
    return this.vertex.filterBackrefs({
      role: ['member-of'],
      userID: this.parentNode?.visibleUserIDsForDescendants,
    });
  }

  @MemoizeOwned()
  get portal() {
    // TODO - move to portal.ts

    const precursor = Observable.calculated(
      ({ appearance }) => {
        if (appearance?.type !== 'subspace') return false;
        return true;
      },
      { appearance: this.appearance },
    );

    const parentNode = this.parentNode;

    const containsCycle = parentNode instanceof VertexNode && parentNode?.lineageContainsCycle();

    return ConditionalNode.new<InfinityMirror | TopicSpace, boolean, MemberBody>({
      pointerEvents: false,
      parentNode: this,
      precursor,
      factory: (show, parentNode): InfinityMirror | TopicSpace | null => {
        if (!show) return null;
        if (containsCycle) {
          return InfinityMirror.new({
            parentNode,
            vertex: this.vertex,
            context: this.context,
          });
        } else {
          return TopicSpace.new({
            parentNode,
            context: this.context,
            vertex: this.vertex,
          });
        }
      },
    });
  }

  // Update URL is not in BodyContent because the emptyBrowser node is dependent on there NOT being a BodyContent, and we
  // need to be able to update the URL from the empty browser
  updateUrl(inputUrl: string) {
    const url = UrlPaste.urlTidy(inputUrl)?.toString() ?? encodeURI(`${GOOGLE_SEARCH}${inputUrl}`);
    trxWrapSync((trx) => {
      if (this.content.property.value) {
        this.content.property.value.setContent(trx, url);
      } else if (url) {
        this.vertex.createProperty({
          trx,
          role: ['body'],
          contentType: 'text/x-uri',
          initialString: url,
        });
      }
    });
  }

  @MemoizeOwned()
  get emptyBrowser() {
    const precursor = new Observable(false);
    const propertyObs = this.content.property;
    const appearanceObs = this.appearance;
    const calc = () => {
      let want = false;
      const appearance = appearanceObs?.value;
      const property = propertyObs.value;
      if (appearance?.type === 'browser' && !property) want = true;
      precursor.set(want);
    };

    calc();

    precursor.managedSubscription(propertyObs, calc);
    if (appearanceObs) precursor.managedSubscription(appearanceObs, calc);

    return ConditionalNode.new<EmptyBrowser>({
      parentNode: this,
      precursor,
      factory: (want, parentNode) => {
        if (!want) return null;
        return EmptyBrowser.new({
          vertex: this.vertex,
          parentNode,
          context: this.context,
        });
      },
    });
  }

  @MemoizeOwned()
  get outline() {
    const body = this.vertex
      .filterProperties({
        role: ['urlReference', 'body'],
        userID: this.visibleUserIDsForDescendants,
      })
      .firstObs();

    const precursor = Observable.calculated(
      ({ body, appearance }) => {
        return !(body || ['stickynote', 'subspace'].includes(appearance?.type ?? ''));
      },
      {
        body,
        appearance: this.appearance,
      },
    );

    return ConditionalNode.new<Outline, boolean>({
      parentNode: this,
      precursor,
      factory: (want, parentNode) =>
        want
          ? Outline.new({
              parentNode,
              context: this.context,
              vertex: this.vertex,
            })
          : null,
    });
  }

  @MemoizeOwned()
  get sortedMembers() {
    return (
      this.vertex
        .filterBackrefs({
          role: ['tag'],
          userID: this.parentNode?.visibleUserIDsForDescendants,
        })
        // this is simply a deterministic way to render the items. On save, every items sequence will be saved.
        .sortObs((a, b) => {
          return a.seq.value - b.seq.value || a.id.localeCompare(b.id);
        })
    );
  }

  @MemoizeOwned()
  get sequencedMembers() {
    const sortedMembers = this.sortedMembers;
    return sortedMembers
      .mapObs((branch: Model.Backref, idx) => {
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
  get topicItems() {
    return ListNode.new<MemberBody, TopicListItem, Model.Backref>({
      parentNode: this,
      precursor: this.resortedMembers,
      factory: (backref, parentNode) =>
        TopicListItem.new({
          parentNode,
          backref,
          vertex: backref.target,
          context: this.context,
          label: 'Item',
        }),
    });
  }

  @MemoizeOwned()
  get footer(): ConditionalNode<MemberFooter, boolean, MemberBody> {
    const appearance = this.appearance;
    return ConditionalNode.new<MemberFooter, boolean, MemberBody>({
      precursor: appearance.mapObs(
        (a) => !['stickynote', 'clean', 'list', 'subspace'].includes(appearance.value?.type ?? ''),
      ),
      parentNode: this,
      factory: (want, parentNode) => (want ? MemberFooter.new({ parentNode }) : null),
    });
  }

  @MemoizeOwned()
  get updatables(): UpdatablesSet {
    return new UpdatablesSet([this.appearanceProperty]);
  }

  droppable(items: Node[]): boolean {
    // for now, only allow member body to be droppable if its a list.
    // eventually, it'd be neat to be able to drop TopicItems into portals, or cards into topic lists
    if (this.appearance.value?.type !== 'list') return false;
    return items.every(
      // TODO: Change this to VertexNode | Tab
      (x) => x instanceof TopicListItem || x instanceof TopicItem || x instanceof Member || x instanceof Tab,
    );
  }

  get dragHandle(): boolean {
    return this.parentNode.dragHandle;
  }

  async handleDrop(dragItems: DragItem[], dropEvent: MouseEvent, trx: TrxRef): Promise<Node[]> {
    if (!this.droppable(dragItems.map((x) => x.node))) return [];

    const point = {
      x: dropEvent.clientX,
      y: dropEvent.clientY,
    };
    // are we dropping on a TopicItem?
    const topicItem = this.getNodeAtScreenPoint(point, true, (n) => n instanceof TopicItem) as TopicItem | null;
    let insertBefore = false;
    let prevSibling: TopicItem | Member | null = null;
    let nextSibling: TopicItem | Member | null = null;
    if (topicItem?.clientRect) {
      const { top, height } = topicItem.clientRect;
      const midpoint = top + height / 2;
      prevSibling = this.prevSibling() as TopicItem | Member | null;
      nextSibling = this.nextSibling() as TopicItem | Member | null;
      insertBefore = dropEvent.clientY < midpoint;
    }

    this.sequencedMembers.forEach(({ branch, seq }, idx) => {
      if (branch.seq.value !== seq) {
        branch.setSeq({ trx, seq });
      }
    });
    const nodes = (
      await Promise.all(
        dragItems.map(async (item) => {
          // TODO: change this to VertexNode | Tab
          const node = item.node as TopicListItem | TopicItem | Member | Tab;
          let seq = 0;
          if (topicItem) {
            seq = insertBefore ? insertSeq(prevSibling?.seq, this.seq) : insertSeq(this.seq, nextSibling?.seq);
          } else {
            const lastChild = this.topicItems.lastChild();
            if (lastChild) {
              seq = (lastChild.backref?.seq.value ?? 0) + 1;
            }
          }

          // TODO: we should fix this when we fix sortObs
          // // no need to create a new edge nor archive the existing one if it already belongs here, but we do need to update the seq
          // if (newParent.equals(node.parentNode?.parentNode)) {
          //   node.backref?.setSeq({ trx, seq });
          //   return null;
          // }

          if (node instanceof Tab) {
            const vertex = await node.upsert(trx, this.vertex, seq);
            if (node.tab.pinned.value) return null;
            return vertex ? node : null;
          } else {
            let defaultDims = DEFAULT_CARD_DIMS;
            const vertex = node.vertex;
            const appearanceObs = vertex
              .filterProperties({
                role: ['appearance'],
                contentType: 'application/json',
              })
              .firstObs();
            const appearance = appearanceObs.value?.text.mapObs((c) => tryJsonParse<Behaviors.MemberAppearance>(c))
              .value.type;

            const properties = vertex?.properties;

            const pdfPart = properties?.find((part) => part.contentType === 'application/pdf');

            if (appearance === 'browser') {
              defaultDims = DEFAULT_WEBCARD_DIMS;
            } else if (appearance === 'subspace') {
              defaultDims = DEFAULT_PORTAL_DIMS;
            } else if (pdfPart) {
              defaultDims = DEFAULT_PDF_DIMS;
            }
            // If this is not a Tab, it is a TopicItem, therefore just create the edge.
            node.vertex.createEdge({
              trx,
              target: this.vertex,
              role: ['member-of', 'tag'],
              seq,
              meta: { ...defaultDims },
            });
          }

          return node;
        }),
      )
    ).filter(Boolean) as Tab[];
    makeRelations(nodes, trx);
    return nodes.filter(Boolean) as Node[];
  }

  handleFocus() {
    this.portal.pointerEvents = true;
  }
  handleBlur() {
    this.portal.pointerEvents = false;
  }
  doLayout(): void {
    this.content.doLayout();
  }

  get focusable() {
    if (this.appearance.value?.type === 'clean' || this.appearance.value?.type === 'file') return true;
    return false;
  }
}
