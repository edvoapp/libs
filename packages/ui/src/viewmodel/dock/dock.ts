import { globalStore, Model, subTrxWrap, TrxRef, trxWrap } from '@edvoapp/common';
import { MemoizeOwned } from '@edvoapp/util';
import { ListNode, VertexNode, VertexNodeCA, Node } from '../base';
import { DragItem } from '../../behaviors';
import { DockItem } from './dock-item';
import { Member } from '../topic-space';
import { ContentCard } from '../topic-space/content-card';
import { DockItemBody } from './dock-item-body';
import { DockTab } from './dock-tab';

// TODO: these should be three separate VM Nodes
export class Dock extends VertexNode {
  static new(args: VertexNodeCA) {
    const me = new Dock(args);
    me.init();
    return me;
  }
  hasDepthMask = true;
  zIndexed = true;
  overflow = true;
  get childProps(): (keyof this & string)[] {
    return ['members'];
  }
  static async getVertex(
    user: Model.Vertex,
    // side: DockSide,
  ): Promise<Model.Vertex> {
    // TODO - update this to search for a backref from the user vertex rather than a collectionGroup query
    let [vertex] = await globalStore
      .query<Model.Vertex>('vertex', null, {
        where: [
          ['kind', '==', 'dock'],
          ['userID', '==', user.id],
        ],
      })
      .get();

    // null is returned if it is explicitly not found in the db

    if (!vertex) {
      vertex = await trxWrap(async (trx) => {
        return Model.Vertex.create({ trx, kind: 'dock' });
      });
    }
    return vertex;
  }

  @MemoizeOwned()
  get members() {
    return ListNode.new<Dock, DockItem, Model.Backref>({
      parentNode: this,
      precursor: this.vertex.filterBackrefs({
        role: ['dock-south'],
        userID: this.parentNode?.visibleUserIDsForDescendants,
      }),
      factory: (backref, parentNode) =>
        DockItem.new({
          parentNode,
          vertex: backref.target,
          backref,
          context: parentNode.context,
        }),
    });
  }

  isDropEligible(dragItems: DragItem[]) {
    if (dragItems.length === 0 || dragItems.find((i) => !(i.node instanceof Member))) return false;
    return true;
  }
  // TODO: Consider moving drop behavior into... a Behavior and have DragDrop scan for that?

  async handleDrop(dragItems: DragItem[], event: MouseEvent, trx: TrxRef): Promise<Node[]> {
    const { clientX: clientMouseX } = event;
    const items = await Promise.all(
      dragItems.map(async (item) => {
        const node = item.node as Member | ContentCard | DockItemBody | DockTab;
        if (!this.droppable([node])) return;
        const oldParent = node.parentNode?.parentNode;

        if (!oldParent) {
          console.warn('parent failure', node);
          return;
        }

        // sever old relationships, create new ones!
        const backref =
          node instanceof Member || node instanceof DockItemBody || node instanceof DockTab ? node.backref : null;
        const vertex = node.vertex;
        const metaContainer = backref || vertex;
        if (!oldParent.equals(this)) {
          // moving from space to dock
          if (!metaContainer?.editable.value) return;
          const meta = (await metaContainer.meta.get()) || {};
          vertex.createEdge({
            trx,
            role: ['dock-south'],
            target: this.vertex,
            seq: 0,
            meta: {
              ...meta,
              dockCoordinate: clientMouseX,
              // note: if we add other docks on the left/right, we will want this to be y_coordinate
              // this is 0 because it is positioned relative to the dock item, which is already positioned
              x_coordinate: 0,
            },
          });
          return item;
        } else {
          await metaContainer.setMetaMerge({
            trx,
            meta: {
              dockCoordinate: clientMouseX,
            },
          });
        }
      }),
    );

    return items.map((v) => v?.node).filter(Boolean) as Node[];
  }

  droppable(items: Node[]): boolean {
    return items.every(
      (x) => x instanceof Member || x instanceof ContentCard || x instanceof DockItemBody || x instanceof DockTab,
    );
  }
}
