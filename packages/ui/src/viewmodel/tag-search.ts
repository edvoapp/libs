// DEPRECATED

import { ChildNode, ChildNodeCA, ConditionalNode, ListNode, Node } from './base';
import { MemoizeOwned, Observable, OwnedProperty } from '@edvoapp/util';
import { Model } from '@edvoapp/common';
import { Lozenge } from './lozenge';
import { TagSearchInput } from './tag-search-input';

interface CA extends ChildNodeCA<Node> {
  vertex: Model.Vertex;
  relationshipType: string;
  reverse?: boolean;
  readonly?: boolean;
}

// displays members and an input for creating new tags
/**
 * @deprecated use VM.TopicSearch instead
 */
export class TagSearch extends ChildNode<Node> {
  @OwnedProperty
  vertex: Model.Vertex;
  relationshipType: string;
  reverse = false;
  readonly = false;

  constructor({ vertex, relationshipType, reverse = false, readonly = false, ...args }: CA) {
    super(args);
    this.vertex = vertex;
    this.relationshipType = relationshipType;
    this.reverse = reverse;
    this.readonly = readonly;
  }

  static new(args: CA) {
    const me = new TagSearch({ ...args, reverse: false });
    me.init();
    return me;
  }

  static reverse(args: CA) {
    const me = new TagSearch({ ...args, reverse: true });
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['members', 'tagSearchInput'];
  }

  @MemoizeOwned()
  get members():
    | ListNode<this, Lozenge<Model.Backref>, Model.Backref>
    | ListNode<this, Lozenge<Model.Edge>, Model.Edge> {
    return this.reverse ? this.backrefs() : this.edges();
  }

  @MemoizeOwned()
  get tagSearchInput(): ConditionalNode<TagSearchInput> {
    return ConditionalNode.new<TagSearchInput>({
      parentNode: this,
      precursor: new Observable(this.readonly),
      factory: (readonly, parentNode) => {
        return readonly
          ? null
          : TagSearchInput.new({
              parentNode,
            });
      },
    });
  }

  private edges() {
    const precursor = this.vertex.filterEdges([this.relationshipType]);
    return ListNode.new<this, Lozenge<Model.Edge>, Model.Edge>({
      parentNode: this,
      precursor,
      factory: (edge, parentNode) => {
        return Lozenge.new({
          parentNode,
          relation: edge,
          relationshipType: this.relationshipType,
          context: this.context,
        });
      },
    });
  }

  private backrefs() {
    const precursor = this.vertex.filterBackrefs({
      role: [this.relationshipType],
    });
    return ListNode.new<this, Lozenge<Model.Backref>, Model.Backref>({
      parentNode: this,
      precursor,
      factory: (backref, parentNode) => {
        return Lozenge.new({
          parentNode,
          relation: backref,
          relationshipType: this.relationshipType,
          context: this.context,
        });
      },
    });
  }
}
