import { ChildNode, Node, ChildNodeCA } from './base';
import { DragItem } from '../behaviors';
import { Model, TrxRef } from '@edvoapp/common';
import * as Behaviors from '../behaviors';
import { MemberBody } from './topic-space';
import { Tab } from './extension';
import { route } from 'preact-router';
import { makeRelations } from '../utils';

interface CA extends ChildNodeCA<Node> {}

export class TabDropArea extends ChildNode<Node> {
  static new(args: CA) {
    const me = new TabDropArea(args);
    me.init();
    return me;
  }

  isDropEligible(dragItems: Behaviors.DragItem[]) {
    return !(dragItems.length === 0 || dragItems.find((i) => !(i.node instanceof Tab)));
  }

  droppable(items: Node[]): boolean {
    return items.every((x) => x instanceof Tab);
  }

  async handleDrop(items: DragItem[], dropEvent: MouseEvent, trx: TrxRef, isTransclusion: boolean): Promise<Node[]> {
    if (!this.isDropEligible(items)) return [];

    const newCard = Model.Vertex.create({ trx, name: 'Untitled' });
    this.context.focusState.setPendingFocus({
      match: (n) => n instanceof MemberBody && n.vertex == newCard,
      context: { occasion: 'create' },
    });
    newCard.accessTouch(trx);
    newCard.touch(trx);

    const nodes = (
      await Promise.all(
        items.map(async ({ node }, s) => {
          if (!(node instanceof Tab)) return null;
          const seq = s + 1;

          // const y_coordinate = s * 100;

          const vertex = await node.upsert(trx, newCard, seq, {
            // x_coordinate: 0, // TODO(SHOHEI): figure out why this causes NaN
            // y_coordinate,
            left_align: s === 0,
          });
          // if we failed to upsert for any reason, no-op
          return vertex ? node : null;
        }),
      )
    ).filter(Boolean) as Tab[];

    makeRelations(nodes, trx);

    route(`/topic/${newCard.id}`);
    return nodes;
  }
}
