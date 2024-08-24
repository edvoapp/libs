// Export the bare minimum
export { RoleBase, arrayEquals, intersection, sleep } from './utils';
export * as Util from './utils';
export * as Model from './model';
// need named export for WASM FFIs
export { UpdateContext } from './model';
export { globalStore, QueryObservable, Store, DB } from './dataset';
export { Query } from './dataset/store/db';
export { trxWrap, trxWrapSync, subTrxWrap, subTrxWrapSync, FireBatch, TrxRef, asTransaction } from './transaction';
export { firebaseNow } from './firebase';
export * as MatchEntity from './model-util/match-entity';
export * as Search from './helpers/search';
export { config } from './utils/config';
export { Registry } from './utils/registry';
export * as Analytics from './lytics';
export * as Firebase from './firebase';
export * from './types/browser-profile';

// namespace for WASM foreign function interfaces
import * as me from '.';
globalThis.edvocommon = me;

declare global {
  interface Window {
    edvocommon: typeof me;
  }
  var edvocommon: typeof me;
}
