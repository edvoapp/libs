import { Model } from '@edvoapp/common';
import { MemoizeOwned, Observable, ObservableList, OwnedProperty } from '@edvoapp/util';
import { Name } from './name';
import { Node, VertexNode, VertexNodeCA } from './base';

interface PinnedTopicCA extends VertexNodeCA {
  property?: Model.Property;
}

// todo: inherit PropertyNode
export class PinnedTopic extends VertexNode {
  @OwnedProperty
  readonly property?: Model.Property;
  get cursor() {
    return 'pointer';
  }
  constructor(args: PinnedTopicCA) {
    super(args);
    this.property = args.property;
  }
  static new(args: PinnedTopicCA) {
    const me = new PinnedTopic(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['topicName'];
  }

  @MemoizeOwned()
  get topicName() {
    return Name.new({
      parentNode: this,
      vertex: this.vertex,
      context: this.context,
      readonly: true,
      allowHover: true,
    });
  }
}
