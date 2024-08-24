import { ChildNode, Node, ChildNodeCA } from './base';
import { MemoizeOwned, OwnedProperty } from '@edvoapp/util';
import { Model } from '@edvoapp/common';
import { Name } from './name';
import { TagList } from './tag-list';
import { CloneContext, FocusContext } from '..';

interface Parent extends Node {}

interface CA extends ChildNodeCA<Parent> {
  vertex: Model.Vertex;
  alwaysShowAddTagButton?: boolean;
  nameReadonly?: boolean;
  tagsReadonly?: boolean;
  vertexTagToHide?: Model.Vertex;
  disableAddTag?: boolean;
  tagLimit?: number;
  showTooltip?: boolean;
}

export class NameTagField extends ChildNode<Parent> {
  @OwnedProperty
  vertex: Model.Vertex;
  alwaysShowAddTagButton?: boolean;
  nameReadonly: boolean;
  tagsReadonly: boolean;
  disableAddTag?: boolean;
  @OwnedProperty
  vertexTagToHide?: Model.Vertex;
  tagLimit?: number;
  showTooltip?: boolean;
  constructor({
    vertex,
    alwaysShowAddTagButton,
    nameReadonly = false,
    tagsReadonly = false,
    vertexTagToHide,
    disableAddTag,
    tagLimit,
    showTooltip,
    ...args
  }: CA) {
    super(args);
    this.vertex = vertex;
    this.alwaysShowAddTagButton = alwaysShowAddTagButton;
    this.nameReadonly = nameReadonly;
    this.tagsReadonly = tagsReadonly;
    this.vertexTagToHide = vertexTagToHide;
    this.disableAddTag = disableAddTag;
    this.tagLimit = tagLimit;
    this.showTooltip = showTooltip;
  }
  static new(args: CA) {
    const me = new NameTagField(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['topicName', 'tagList'];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  // async getDescendingFocusDelegate(ctx: FocusContext): Promise<Node> {
  //   if (ctx.occasion == 'create') {
  //     ctx.selectionStart = 0;
  //     ctx.selectionEnd = 'end';
  //   }
  //   return this.topicName.getDescendingFocusDelegate(ctx);
  // }

  @MemoizeOwned()
  get topicName() {
    return Name.new({
      label: 'NameTagFieldTopicName',
      parentNode: this,
      vertex: this.vertex,
      context: this.context,
      readonly: this.nameReadonly,
      allowHover: this.allowHover,
      cursor: this.cursor,
    });
  }

  @MemoizeOwned()
  get tagList() {
    return TagList.new({
      parentNode: this,
      vertex: this.vertex,
      relationshipType: 'tag',
      label: 'NameTagFieldTagList',
      readonly: this.tagsReadonly,
      alwaysShowAddTagButton: this.alwaysShowAddTagButton,
      vertexTagToHide: this.vertexTagToHide,
      disableAddTag: this.disableAddTag,
      limit: this.tagLimit,
      showTooltip: this.showTooltip,
    });
  }

  handleBlur(): void {
    // when this gets de-focused, we want to scroll it back to the left
    if (this.domElement) this.domElement.scrollLeft = 0;
  }

  /**
   * overwriting VMNode.shallowClone because we want to ensure we traverse this node's tree, and NameTagField is not a VertexNode.
   */
  shallowClone(targetParentVertex: Model.Vertex, cloneContext: CloneContext): Promise<Model.Vertex | null> {
    return Promise.resolve(targetParentVertex);
  }
}
