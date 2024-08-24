import { ChildNode, ChildNodeCA, ConditionalNode, Node, VertexNode } from './base';
import { Behavior, DispatchStatus, EventNav } from '../service';
import { TagList } from './tag-list';
import { MemoizeOwned, Observable } from '@edvoapp/util';

// type Parent = ConditionalNode<AddTag, boolean, TagList>;
type Parent = TagList;

interface CA extends ChildNodeCA<Parent> {
  showTooltip?: boolean;
}

export class AddTag extends ChildNode<Parent> {
  allowHover = true;
  showTooltip?: boolean;

  constructor({ showTooltip = false, ...args }: CA) {
    super(args);
    this.showTooltip = showTooltip;
  }

  static new(args: CA) {
    const me = new AddTag(args);
    me.init();
    return me;
  }

  openTopicSearch() {
    const tagList = this.closestInstance(TagList);
    if (!tagList) return;
    tagList.openTopicSearch();
    return true;
  }

  get reverse() {
    return this.parentNode.reverse;
  }

  @MemoizeOwned()
  get visible() {
    const closestHoverContext = this.findClosest((n) => n instanceof VertexNode && n);

    const alwaysShowAddTagButton = this.parentNode.alwaysShowAddTagButton;
    const readonly = this.parentNode.readonly;

    return Observable.calculated(
      ({ parentFocused, parentHovered, hover, tags, tagListFocused }) => {
        const addTagEligibility = alwaysShowAddTagButton ? true : Boolean(parentFocused || parentHovered || hover);

        return (
          // NEVER show if we have no tags...
          tags.length === 0 &&
          // NEVER show if the tagList is focused...
          !tagListFocused &&
          // NEVER show if the tagList is readonly
          !readonly &&
          // in all other cases, show if we are set to alwaysShow or our closest VertexNode is focused/hovered
          addTagEligibility
        );
      },
      {
        parentFocused: closestHoverContext?.isFocused,
        parentHovered: closestHoverContext?.hover,
        hover: this.hover,
        tags: this.parentNode.members,
        tagListFocused: this.parentNode.isFocused,
      },
    );
  }

  getLocalBehaviors(): Behavior[] {
    return [new AddTagClick()];
  }
  get cursor() {
    return 'pointer';
  }
}

class AddTagClick extends Behavior {
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const node = originNode.closestInstance(TagList);
    if (!node) return 'decline';
    node.showTopicSearch.set(true);
    return 'continue';
  }
}
