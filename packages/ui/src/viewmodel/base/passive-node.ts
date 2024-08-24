import { VertexNode, VertexNodeCA } from './vertex-node';
import { Node, NodeCA } from './view-model-node';

export interface PassiveNodeCA<Parent extends Node = Node> extends NodeCA<Parent> {}

/** I give you no children */
export class PassiveNode<Parent extends Node = Node> extends Node<Parent> {}
