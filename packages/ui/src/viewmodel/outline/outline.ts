import { EdvoObj, Guarded, MemoizeOwned, Observable } from '@edvoapp/util';
import equals from 'fast-deep-equal';

import { ConditionalNode, ListNode, Node, VertexNode, VertexNodeCA } from '../base';
import { OutlineItem } from './outline-item';
import { Behavior, DispatchStatus, EventNav, keyMappings } from '../../service';
import { Model, subTrxWrap, TrxRef, trxWrapSync } from '@edvoapp/common';
import { DragItem } from '../../behaviors';
import { PropertyConfig, TextField } from '../text-field';
import { BodyContent } from '../body-content';

export class Outline extends VertexNode {
  // some outline items can render outside of the outline's DOM node
  // this is actually probably because the wrong thing has overflow: auto
  overflow = true;
  transparent = true;
  focusChildOrdering: 'forward' | 'reverse' = 'reverse';

  static new(args: VertexNodeCA) {
    const me = new Outline(args);
    me.init();
    return me;
  }

  get selectable(): boolean {
    return true;
  }

  get childProps(): (keyof this & string)[] {
    return ['items', 'emptyBullet'];
  }

  getHeritableBehaviors(): Behavior[] {
    return [new SelectAllBullets()];
  }

  async toMarkdown(): Promise<string> {
    return (await Promise.all(this.items.children.map((item) => item.toMarkdown()))).join('\n');
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
  get items(): ListNode<Outline, OutlineItem, Model.Backref> {
    return ListNode.new<Outline, OutlineItem, Model.Backref>({
      parentNode: this,
      label: 'outline-list',
      precursor: this.outlineBackrefs,
      iterateChildrenForwards: true,
      factory: (backref, parentNode, index) => {
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
  get emptyBullet() {
    const itemRoles = ['category-item'];

    return ConditionalNode.new<EmptyBullet, Model.Backref | null | undefined>({
      parentNode: this,
      precursor: this.vertex
        .filterBackrefs({
          role: itemRoles,
          userID: this.parentNode?.visibleUserIDsForDescendants,
        })
        .firstObs(),
      factory: (backref, parentNode) => {
        return backref
          ? null
          : EmptyBullet.new({
              parentNode,
              context: parentNode.context,
              vertex: this.vertex,
            });
      },
    });
  }

  async handleDrop(dragItems: DragItem[], dropEvent: MouseEvent, trx: TrxRef): Promise<Node[]> {
    if (!this.droppable(dragItems.map((x) => x.node))) return [];

    const items = await subTrxWrap(
      trx,
      async (trx) =>
        await Promise.all(
          dragItems.map(({ node }) => {
            if (!(node instanceof OutlineItem)) return null;
            let seq = 0;
            const lastChild = this.items.lastChild();
            if (lastChild) {
              seq = (lastChild.seq ?? 0) + 1;
            }
            // TODO: we should fix this when we fix sortObs
            // // no need to create a new edge nor archive the existing one if its parent is already this node, but we do need to update the seq
            // if (this.equals(node.parentNode.parentNode)) {
            //   node.backref.setSeq({ trx, seq });
            //   return null;
            // }

            node.vertex.createEdge({
              trx,
              target: this.vertex,
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
}

export class EmptyBullet extends VertexNode {
  static new(args: VertexNodeCA) {
    const me = new EmptyBullet(args);
    me.init();
    return me;
  }

  get currentValue() {
    return this.textfield.value.to_lossy_string();
  }

  get childProps(): (keyof this & string)[] {
    return ['textfield'];
  }

  @MemoizeOwned()
  get textfield() {
    return TextField.new({
      parentNode: this,
      propertyConfig: PropertyConfig.unlinked({
        createProperty: (trx) => this.createVertexAndProperty(trx),
      }),
      fitContentParent: this.parentNode,
      emptyText: 'Start typing',
      readonly: new Observable(false),
    });
  }

  // text is only for backwards compatibility with handleCreate
  // if handleCreate is deleted, delete text argument too
  private createVertexAndProperty(trx: TrxRef, text?: string) {
    const itemRole = [`category-item`];

    const firstVertex = Model.Vertex.create({ trx });
    const property = firstVertex.createProperty({
      trx,
      role: ['body'],
      contentType: 'text/plain',
      initialString: text,
    });

    this.context.focusState.setPendingFocus({
      match: (node) =>
        node instanceof TextField &&
        node.parentNode?.parentNode instanceof BodyContent &&
        node.parentNode?.parentNode?.vertex === firstVertex
          ? node
          : false,
      context: {
        selectionStart: text?.length || 1,
        selectionEnd: text?.length || 1,
      },
    });

    firstVertex.createEdge({
      // <- The bullet render happens here REACT RENDER FIRES HERE
      trx,
      target: this.vertex,
      role: itemRole,
      seq: 1,
      meta: {},
    });
    return property;
  }

  /**
   * @deprecated use user events in tests
   * @param {string | undefined} text
   */
  @Guarded
  handleCreate(text?: string) {
    trxWrapSync((trx: TrxRef) => {
      this.createVertexAndProperty(trx, text);
    });
  }

  equals(other: EdvoObj): boolean {
    return other instanceof EmptyBullet;
  }
}

class SelectAllBullets extends Behavior {
  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: Node): DispatchStatus {
    const outline = originNode.findClosest((n) => n instanceof Outline && n);
    if (!outline) return 'decline';
    const sortedDk = [...eventNav.downKeys].sort();
    if (equals(keyMappings['meta-a'], sortedDk)) {
      const { selectionState } = eventNav;
      selectionState.setSelect(outline.items.children);
      return 'stop';
    }
    return 'decline';
  }
}
