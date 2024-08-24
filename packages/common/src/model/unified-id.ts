import { DocumentReference } from '../dataset/store/db';
import { globalStore } from '..';

export type CollectionName = 'vertex' | 'backref' | 'edge' | 'property';

export class UnifiedId {
  constructor(readonly collectionName: CollectionName, readonly id: string) {}
  toString(): string {
    return `${this.collectionName}:${this.id}`;
  }
  toStruct(): UnifiedIdStruct {
    switch (this.collectionName) {
      case 'vertex':
        return { vertexID: this.id };
      case 'backref':
        return { backrefID: this.id };
      case 'edge':
        return { edgeID: this.id };
      case 'property':
        return { propertyID: this.id };
      default:
        throw 'sanity error';
    }
  }
  static fromStruct(struct: UnifiedIdStruct): UnifiedId | undefined {
    if (struct.vertexID) return new UnifiedId('vertex', struct.vertexID);
    if (struct.backrefID) return new UnifiedId('backref', struct.backrefID);
    if (struct.edgeID) return new UnifiedId('edge', struct.edgeID);
    if (struct.propertyID) return new UnifiedId('property', struct.propertyID);
    return undefined;
  }
  // static fromDocRef(docRef: DocumentReference<any>) {
  //     switch (docRef.path) {
  //         case 'vertex':
  //             return new UnifiedId('vertex', docRef.id);
  //         case 'vertex/backref':
  //             return new UnifiedId('backref', docRef.id);
  //         case 'vertex/edge':
  //             return new UnifiedId('edge', docRef.id);
  //         case 'vertex/property':
  //             return new UnifiedId('property', docRef.id);
  //         default:
  //             throw (`could not find doc ref for path ${docRef.path}`)
  //     }
  // }
  toDocRef(): DocumentReference<any> {
    if (['edge', 'backref', 'property'].includes(this.collectionName)) {
      // TODO - unimplemented
      throw 'unimplemented';
    }
    return globalStore.createDocRef(this.collectionName, this.id);
  }
}
export type UnifiedIdStruct = {
  vertexID?: string;
  backrefID?: string;
  edgeID?: string;
  propertyID?: string;
  eventID?: string;
};
