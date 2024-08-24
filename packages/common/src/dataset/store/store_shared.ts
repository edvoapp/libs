import { EdvoObj, useSessionManager } from '@edvoapp/util';
import { getWasmBindings } from '@edvoapp/util';
import * as Bindings from '@edvoapp/wasm-bindings';
import { Backref, BrowserContext, Edge, Entity, Friend, Property, TimelineEvent, Vertex } from '../../model';
import { QueryObservable } from '../..';
import { BaseData, EntityData } from '../../model/entity';
import { DocumentReference, DocumentSnapshot, Query, QuerySnapshot, Timestamp, Blob, UploadTask, User } from './db';

export type collectionName = 'vertex' | 'edge' | 'backref' | 'property' | 'event' | 'friend' | 'browser_context';

export abstract class Store extends EdvoObj {
  private hackArchivedList = new Set<string>();
  hackIgnoreActiveRemoves = false;
  constructor() {
    super();
  }
  registerArchived(docRef: DocumentReference) {
    if (!this.hackIgnoreActiveRemoves) return;
    this.hackArchivedList.add(docRef.path);
  }
  registerUnarchived(docRef: DocumentReference) {
    if (!this.hackIgnoreActiveRemoves) return;
    this.hackArchivedList.delete(docRef.path);
  }
  hackIsArchived(docRef: DocumentReference): boolean {
    return this.hackArchivedList.has(docRef.path);
  }
  get sessionManager(): Bindings.SessionManager {
    return useSessionManager();
  }

  get registry() {
    return { backref: Backref.registry, vertex: Vertex.registry };
  }

  static get collectionMap() {
    return {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vertex: { hydrate: Vertex.hydrate },
      // eslint-disable-next-line @typescript-eslint/unbound-method
      edge: { hydrate: Edge.hydrate },
      // eslint-disable-next-line @typescript-eslint/unbound-method
      backref: { hydrate: Backref.hydrate },
      // eslint-disable-next-line @typescript-eslint/unbound-method
      property: { hydrate: Property.hydrate },
      // eslint-disable-next-line @typescript-eslint/unbound-method
      event: { hydrate: TimelineEvent.hydrate },
      // eslint-disable-next-line @typescript-eslint/unbound-method
      browser_context: { hydrate: BrowserContext.hydrate },
      // eslint-disable-next-line @typescript-eslint/unbound-method
      friend: { hydrate: Friend.hydrate },
    };
  }
  makeQuery<Obj extends Entity<any>>(
    collection: collectionName,
    parent: Entity<BaseData> | null,
    { where, orderBy, limit }: QueryArgs,
  ) {
    this.trace(2, () => ['query', collection, parent?.prettyId(), where]);
    let query = this.createBasicQuery<EntityData<Obj>>(collection, parent?.docRef);

    let gotUser = false;
    where.forEach((section) => {
      if (['userID', 'recipientID'].includes(section[0].toString())) gotUser = true;
      if (section[2] === undefined) {
        // firebase is so silly -- if the third param to where is undefined, it'll throw up in a non-obvious way. Let's make it obvious
        throw new Error(`DB Query Error: [${section.join(',')}] is not a valid query`);
      }
      query = query.where(...section);
    });
    if (!gotUser) {
      throw 'must specify userID or recipientID';
    }

    if (orderBy) {
      if (Array.isArray(orderBy[0])) {
        // Assume orderBy is an array of tuples
        (orderBy as Parameters<Query['orderBy']>[]).forEach((params) => {
          query = query.orderBy(...params);
        });
      } else {
        // Assume orderBy is a single tuple
        query = query.orderBy(...(orderBy as Parameters<Query['orderBy']>));
      }
    }
    if (limit) {
      query = query.limit(limit);
    }
    return query;
  }

  query<Obj extends Entity<any>>(
    collection: collectionName,
    parent: Entity<BaseData> | null,
    { allowCache, ...qargs }: QueryArgs,
  ) {
    const query = this.makeQuery<Obj>(collection, parent, qargs);
    const cls = Store.collectionMap[collection];
    const hydrate = cls.hydrate;

    let qo = new QueryObservable<Obj>({
      query,
      store: this,
      allowCache,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      ctor: (snapshot) => {
        const { parentID } = (snapshot.data() || { parentID: '' }) as {
          parentID?: string;
        };
        let p = parent;
        if (parentID && !p) p = Vertex.getById({ id: parentID });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return hydrate({ parent: p, snapshot });
      },
      name: parent ? `${parent.prettyId()}-${collection}` : collection,
    })
      .injectQuery(query)
      .execute();

    if (parent) {
      // We need to make sure that the qo keeps the parent alive for the closure
      qo.managedReference(parent, '~ctor-parent~');
    }

    return qo;
  }

