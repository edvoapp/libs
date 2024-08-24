import firebase from 'firebase/compat/app';

// Auth
export interface User {
  uid: string;
  email: string | null;

  isAnonymous: boolean;
  getIdToken(forceRefresh?: boolean): Promise<string>;
  readonly __authType: 'User';
}

// DB
export type DocumentData = { [field: string]: any };
export type WhereFilterOp =
  | '<'
  | '<='
  | '=='
  | '!='
  | '>='
  | '>'
  | 'array-contains'
  | 'in'
  | 'array-contains-any'
  | 'not-in';
export type OrderByDirection = 'desc' | 'asc';

export interface Query<T = DocumentData> {
  get(): Promise<QuerySnapshot<T>>;
  where(fieldPath: string, opStr: WhereFilterOp, value: any): Query<T>;
  orderBy(fieldPath: string, directionStr?: OrderByDirection): Query<T>;
  limit(limit: number): Query<T>;
  startAfter(after: Timestamp | Date | DocumentSnapshot<any> | null): Query<T>;
  startAt(at: Timestamp | Date | DocumentSnapshot<any>): Query<T>;
  endAt(timestamp: Timestamp | Date): Query<T>;

  readonly __dbType: 'Query';
}
export interface DocumentReference<T = DocumentData> {
  readonly id: string;
  // TODO: move to rust
  // serialization of the DocRef
  readonly path: string;
  readonly __dbType: 'DocumentReference';
  get(): Promise<DocumentSnapshot<T>>;

  // Temporal
  readonly parent: CollectionReference<T>;
}
export interface CollectionReference<T = DocumentData> {
  parent: DocumentReference<DocumentData> | null;
  readonly __dbType: 'CollectionReference';
}
export interface DocumentSnapshot<T = DocumentData> {
  readonly ref: DocumentReference<T>;
  get exists(): boolean;
  data(): T;
  readonly __dbType: 'DocumentSnapshot';
}

export interface QuerySnapshot<T = DocumentData> {
  readonly empty: boolean;
  readonly size: number;
  readonly docs: DocumentSnapshot<T>[];
  readonly metadata: {
    readonly fromCache: boolean;
  };
  readonly __dbType: 'QuerySnapshot';
}
export interface Timestamp {
  readonly __dbType: 'Timestamp';
  toMillis(): number;
}

export interface Blob {
  readonly __dbType: 'Blob';
}

// Real-time
export type DataSnapshot = firebase.database.DataSnapshot;

// Storage
export interface UploadTask {
  cancel(): boolean;
  readonly __storageType: 'UploadTask';
}
