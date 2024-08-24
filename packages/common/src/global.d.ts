import { Store } from '@edvoapp/common';

declare global {
  interface Window {
    store: Store;
  }
}