  // Just like query but returns an array not a QO
  async get<Obj extends Entity<any>>(
    collection: collectionName,
    parent: Entity<BaseData> | null,
    qargs: QueryArgs,
  ): Promise<Obj[]> {
    const query = this.makeQuery<Obj>(collection, parent, qargs);
    const cls = Store.collectionMap[collection];
    const hydrate = cls.hydrate;

    const snapshot = await query.get();
    const objs = snapshot.docs.map((doc) => {
      const { parentID } = doc.data() as { parentID?: string };
      let p = parent;
      if (parentID && !p) p = Vertex.getById({ id: parentID });
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return hydrate({ parent: p, snapshot: doc }) as Obj;
    });
    return objs;
  }

  // This is kind of goofy. Lets clean it up
  activeQueries: Set<QueryObservable<any>> = new Set();
  registerQO<Obj extends Entity<BaseData>>(qo: QueryObservable<Obj>) {
    this.activeQueries.add(qo);
  }
  deregisterQO<Obj extends Entity<BaseData>>(qo: QueryObservable<Obj>) {
    this.activeQueries.delete(qo);
  }
  get activeQueryCount() {
    return this.activeQueries.size;
  }
  get activeTransactions(): Bindings.ActiveTransactions {
    return getWasmBindings().Transaction.active_store();
  }

  abstract getCurrentUser(): User | null;
  abstract getCurrentUserID(): string;

  abstract createTransaction(name?: string): Bindings.Transaction;

  abstract createDocRef<T>(collection: string, id?: string): DocumentReference<T>;
  abstract createDocumentFromPath<T>(path: string): DocumentReference<T>;
  abstract createChildDocument<T, U>(
    parent: DocumentReference<T>,
    subCollection: string,
    docId?: string,
  ): DocumentReference<U>;
  abstract getSnapshot<T>(docRef: DocumentReference<T>): Promise<DocumentSnapshot<T>>;
  abstract subscribeToDocument<T>(
    docRef: DocumentReference<T>,
    onSnapshot: (snapshot: DocumentSnapshot<T>) => void,
    onError?: (err: any) => void,
  ): () => void;
  abstract subscribeToQuery<T>(
    query: Query<T>,
    onSnapshot: (snapshot: QuerySnapshot<T>) => void,
    onError?: (err: any) => void,
  ): () => void;
  abstract createBasicQuery<T>(collection: collectionName, parent?: DocumentReference<any>): Query<T>;
  createQuery<T>(collection: collectionName, parent?: DocumentReference<any>): Query<T> {
    const query = this.createBasicQuery(collection, parent)
      .where('userID', '==', this.getCurrentUserID())
      .where('status', '==', 'active') as Query<T>;
    return query;
  }
  abstract timestampToDate(timestamp: Timestamp): Date;

  /**
   * Returns
   * a > b : 1
   * a == b: 0
   * a < b: -1
   */
  abstract compareTimestamps(a: Timestamp | undefined, b: Timestamp | undefined): number;

  abstract mergeBlobArray(blobs: Blob[]): [Uint8Array, Uint32Array];
  abstract pushToDbArray(value: Uint8Array): void;

  abstract callServerFunction<T extends keyof ServerFunctions>(
    name: T,
    args: ServerFunctions[T]['args'],
  ): Promise<ServerFunctions[T]['return']>;

  abstract createUploadTaskFromArrayBuffer(sha: string, contentType: string, arrayBuffer: ArrayBuffer): UploadTask;
  /**
   *
   * Returns the progress of a file between 0 and 1
   */
  abstract calculateFileUploadProgress(uploadTask: UploadTask): number;

  abstract subscribeToFileUploadStateChanged(uploadTask: UploadTask, onNext: () => void, onError: (e: any) => void);

  abstract getFileSizeFromMetadata(uploadTask: UploadTask): Promise<number>;

  abstract getDownloadUrl(casBucket: string, sha: string): Promise<string>;
}

export type ServerFunctions = {
  userCreation: {
    args: { email: string; full_name: string };
    // TODO(Rasheed): set the right type
    return: any;
  };
  getContentTypeFromUrl: {
    args: { url: string };
    return: { contentType: string };
  };
  upsertPublicFileWithSize: {
    args: { url: string };
    return: { casId: string; size?: number | string };
  };
};

export interface QueryArgs {
  where: Parameters<Query['where']>[];
  orderBy?: Parameters<Query['orderBy']> | Parameters<Query['orderBy']>[];
  limit?: number;
  allowCache?: boolean;
}
