import { MemoizeOwned } from '@edvoapp/util';
import { VertexNode, ListNode, VertexNodeCA } from '../base';
import { PropertyConfig, TextField } from '../text-field';
import { Model } from '@edvoapp/common';

interface CA extends VertexNodeCA {
  isSpaceChat: boolean;
}
export class ConversationLabel extends VertexNode {
  isSpaceChat: boolean;
  constructor({ isSpaceChat, ...args }: CA) {
    super(args);
    this.isSpaceChat = isSpaceChat;
  }
  static new(args: CA) {
    const me = new ConversationLabel(args);
    me.init();
    return me;
  }
  // ALL participants, here for sharing purposes
  @MemoizeOwned()
  get _participants() {
    return this.vertex.filterEdges(['participant']);
  }

  get childProps(): (keyof this & string)[] {
    return ['participants'];
  }

  @MemoizeOwned()
  get name() {
    return this.vertex
      .filterProperties({ role: ['name'] })
      .firstObs()
      .mapObs<string | undefined>((p) => p?.text);
  }
  // All participants other than me
  @MemoizeOwned()
  get participants() {
    return ListNode.new<this, TextField, Model.Vertex>({
      precursor: this._participants.filterMapObs<Model.Vertex>((edge) => {
        if (edge.target !== this.context.currentUser.value) {
          return edge.target;
        }
      }),
      parentNode: this,
      factory: (vertex, parentNode) => {
        return TextField.new({
          parentNode,
          fitContentParent: null,
          not_updatable: true,
          propertyConfig: PropertyConfig.fromVertex({
            vertex,
            contentType: 'text/plain',
            role: ['full-name'],
            visibleUserIDsForDescendants: this.visibleUserIDsForDescendants,
          }),
        });
      },
    });
  }
}
