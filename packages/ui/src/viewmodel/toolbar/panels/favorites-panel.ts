import { ListNode, Node, NodeCA } from '../../base';
import { MemoizeOwned, OwnedProperty } from '@edvoapp/util';
import { globalStore, Model } from '@edvoapp/common';
import { Toolbar } from '../toolbar';
import { TopicItem } from '../../topic-space';
import { ConditionalPanel } from '../../conditional-panel';
import { useNavigator } from '../../../service';

interface CA extends NodeCA<ConditionalPanel<FavoritesPanel, Toolbar>> {
  kind: 'pinned';
}

// If I exist, I am rendered - I don't manage my own openState
export class FavoritesPanel extends Node<ConditionalPanel<FavoritesPanel, Toolbar>> {
  @OwnedProperty
  onSelect(vertex: Model.Vertex) {
    const nav = useNavigator();
    nav.openTopic(vertex);
  }
  hasDepthMask = true;
  zIndexed = true;
  kind: 'pinned';

  constructor({ kind, ...args }: CA) {
    super({ ...args });
    this.kind = kind;
    this.zEnumerateRecurse(100_000);
  }

  static new(args: CA) {
    const me = new FavoritesPanel(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['pinnedItems'];
  }

  @MemoizeOwned()
  get pinnedItems(): ListNode<FavoritesPanel, TopicItem, Model.Property> {
    const precursor = globalStore
      .query<Model.Property>('property', null, {
        where: [
          ['userID', '==', globalStore.getCurrentUserID()],
          ['role', 'array-contains', 'pin'],
          ['status', '==', 'active'],
        ],
        // since flag properties are always freshly created, we will always be notified for new records.
        orderBy: ['updatedAt', 'desc'],
      })
      .sortObs((a, b) => globalStore.compareTimestamps(b?.updatedAt, a?.updatedAt));

    return ListNode.new<FavoritesPanel, TopicItem, Model.Property>({
      parentNode: this,
      precursor,
      label: 'Pinned Items',
      factory: (property, parentNode): TopicItem => {
        return TopicItem.new({
          draggable: true,
          nameReadonly: true,
          parentNode,
          vertex: property.parent,
          context: parentNode.context,
          singleLine: false,
          alwaysShowAddTagButton: false,
          disableAddTag: true,
          onSelect: this.onSelect.bind(this),
        });
      },
    });
  }
}
