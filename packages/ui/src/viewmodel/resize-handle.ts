import { ChildNode, ChildNodeCA } from './base';
import { ContentCard } from './topic-space/content-card';
import { ResizeCorner } from '../behaviors';
import { Member } from './topic-space';

interface CA extends ChildNodeCA<Member | ContentCard> {
  corner: ResizeCorner;
}

export class ResizeHandle extends ChildNode<Member | ContentCard> {
  corner: ResizeCorner;
  constructor({ corner, ...args }: CA) {
    super(args);
    this.corner = corner;
  }
  static new(args: CA) {
    const me = new ResizeHandle(args);
    me.init();
    return me;
  }

  get cursor() {
    switch (this.corner) {
      case 'n':
      case 's':
        return 'ns-resize';
      case 'w':
      case 'e':
        return 'ew-resize';
      case 'ne':
      case 'sw':
        return 'nesw-resize';
      case 'nw':
      case 'se':
        return 'nwse-resize';
      default:
        return 'default';
    }
  }
}
