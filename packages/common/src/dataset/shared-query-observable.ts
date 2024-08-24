// import { Listener, ItemListener, ActivatableAsync, ActivatableSync } from '@edvoapp/util';
// import firebase from 'firebase/compat/app';
// import { DocumentSnapshot, Query, QueryDocumentSnapshot, QuerySnapshot } from '../firebase';
// import { QueryObservable, QueryableObj } from "./query-observable";

// export interface CollectionParent {
//   subCollection(key: string): ActivatableAsync<QueryObservable<any>> | ActivatableSync<QueryObservable<any>>;
//   id: string;
// }

// export type SubsetListener<Db> = (subsetList: QueryDocumentSnapshot<Db>[]) => void;
// export type Subset<Db, Obj> = {
//   list: QueryDocumentSnapshot<Db>[];
//   lookup: Record<string, Obj>;
//   notifyGeneration: number;
//   key: string;
// };

// let increment = 0;

// export class SharedQueryObservable<Obj extends QueryableObj<Db>> extends QueryObservable<
//   Db,
//   Obj
// > {
//   protected _listeners: {
//     ITEM_LISTENER: ItemListener<Obj>[];
//     CHANGE: Listener<Obj>[];
//     SUBSET: Record<string, SubsetListener<Db>[]>;
//   } = {
//       ITEM_LISTENER: [],
//       CHANGE: [],
//       SUBSET: {},
//     };
//   protected _subsetLookup: Record<string, Subset<Db, Obj>> = {};
//   constructor(_val: Obj[], protected _ctor: (doc: DocumentSnapshot<Db>) => Obj, _name?: string) {
//     super({ val: _val, ctor: _ctor, name: _name });
//   }

//   fireSubsetListeners(subsets: Subset<Db, Obj>[]) {
//     subsets.forEach((subset) => this._listeners.SUBSET[subset.key]?.forEach((l) => l(subset.list)));
//   }
//   subscribeSubset(key: string, listener: SubsetListener<Db>) {
//     this.execute();

//     // CONSIDER Bifurcating subsetlistener into ITEMS and CHANGE - that way we don't have to redo work in mergeDocs

//     // TODO 1 - fire this immediately if we've been loaded, or have nonzero length

//     const listeners = this._getSubsetSubscriber(key);
//     listeners.push(listener);
//     if (this._val.length !== 0 || this._isLoaded) {
//       const list = this._getSubsetLookup(key).list;
//       listener(list);
//     }

//     return () => {
//       this._listeners.SUBSET[key] = this._listeners.SUBSET[key].filter((l) => l !== listener);
//     };
//   }
//   private _getSubsetSubscriber(key: string) {
//     this._listeners.SUBSET[key] = this._listeners.SUBSET[key] || [];
//     return this._listeners.SUBSET[key];
//   }

//   private _getSubsetLookup(key: string) {
//     this._subsetLookup[key] = this._subsetLookup[key] || {
//       key,
//       list: [],
//       lookup: {},
//       notifyGeneration: 0,
//     };
//     return this._subsetLookup[key];
//   }

//   applyQuerySnapshot(docs: QuerySnapshot<Db>) {
//     throw "unimplemented"
//   //   let anythingChanged = false;
//   //   let generation = ++increment;
//   //   let subsetsChanged: Subset<Db, Obj>[] = [];
//   //   let omitted = { ...this._lookup };
//   //   docs.forEach((doc) => {
//   //     // it goes document > collection > document, so need two parents
//   //     const parentID = doc.ref.parent?.parent?.id;
//   //     if (!parentID) {
//   //       throw "This really shouldn't happen";
//   //     }
//   //     const docId = doc.id;
//   //     delete omitted[docId];
//   //     let subset = this._getSubsetLookup(parentID);
//   //     const data = this._ctor(doc);
//   //     if (!subset.lookup[docId]) {
//   //       // TODO: re-order and remove omissions
//   //       subset.list.push(doc);
//   //       subset.lookup[docId] = data;
//   //       this.fireItemListeners(data, 'ADD');
//   //       anythingChanged = true;
//   //       if (subset.notifyGeneration < generation) {
//   //         subsetsChanged.push(subset);
//   //         subset.notifyGeneration = generation;
//   //       }
//   //     }
//   //   });
//   //   Object.entries(omitted).forEach(([docId, data]) => {
//   //     delete this._lookup[docId];
//   //     this._val = this._val.filter((d) => d !== data);

//   //     this.fireItemListeners(data, 'REMOVE');
//   //     anythingChanged = true;
//   //   });
//   //   // do something with the subsets
//   //   this.fireSubsetListeners(subsetsChanged);

//   //   if (anythingChanged || !this._isLoaded) {
//   //     this.fireChangeListeners();
//   //   }
//   }
// }

// // this just does a "side effect" -- creates a query and attaches it
// // eslint-disable-next-line @typescript-eslint/no-explicit-any
// export async function doSharedQuery<ParentObj extends CollectionParent, Db, Obj>(
//   {
//     list,
//     propertyName,
//     collectionName,
//     ctor,
//     wheres,
//   }: {
//     list: ParentObj[];
//     propertyName: string;
//     collectionName: string;
//     ctor: (doc: DocumentSnapshot<Db>) => Obj;
//     wheres: [string | firebase.firestore.FieldPath, firebase.firestore.WhereFilterOp, any][];
//   },
// ): Promise<void> {
//   const firestore = firebase.app().firestore();
//   let baseQuery = firestore.collectionGroup(collectionName) as Query<Db>;

//   wheres.forEach((where) => {
//     baseQuery = baseQuery.where(...where);
//   });

//   async function queryChunk(chunk: ParentObj[]): Promise<void> {
//     // eslint-disable-next-line @typescript-eslint/ban-ts-comment
//     // @ts-ignore
//     let sqo = new SharedQueryObservable<Obj>([], ctor);

//     sqo.injectQuery(
//       baseQuery.where(
//         'parentID',
//         'in',
//         chunk.map((p) => p.id),
//       ),
//     );

//     const activations: Promise<void>[] = chunk.map((item) => {
//       const activatableSubCollection = item.subCollection(propertyName);
//       const subCollection = activatableSubCollection.value();
//       if (subCollection.isInjected) throw 'called QueryChunk with already-injected subcollection';

//       // If we start using this for Entities other than Vertex we will have to await item.docReference.get()
//       subCollection.injectShared(sqo, item.id);

//       return activatableSubCollection.activate();
//     });
//     await Promise.all(activations);
//   }

//   let chunks: Promise<void>[] = [];
//   let accumulator: ParentObj[] = [];
//   list.forEach((item) => {
//     if (item.subCollection(propertyName).value().isInjected) {
//       console.error('doSharedQuery subCollection is already injected');
//       return;
//     }
//     accumulator.push(item);
//     if (accumulator.length === 10) {
//       chunks.push(queryChunk(accumulator));
//       accumulator = [];
//     }
//   });
//   if (accumulator.length > 0) {
//     chunks.push(queryChunk(accumulator));
//   }
//   await Promise.all(chunks);
// }
