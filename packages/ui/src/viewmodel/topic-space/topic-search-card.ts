import { ChildNodeCA, ChildNode, ConditionalNode } from '../base';
import { MemoizeOwned, Observable } from '@edvoapp/util';
import { TopicSearch } from '../topic-search';
import { TSPage } from '../page';

type Parent = ConditionalNode<TopicSearchCard, boolean, TSPage>;

interface CA extends ChildNodeCA<Parent> {}

export class TopicSearchCard extends ChildNode<Parent> {
  overflow = true;

  constructor(args: CA) {
    super(args);
    this.onCleanup(
      this.visible.subscribe((visible) => {
        if (visible)
          void this.context.focusState.setPendingFocus({
            match: (node) => node?.equals(this.topicSearch),
            context: {},
          });
      }),
    );
  }

  static new(args: CA) {
    const me = new TopicSearchCard(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['topicSearch'];
  }

  @MemoizeOwned()
  get visible() {
    return new Observable(false);
  }

  @MemoizeOwned()
  get spaceCoords() {
    return new Observable({ x: 0, y: 0 });
  }
  @MemoizeOwned()
  get coords() {
    return new Observable({ x: 0, y: 0 });
  }

  @MemoizeOwned()
  get topicSearch() {
    return TopicSearch.new({
      parentNode: this,
      fitContentParent: null,
      listMaxHeight: 200,
      emptyText: 'Include a Topic in this space',
      onSelect: (selectedTopic, trx) => {
        this.visible.set(false);
        const coords = this.coords.value;
        selectedTopic.createEdge({
          trx,
          role: ['member-of', 'tag'],
          target: this.parentNode.parentNode.vertex,
          meta: {
            x_coordinate: coords.x,
            y_coordinate: coords.y,
          },
        });
      },
    });
  }
}
