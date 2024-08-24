import { MemoizeOwned } from '@edvoapp/util';
import { ChildNode, ChildNodeCA, ConditionalNode, Node } from '../base';
import { MemberBody } from './member-body';
import { TagList } from '../tag-list';

export class MemberFooter extends ChildNode<ConditionalNode<MemberFooter, boolean, MemberBody>> {
  static new(args: ChildNodeCA<ConditionalNode<MemberFooter, boolean, MemberBody>>) {
    const me = new MemberFooter(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['tagList'];
  }
  // TODO: remove?
  height = 48;

  @MemoizeOwned()
  get tagList() {
    return TagList.new({
      parentNode: this,
      vertex: this.parentNode.parentNode.vertex,
      relationshipType: 'tag',
      label: 'tagSearchHeader',
      reverse: true,
    });
  }
}
