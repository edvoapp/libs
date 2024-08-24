import firebase from 'firebase/compat/app';
import { getWasmBindings } from '@edvoapp/util';
import * as Bindings from '@edvoapp/wasm-bindings';
import { Store } from '../..';
import { DocumentReference, DocumentSnapshot, Query, QuerySnapshot, Timestamp, Blob, UploadTask, User } from './db';
import { ServerFunctions, collectionName } from './store_shared';

class FirebaseStoreImpl extends Store {
  constructor() {
    super();
  }

  _firestore?: firebase.firestore.Firestore;
  private get firestore() {
    this._firestore ??= firebase.app().firestore();
    return this._firestore;
  }
  _functions?: firebase.functions.Functions;
  private get functions() {
    this._functions ??= firebase.functions();
    return this._functions;
  }
  _storage?: firebase.storage.Storage;
  private get storage() {
    this._storage ??= firebase.storage();
    return this._storage;
  }

  getCurrentUser(): User | null {
    return firebase.auth().currentUser as unknown as User;
  }
  getCurrentUserID(): string {
    const uid = this.getCurrentUser()?.uid || '';
    // TODO: throwing has a bad consequence. ideally we should not even be calling getCurrentUserID if the user is not even logged in.
    // if (!uid) throw 'User is not logged in.';
    return uid;
  }

  // `createTransaction` should ONLY be called from inside trxWrap{Sync}.
  // Don't share this object
  createTransaction(name?: string): Bindings.Transaction {
    return getWasmBindings().Transaction.new(name);
  }

  // TODO: split into 2 methods:
  // - createDocumentReference(collection)
  // - getDocumentReferenceFromId(collection, id)
  createDocRef<T>(collection: string, id?: string): DocumentReference<T> {
    const docRef = this.firestore.collection(collection).doc(id) as unknown as DocumentReference<T>;
    return docRef;
  }
  createDocumentFromPath<T>(path: string): DocumentReference<T> {
    const docRef = this.firestore.doc(path) as unknown as DocumentReference<T>;
    return docRef;
  }
  createChildDocument<T, U>(parent: DocumentReference<T>, subCollection: string, docId?: string): DocumentReference<U> {
    const docRef = (parent as unknown as firebase.firestore.DocumentReference<T>)
      .collection(subCollection)
      .doc(docId) as unknown as DocumentReference<U>;
    return docRef;
  }
  async getSnapshot<T>(docRef: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
    const fireSnapshot = await (docRef as unknown as firebase.firestore.DocumentReference<T>).get();
    return fireSnapshot as unknown as DocumentSnapshot<T>;
  }
  subscribeToDocument<T>(
    docRef: DocumentReference<T>,
    onNext: (snapshot: DocumentSnapshot<T>) => void,
    onError?: (err: any) => void,
  ): () => void {
    const fireDocRef = docRef as unknown as firebase.firestore.DocumentReference<T>;
    const unsub = fireDocRef.onSnapshot(
      // includeMetadataChanges false is required to guarantee that the batch.commit() returns completion in the correct order
      { includeMetadataChanges: false },
      onNext as unknown as (snapshot: firebase.firestore.DocumentSnapshot<T>) => void,
      onError,
    );
    return unsub;
  }
  subscribeToQuery<T>(
    query: Query<T>,
    onNext: (snapshot: QuerySnapshot<T>) => void,
    onError?: (err: any) => void,
  ): () => void {
    return (query as unknown as firebase.firestore.Query<T>).onSnapshot(
      // includeMetadataChanges false is required to guarantee that the batch.commit() returns completion after the onSnapshot is received
      { includeMetadataChanges: false },
      onNext as unknown as (snapshot: firebase.firestore.QuerySnapshot<T>) => void,
      onError,
    );
  }
  createBasicQuery<T>(collection: collectionName, parent?: DocumentReference<any>): Query<T> {
    let query: firebase.firestore.CollectionReference<T> | firebase.firestore.Query<T>;
    if (parent) {
      query = (parent as unknown as firebase.firestore.DocumentReference<any>).collection(
        collection,
      ) as firebase.firestore.CollectionReference<T>;
    } else if (isSubCollection(collection)) {
      query = firebase.firestore().collectionGroup(collection) as firebase.firestore.Query<T>;
    } else {
      query = firebase.firestore().collection(collection) as firebase.firestore.CollectionReference<T>;
    }
    return query as unknown as Query<T>;
  }
  createQuery<T>(collection: collectionName, parent?: DocumentReference<any>): Query<T> {
    const query = this.createBasicQuery(collection, parent)
      .where('userID', '==', this.getCurrentUserID())
      .where('status', '==', 'active') as Query<T>;
    return query;
  }
  timestampToDate(timestamp: Timestamp): Date {
    const fireTimestamp = timestamp as unknown as firebase.firestore.Timestamp;
    return fireTimestamp.toDate();
  }
  compareTimestamps(a: Timestamp | undefined, b: Timestamp | undefined): number {
    const fireA = a as unknown as firebase.firestore.Timestamp | undefined;
    const fireB = b as unknown as firebase.firestore.Timestamp | undefined;

    const secondsA = fireA?.seconds ?? 0;
    const secondsB = fireB?.seconds ?? 0;
    if (secondsA > secondsB) return 1;
    if (secondsA < secondsB) return -1;

    const nanosA = fireA?.nanoseconds ?? 0;
    const nanosB = fireB?.nanoseconds ?? 0;
    if (nanosA > nanosB) return 1;
    if (nanosA < nanosB) return -1;

    return 0;
  }

