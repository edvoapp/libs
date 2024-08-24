import { VertexNode, Node, VertexNodeCA } from './base';
import { MemoizeOwned } from '@edvoapp/util';

export type AvatarSize = 'xs' | 'small' | 'small-medium' | 'medium' | 'large';

interface CA extends VertexNodeCA<Node> {
  size: AvatarSize;
  showNameAsTooltip?: boolean;
}

export class UserAvatar extends VertexNode<Node> {
  size: AvatarSize;
  showNameAsTooltip?: boolean;

  constructor({ size, showNameAsTooltip, ...args }: CA) {
    super(args);
    this.size = size;
    this.showNameAsTooltip = showNameAsTooltip;
  }

  static new(args: CA) {
    const me = new UserAvatar(args);
    me.init();
    return me;
  }

  @MemoizeOwned()
  get fullName() {
    return this.vertex
      .filterProperties({ role: ['full-name'] })
      .firstObs()
      .mapObs<string | undefined>((p) => p?.text);
  }

  @MemoizeOwned()
  get email() {
    return this.vertex
      .filterProperties({ role: ['email'] })
      .firstObs()
      .mapObs<string | undefined>((p) => p?.text);
  }

  @MemoizeOwned()
  get image() {
    return this.vertex.filterProperties({ role: ['avatar-image'] }).firstObs();
  }
}
