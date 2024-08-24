import { Model } from '@edvoapp/common';
import { MemoizeOwned, OwnedProperty } from '@edvoapp/util';
import { Node, NodeCA } from './view-model-node';
import { UpdatablesSet } from './updatables';

export interface RelationNodeCA<Parent extends Node = Node> extends Omit<NodeCA<Parent>, 'context'> {
  backref: Model.Backref;
}

export abstract class RelationNode<Parent extends Node = Node> extends Node<Parent> {
  label = 'Item';
  @OwnedProperty
  backref: Model.Backref;
  constructor({ backref, ...args }: RelationNodeCA<Parent>) {
    super({ ...args, context: args.parentNode.context });
    this.backref = backref;
  }
  @MemoizeOwned()
  get updatables(): UpdatablesSet {
    return new UpdatablesSet([this.backref]);
  }
}
