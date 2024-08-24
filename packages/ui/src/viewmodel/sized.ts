import { Node } from './base';
import { ObservableReader } from '@edvoapp/util';
import { Model, TrxRef } from '@edvoapp/common';

export interface Sized extends Node {
  sizeObs: ObservableReader<Model.SizedState>;
  getSize: () => Promise<Model.SizedState>;
  setSize: (arg0: { trx: TrxRef; size: Model.SizedState }) => Promise<void>;
}

export function isSized(obj: Node): obj is Sized {
  return 'getSize' in obj && 'setSize' in obj && 'sizeObs' in obj;
}
