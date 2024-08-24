import {
  MemoizeOwned,
  MemoizeWeak,
  Observable,
  ObservableList,
  ObservableReader,
  OwnedProperty,
  tryJsonParse,
} from '@edvoapp/util';
import { Behavior, DispatchStatus, EventNav } from '../../service';
import { BranchNode, BranchNodeCA, ListNode, Node } from '../base';
import { Model, subTrxWrap, TrxRef, trxWrap } from '@edvoapp/common';
import { Outline } from './outline';
import { BodyContent } from '../body-content';
import { OutlineItemHandle } from './outline-item-handle';
import { Draggable, DragItem, PositionAndType } from '../../behaviors';
import { insertSeq } from '../../utils/seq';
import { UpdatablesSet } from '../base/updatables';
import { Highlight } from '../../service/annotator/highlight';
import { Member, MemberBody, TSSidebar } from '../';
import { Vertex } from '@edvoapp/common/dist/model';
import { CloneContext } from '../../utils';

export interface OutlineItemAppearance {
  type: 'checkbox' | 'bullet' | 'plain' | 'highlight';
}

interface MouseAction {
  reveal_overlay_id?: string;
  test_message?: string;
}

type Parent = ListNode<Outline, OutlineItem> | ListNode<OutlineItem, OutlineItem>;

interface OutlineItemCA extends BranchNodeCA<Parent> {}

