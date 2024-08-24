import { Transaction } from '@edvoapp/wasm-bindings';
import {
  Blob,
  CollectionReference,
  DocumentReference,
  DocumentSnapshot,
  Query,
  QuerySnapshot,
  Timestamp,
  UploadTask,
  User,
} from './db';
import { ServerFunctions, Store } from './store_shared';

export class MockStore extends Store {
  getCurrentUser(): User | null {
    throw new Error('Method not implemented.');
  }
  getCurrentUserID(): string {
    throw new Error('Method not implemented.');
  }
  createTransaction(name?: string | undefined): Transaction {
    throw new Error('Method not implemented.');
  }
  createDocRef<T>(collection: string, id?: string | undefined): DocumentReference<T> {
    throw new Error('Method not implemented.');
  }
  createDocumentFromPath<T>(path: string): DocumentReference<T> {
    throw new Error('Method not implemented.');
  }
  createChildDocument<T, U>(
    parent: DocumentReference<T>,
    subCollection: string,
    docId?: string | undefined,
  ): DocumentReference<U> {
    throw new Error('Method not implemented.');
  }
  getSnapshot<T>(docRef: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
    throw new Error('Method not implemented.');
  }
  subscribeToDocument<T>(
    docRef: DocumentReference<T>,
    onSnapshot: (snapshot: DocumentSnapshot<T>) => void,
    onError?: ((err: any) => void) | undefined,
  ): () => void {
    throw new Error('Method not implemented.');
  }
  subscribeToQuery<T>(
    query: Query<T>,
    onSnapshot: (snapshot: QuerySnapshot<T>) => void,
    onError?: ((err: any) => void) | undefined,
  ): () => void {
    throw new Error('Method not implemented.');
  }
  createBasicQuery<T>(collection: string, parent?: DocumentReference<any>): Query<T> {
    throw new Error('Method not implemented.');
  }
  createQuery<T>(collection: string, parent?: DocumentReference<any>): Query<T> {
    throw new Error('Method not implemented.');
  }
  timestampToDate(timestamp: Timestamp): Date {
    throw new Error('Method not implemented.');
  }
  compareTimestamps(a: Timestamp | undefined, b: Timestamp | undefined): number {
    throw new Error('Method not implemented.');
  }
  mergeBlobArray(blobs: Blob[]): [Uint8Array, Uint32Array] {
    throw new Error('Method not implemented.');
  }
  pushToDbArray(value: Uint8Array): void {
    throw new Error('Method not implemented.');
  }
  callServerFunction<T extends keyof ServerFunctions>(
    name: T,
    args: ServerFunctions[T]['args'],
  ): Promise<ServerFunctions[T]['return']> {
    throw new Error('Method not implemented.');
  }
  createUploadTaskFromArrayBuffer(sha: string, contentType: string, arrayBuffer: ArrayBuffer): UploadTask {
    throw new Error('Method not implemented.');
  }
  calculateFileUploadProgress(uploadTask: UploadTask): number {
    throw new Error('Method not implemented.');
  }
  subscribeToFileUploadStateChanged(uploadTask: UploadTask, onNext: () => void, onError: (e: any) => void) {
    throw new Error('Method not implemented.');
  }
  getFileSizeFromMetadata(uploadTask: UploadTask): Promise<number> {
    throw new Error('Method not implemented.');
  }
  async getDownloadUrl(casBucket: string, sha: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
}
