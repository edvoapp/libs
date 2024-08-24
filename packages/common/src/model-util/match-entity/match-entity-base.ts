import { EdvoObj, OwnedProperty } from '@edvoapp/util';
import { Vertex } from '../../model/vertex';

export interface DocumentSelectors {
  url?: string;
  urlRegex?: string;
  // meta
}
export interface NodeSelectors {}
export interface Matcher {
  type: 'document' | 'node';
  rule: 'allow' | 'deny';
  selectors: DocumentSelectors | NodeSelectors;
}

export interface PositionInfo {
  rect: DOMRectReadOnly;
}

export interface MatchEntityConstructorArgs {
  vertex: Vertex;
}

export abstract class MatchEntityBase extends EdvoObj {
  abstract vertex: Vertex;
}

export class MatchEntity extends MatchEntityBase {
  @OwnedProperty
  vertex: Vertex;
  constructor(args: MatchEntityConstructorArgs) {
    super();
    this.vertex = args.vertex;
  }
}
