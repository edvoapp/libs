export * from './store_shared';
export * from './firebase_store_impl';
export * from './mock_store_impl';
export { FirebaseStore } from './firebase_store_impl';

import { Store } from './store_shared';
import { FirebaseStore } from './firebase_store_impl';

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
globalThis.store = FirebaseStore;
export const globalStore = FirebaseStore;

declare global {
  var store: Store;
}
