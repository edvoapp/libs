import { Node as VMNode, VertexNode, VertexNodeCA, ChildNode, ChildNodeCA } from './base';

import { Model, TrxRef, subTrxWrapSync } from '@edvoapp/common';
import { Guarded, MemoizeOwned, OwnedProperty } from '@edvoapp/util';
import { Behavior, DispatchStatus, EventNav, useNavigator } from '../service';
import { UpdatablesSet } from './base/updatables';
import { TextEmbed } from './text-field';
import { Clickable } from '../behaviors';
import { CloneContext } from '../utils';

interface RawLozengeCA extends VertexNodeCA<VMNode> {}

interface LozengeCA<R extends EntRelation | undefined> extends RawLozengeCA {
  relationshipType: R extends undefined ? undefined : string;
  relation: R;
}

type LozengeNewCA<R extends EntRelation> = Omit<LozengeCA<R>, 'vertex'>;

export type EntRelation = Model.Backref | Model.Edge;

// This is not a branchNode because this could represent an edge TO something or an edge FROM something
// It also represents an actual vertex, which is why it is a vertex node (as opposed to a node that simply requires a vertex)
export class Lozenge<R extends EntRelation | undefined = undefined> extends VertexNode<VMNode> implements Clickable {
  relationshipType: R extends undefined ? undefined : string;
  allowHover = true;
  @OwnedProperty
  relation: R;

  private constructor(args: LozengeCA<R>) {
    super(args);
    this.relationshipType = args.relationshipType;
    this.relation = args.relation;
  }

  static new<R extends EntRelation>(args: LozengeNewCA<R>) {
    const me = new Lozenge({ ...args, vertex: args.relation.target });
    me.init();
    return me;
  }

  static raw(args: RawLozengeCA) {
    const me = new Lozenge({
      ...args,
      relationshipType: undefined,
      relation: undefined,
    });
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['lozengeCloseButton'];
  }

  @MemoizeOwned()
  get lozengeCloseButton(): LozengeCloseButton {
    return LozengeCloseButton.new({ parentNode: this });
  }

  @MemoizeOwned()
  get updatables(): UpdatablesSet {
    // only share the backref/edge if it is a part of Text
    return this.parentNode instanceof TextEmbed && this.relation
      ? new UpdatablesSet([this.relation, this.topicNameProp])
      : new UpdatablesSet([
          // Do not share tags for now, but if it is shared, then share its name.
          // this.relation,
          // this.topicNameProp,
        ]);
  }

  getLocalBehaviors(): Behavior[] {
    return [new LozengeBehaviors()];
  }

  archiveRelation(trx: TrxRef | null) {
    const rel = this.relation;
    rel && subTrxWrapSync(trx, (trx) => rel.archive(trx));
  }

  get cursor() {
    return 'pointer';
  }

  @MemoizeOwned()
  get topicNameProp() {
    return this.vertex
      .filterProperties({
        role: ['name'],
        userID: this.parentNode.visibleUserIDsForDescendants,
      })
      .firstObs();
  }

  @MemoizeOwned()
  get topicName() {
    return this.topicNameProp.mapObs<string | null | undefined>((p) => (p ? p.text : p));
  }

  onClick(e: MouseEvent) {
    const nav = useNavigator();
    nav.openTopic(this.vertex);
  }

  /**
   * overwriting VertexNode.shallowClone because we want to clone the lozenge relationship and name, if allowed.
   */
  @Guarded
  async shallowClone(_targetParentVertex: Model.Vertex, cloneContext: CloneContext): Promise<Model.Vertex | null> {
    const topicNameProp = await this.topicNameProp.get();
    const targetVertex = cloneContext.cloneVertex(this.vertex);
    if (!this.relation) return null;
    const parentVertex = cloneContext.cloneVertex(this.relation.parent);
    if (topicNameProp) cloneContext.cloneProperty(targetVertex, topicNameProp);
    if (this.relation instanceof Model.Backref) {
      cloneContext.cloneBackref(parentVertex, targetVertex, this.relation);
    } else if (this.relation instanceof Model.Edge) {
      cloneContext.cloneEdge(targetVertex, parentVertex, this.relation);
    }
    return null;
  }
}

class LozengeBehaviors extends Behavior {
  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: VMNode): DispatchStatus {
    const node = originNode.findClosest((n) => n instanceof Lozenge && n);
    if (!node) return 'decline';

    if (e.key === 'Backspace' || e.key === 'Delete') {
      node.archiveRelation(null);
      return 'stop';
    }
    return 'decline';
  }
}

class LozengeCloseButton extends ChildNode<Lozenge<EntRelation | undefined>> implements Clickable {
  static new(args: ChildNodeCA<Lozenge<EntRelation | undefined>>): LozengeCloseButton {
    const me = new LozengeCloseButton(args);
    me.init();
    return me;
  }
  onClick(_e: MouseEvent): void {
    this.close(null);
  }

  close(trx: TrxRef | null) {
    this.parentNode.archiveRelation(trx);
  }
}