export class OutlineItem extends BranchNode<Parent> implements Draggable {
  label = 'Outline Item';
  focusChildOrdering: 'forward' | 'reverse' = 'reverse';
  static new(args: OutlineItemCA): OutlineItem {
    const me = new OutlineItem(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['contentBody', 'handle', 'items'];
  }

  get draggable() {
    return true;
  }

  @OwnedProperty
  dragging = new Observable<PositionAndType | null>(null);
  setDragging(pos: PositionAndType | null) {
    this.dragging.set(pos);
  }
  useDragProxy = true;

  @MemoizeOwned()
  get handle() {
    return OutlineItemHandle.new({
      parentNode: this,
      context: this.context,
      vertex: this.vertex,
    });
  }

  @MemoizeOwned()
  get actionProperty() {
    return this.vertex
      .filterProperties({
        role: ['action'],
        userID: this.visibleUserIDsForDescendants,
      })
      .firstObs();
  }

  @MemoizeOwned()
  get action() {
    return this.actionProperty.mapObs<MouseAction | null | undefined>((p) =>
      p?.text.mapObs<MouseAction | null>((c) => {
        try {
          return tryJsonParse<MouseAction>(c);
        } catch (err) {
          return null;
        }
      }),
    );
  }
  @MemoizeOwned()
  get hasAction() {
    return this.action.mapObs((p) => !!p);
  }

  @MemoizeOwned()
  get outlineBackrefs() {
    const itemRoles = [`category-item`];
    return this.vertex
      .filterBackrefs({
        role: itemRoles,
        userID: this.visibleUserIDsForDescendants,
      })
      .sortObs((a, b) => a.seq.value - b.seq.value);
  }

  @MemoizeOwned()
  get items() {
    let precursor;
    const containsCycle = this.lineageContainsCycle();
    if (containsCycle) {
      precursor = new ObservableList<Model.Backref>([]);
    } else {
      precursor = this.outlineBackrefs;
    }

    return ListNode.new<OutlineItem, OutlineItem, Model.Backref>({
      parentNode: this,
      precursor,
      iterateChildrenForwards: true,
      factory: (backref, parentNode, index): OutlineItem => {
        return OutlineItem.new({
          parentNode,
          index,
          vertex: backref.target,
          backref,
          context: this.context,
        });
      },
    });
  }

  @MemoizeOwned()
  get contentBody() {
    return BodyContent.new({
      vertex: this.vertex,
      parentNode: this,
      overflow: true,
      readonly: this.appearance.mapObs((a) => a?.type === 'highlight'),
    });
  }

  @MemoizeOwned()
  get updatables(): UpdatablesSet {
    return new UpdatablesSet([this.backref, this.actionProperty, this.appearanceProperty]);
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
  get appearance(): ObservableReader<OutlineItemAppearance | undefined> {
    return this.appearanceProperty.mapObs<OutlineItemAppearance | undefined>((p) => {
      // Formatted for your reading pleasure o/
      if (typeof p === 'undefined') return undefined;
      if (!p) return { type: 'bullet' };

      const jsonObs = p.text.mapObs((c) => {
        let data: OutlineItemAppearance;
        const str = c;
        try {
          data = tryJsonParse<OutlineItemAppearance>(str || '{}');
        } catch (e) {
          // legacy
          data = {
            type: str === 'highlight' ? 'highlight' : 'bullet',
          };
        }
        return data;
      });

      return jsonObs;
    });
  }

  @MemoizeOwned()
  get checkStatus(): ObservableReader<boolean> {
    return this.vertex
      .filterProperties({
        role: ['check-status'],
        contentType: 'application/json',
        userID: this.visibleUserIDsForDescendants,
      })
      .firstObs()
      .mapObs((p) => {
        const val = p?.text.value || '{}';
        try {
          const parsed = tryJsonParse<{ done?: boolean }>(val);
          return parsed.done ?? false;
        } catch (err) {
          return false;
        }
      });
  }

  handleDepart(trx: TrxRef) {
    this.backref.archive(trx);
    return true;
  }

  async handleDrop(dragItems: DragItem[], dropEvent: MouseEvent, trx: TrxRef): Promise<Node[]> {
    if (!this.droppable(dragItems.map((x) => x.node))) return [];
    if (!this.clientRect) return [];
    const { top, height } = this.clientRect;
    const midpoint = top + height / 2;
    const prevSibling = this.prevSibling() as OutlineItem | null;
    const nextSibling = this.nextSibling() as OutlineItem | null;
    const insertBefore = dropEvent.clientY < midpoint;
    // outline-items always belong to a ListNode, so we need double parentNode
    const newParent = this.parentNode.parentNode;
    if (!(newParent instanceof OutlineItem || newParent instanceof Outline)) return [];

    const items = await subTrxWrap(
      trx,
      async (trx: TrxRef) =>
        await Promise.all(
          dragItems.map(({ node }) => {
            if (!(node instanceof OutlineItem)) return null;
            const seq = insertBefore ? insertSeq(prevSibling?.seq, this.seq) : insertSeq(this.seq, nextSibling?.seq);

            // TODO: we should fix this when we fix sortObs
            // // no need to create a new edge nor archive the existing one if it already belongs here, but we do need to update the seq
            // if (newParent.equals(node.parentNode.parentNode)) {
            //   node.backref.setSeq({ trx, seq });
            //   // this is kind of hokey, but we need to sort of force-notify if we are merely changing a seq.
            //   this.outlineBackrefs.notify('USER', {});
            //   return null;
            // }

            node.vertex.createEdge({
              trx,
              target: newParent.vertex,
              role: ['category-item'],
              seq,
              meta: {},
            });
            return node;
          }),
        ),
    );
    return items.filter(Boolean) as Node[];
  }

  droppable(items: Node[]): boolean {
    return items.every((x) => x instanceof OutlineItem);
  }

  get selectable(): boolean {
    return true;
  }

  firstChildOutlineItem(): OutlineItem | null {
    return this.items.idx(0) ?? null;
  }

  deepestLastChild(): OutlineItem | null {
    const last = this.items.lastChild();
    if (!last) return null;

    const deep = last.deepestLastChild();

    if (deep) {
      return deep;
    } else {
      return last;
    }
  }

  async setAppearance(newAppearance: Partial<OutlineItemAppearance>) {
    await trxWrap(async (trx: TrxRef) => {
      const [current, ...rest] = await this.vertex
        .filterProperties({
          role: ['appearance'],
          userID: this.visibleUserIDsForDescendants,
        })
        .toArray();
      rest.forEach((p: Model.Property) => p.archive(trx));

      const currentAppearance = tryJsonParse<OutlineItemAppearance>(current?.text.value);
      const content = JSON.stringify({
        ...currentAppearance,
        ...newAppearance,
      });

      if (current) {
        current.setContent(trx, content);
      } else {
        this.vertex.createProperty({
          trx,
          role: ['appearance'],
          contentType: 'application/json',
          initialString: content,
        });
      }
    });
  }

  async toggleCheck() {
    await trxWrap(async (trx: TrxRef) => {
      const all = await this.vertex
        .filterProperties({
          role: ['check-status'],
          userID: this.visibleUserIDsForDescendants,
        })
        .toArray();

      if (all.length) {
        all.forEach((p: Model.Property) => p.archive(trx));
      } else {
        this.vertex.createProperty({
          trx,
          role: ['check-status'],
          contentType: 'application/json',
          initialString: JSON.stringify({ done: true }),
        });
      }
    });
  }

  handleFocus() {
    const type = this.appearance.value?.type;
    if (type !== 'highlight') return;

    const topicCard = this.findClosest((n) => n instanceof MemberBody && n);
    if (!topicCard) return;

    const highlight = Highlight.load({ vertex: this.vertex });
    topicCard.content.highlightManager.scrollToHighlight(highlight);
  }

  toMarkdown(tier = 0) {
    let out = '    '.repeat(tier) + '- ' + this.contentBody.value?.to_lossy_string() + '\n';
    for (const childItem of this.items.value) {
      out += childItem.toMarkdown(tier + 1);
    }
    return out;
  }

  getHeritableBehaviors(): Behavior[] {
    return [new ClickCheckbox()];
  }

  @MemoizeWeak()
  get tsSideBar(): TSSidebar | null {
    const sidebar = this.parentNode.parentNode.parentNode;
    return sidebar instanceof TSSidebar ? sidebar : null;
  }

  // overwriting so we can also clone actionProperty and appearanceProperty
  async shallowClone(targetParentVertex: Model.Vertex, cloneContext: CloneContext): Promise<Model.Vertex | null> {
    const target = await super.shallowClone(targetParentVertex, cloneContext);
    await Promise.all(
      [this.actionProperty, this.appearanceProperty].map(async (o) => {
        const val = await o.get();
        if (val && target) cloneContext.cloneProperty(target, val);
      }),
    );
    return target;
  }
}

// hacky af...
class ClickCheckbox extends Behavior {
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: Node<Node<any> | null>): DispatchStatus {
    const memberIsFocused = !!originNode.closestInstance(Member)?.isFocused.value;

    if (!(originNode instanceof OutlineItemHandle) || memberIsFocused) {
      return 'decline';
    }

    const elm = originNode.domElement;
    if (!elm) return 'decline';

    const cls = elm.className;
    const outlineItem = originNode.parentNode;

    if (cls === 'controls' && !outlineItem.tsSideBar) {
      outlineItem.toggleCheck();
      return 'stop';
    }

    return 'decline';
  }
}
