import firebase from 'firebase/compat/app';

import { DocumentReference } from './dataset/store/db';
import * as Bindings from '@edvoapp/wasm-bindings';
import { Guard, getWasmBindings } from '@edvoapp/util';
import { globalStore } from '.';

// TrxRef
// TrxHandle
export type TrxRef = Bindings.TrxRef;

// Don't port this Op to rust
type TrxOp<Out> = (trx: TrxRef) => Promise<Awaited<Out>>;
type SyncOp<Out> = (trx: TrxRef) => Awaited<Out>;

/**
 * Run the supplied Op `fn` in the context of a newly created Transaction.
 *
 * @param fn Op which will be called in the context of a Transaction.
 * @param name optional identifier to be assigned to the internally generated Transaction.
 * @returns whatever `fn` returns, but wrapped in a Promise.
 */
export function trxWrap<Out, R = Awaited<Out>>(
  fn: TrxOp<R>, // Root operation
  name?: string,
): Promise<R> {
  // globalStore.createTransaction should ONLY be called from inside trxWrap{Sync} Don't share this object
  const trx: Bindings.Transaction = globalStore.createTransaction(name);

  // Create a reference that's safe to share with the rest of the program
  const trxRef: Bindings.TrxRef = trx.get_ref()!;

  return Guard.while({ trx, trxRef }, async ({ trx, trxRef }) => {
    const out = await fn(trxRef);
    await trx.apply();
    return out;
  });
}

export function trxWrapSync<Out, R = Awaited<Out>>(
  fn: SyncOp<R>, // Root operation
  name?: string,
): R {
  // globalStore.createTransaction should ONLY be called from inside trxWrap{Sync} Don't share this object
  const trx: Bindings.Transaction = globalStore.createTransaction(name);

  // Create a reference that's safe to share with the rest of the program
  const trxRef: Bindings.TrxRef = trx.get_ref()!;
  // Keep trxRef and trx alive while the trx is applying
  const g = Guard.unsafe({ trxRef, trx });
  const out: R = fn(trxRef);
  void trx.apply().finally(() => g.release());
  return out;
}

globalThis.trxWrap = trxWrap;
globalThis.trxWrapSync = trxWrapSync;

/**
 * Nestable form of trxWrap which can be used with or without a transaction.
 * This allows for separation of concerns within state manipulation logic,
 * with flexible composition, and without dictating transaction containment
 * This is a synchronous function that returns a promise to ensure that the promise controller
 * gets created without needing to await any value. The caller of this function may await the returned
 * promise if it needs the return value of fn.
 *
 * @param trx optional transaction
 * @param fn Op which will be called in the context of a Transaction.
 * @param name optional identifier to be assigned to the internally generated Transaction.
 * @returns whatever `fn` returns, but wrapped in a Promise.
 */
export function subTrxWrap<Out, R = Awaited<Out>>(trx: TrxRef | null, fn: TrxOp<R>, name?: string): Promise<R> {
  if (!trx || !trx.isPending) return trxWrap(fn, name);

  // Prevents the transaction to be applied before
  // the operation is completed
  let controller = createPromiseController<undefined>();
  trx.addOp(undefined, (_trx) => controller.promise);

  // Applying the transaction is the responsibility of the topmost [sub]trxWrap
  return new Promise<R>((resolve, reject) => {
    try {
      let result = fn(trx);
      resolve(result);
    } catch (e) {
      reject(e);
    }
  }).finally(() => {
    controller.resolve(undefined);
  });
}

export function subTrxWrapSync<Out, R = Awaited<Out>>(trx: TrxRef | null, fn: SyncOp<R>, name?: string): R {
  if (!trx || !trx.isPending) return trxWrapSync(fn, name);

  // Applying the transaction is the responsibility of the topmost [sub]trxWrap
  return fn(trx);
}

export function asTransaction<T>(val: T): TrxRef | null {
  if (val instanceof getWasmBindings().TrxRef) {
    return val as TrxRef;
  } else {
    return null;
  }
}

export type ObjValue = { [k: string]: JsonValue };
export type JsonValue = null | string | number | boolean | JsonValue[] | ObjValue;

export type FireFieldValue = JsonValue | firebase.firestore.FieldValue | any; // TODO: avoid any

export type FireObjValue = {
  [k: string]: FireFieldValue;
};

export class FireBatch {
  private constructor(readonly batch: firebase.firestore.WriteBatch) {}
  static create(): FireBatch {
    const db = firebase.firestore();
    return new FireBatch(db.batch());
  }

  set(docRef: DocumentReference, data: {}, merge: boolean) {
    this.batch.set(docRef as any, data, { merge });
  }
  delete(docRef: DocumentReference) {
    this.batch.delete(docRef as any);
  }

  commit(): Promise<void> {
    return this.batch.commit();
  }
}

function createPromiseController<T, V = Awaited<T>>() {
  let resolve: ((val: V | PromiseLike<V>) => void) | undefined = undefined;
  let reject: ((e?: any) => void) | undefined = undefined;
  let promise: Promise<V> = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}