  mergeBlobArray(blobs: Blob[]): [Uint8Array, Uint32Array] {
    const blobArray = blobs as unknown as firebase.firestore.Blob[];
    if (blobArray.length === 1) {
      const array = blobArray[0].toUint8Array();
      return [array, new Uint32Array([array.length])];
    } else {
      const uint8_Arrays = blobArray.map((blob) => blob.toUint8Array());
      const lengthArray = new Uint32Array(uint8_Arrays.length);

      let totalLength = uint8_Arrays.reduce((acc, cur) => acc + cur.length, 0);
      const outArray = new Uint8Array(totalLength);

      let offset = 0;
      uint8_Arrays.forEach((array, i) => {
        outArray.set(array, offset);
        offset += array.length;
        lengthArray.set([array.length], i);
      });
      return [outArray, lengthArray];
    }
  }
  pushToDbArray(value: Uint8Array): any {
    const blob = firebase.firestore.Blob.fromUint8Array(value);
    return firebase.firestore.FieldValue.arrayUnion(blob as unknown as Blob);
  }

  async callServerFunction<T extends keyof ServerFunctions>(
    name: T,
    args: ServerFunctions[T]['args'],
  ): Promise<ServerFunctions[T]['return']> {
    const res = await this.functions.httpsCallable(name)(args);
    return res.data as ServerFunctions[T]['return'];
  }

  createUploadTaskFromArrayBuffer(sha: string, contentType: string, arrayBuffer: ArrayBuffer): UploadTask {
    const rootRef = this.storage.ref();
    const fileRef = rootRef.child(sha);
    const uploadTask = fileRef.put(arrayBuffer, {
      contentType,
    });
    return uploadTask as unknown as UploadTask;
  }
  calculateFileUploadProgress(uploadTask: UploadTask): number {
    const task = uploadTask as unknown as firebase.storage.UploadTask;
    const snapshot = task.snapshot;
    return snapshot.bytesTransferred / snapshot.totalBytes;
  }
  subscribeToFileUploadStateChanged(uploadTask: UploadTask, onNext: () => void, onError: (e: any) => void) {
    (uploadTask as unknown as firebase.storage.UploadTask).on('state_changed', {
      next: onNext,
      error: onError,
    });
  }
  async getFileSizeFromMetadata(uploadTask: UploadTask): Promise<number> {
    const res: firebase.storage.UploadTaskSnapshot = await (uploadTask as unknown as firebase.storage.UploadTask);
    return res.metadata.size;
  }
  async getDownloadUrl(casBucket: string, sha: string): Promise<string> {
    const gsUrl = `gs://${casBucket}/${sha}`;
    const ref: firebase.storage.Reference = firebase.storage().refFromURL(gsUrl);
    const downloadUrl = await ref.getDownloadURL();
    return downloadUrl;
  }
}

export const FirebaseStore: Store = new FirebaseStoreImpl();

type RootCollectionName = 'vertex' | 'friend' | 'browser_context';
type SubCollectionName = 'edge' | 'backref' | 'property' | 'event';

function isRootCollection(collection: string): collection is RootCollectionName {
  return ['vertex', 'friend', 'browser_context'].includes(collection);
}

function isSubCollection(collection: string): collection is SubCollectionName {
  return ['edge', 'backref', 'property', 'event'].includes(collection);
}
