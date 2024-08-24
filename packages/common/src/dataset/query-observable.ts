import { ObservableList, ItemEventOrigin, ChangeContext } from '@edvoapp/util';

// import { SharedQueryObservable } from './shared-query-observable';
import { Store, globalStore } from './store';
import { DocumentSnapshot, Query, QuerySnapshot } from './store/db';
import { BaseData, Entity, EntityData } from '../model/entity';

export class QueryObservable<Obj extends Entity<BaseData>> extends ObservableList<Obj> {
  query?: Query<EntityData<Obj>>;
  // sharedQuery?: SharedQueryObservable<Obj>;
  unsub?: Function | null;
  isInjected = false;
  isExecuted = false;
  protected _loaded: Promise<void>;
  protected _signalLoaded!: Function;
  protected unAcked: Obj[] = [];
  protected removed: string[] = [];
  protected _isLoaded = false;
  protected _isLoadedAuthoritatively = false;
  // The lookup defines any item that has been stored to the DB
  protected _lookup: Record<string, Obj> = {};
  protected _ctor: (doc: DocumentSnapshot<EntityData<Obj>>) => Obj;

  readonly allowCache: boolean;
  constructor({
    // store,
    val,
    ctor,
    name,
    onSubscribe,
    allowCache = true,
  }: {
    store: Store;
    val?: Obj[];
    ctor: (doc: DocumentSnapshot<EntityData<Obj>>) => Obj;
    name?: string;
    onSubscribe?: () => void;
    allowCache?: boolean;
  }) {
    super(val, name, onSubscribe);
    this._ctor = ctor;
    this._val = val || [];

    this.allowCache = allowCache;
    // TODO convert this to Observable<boolean> or similar
    // We shouldn't be rolling our own notification mechanisms in individual classes
    this._loaded = new Promise((r) => {
      this._signalLoaded = r;
    });
  }

  protected cleanup(): void {
    this.unsub?.();
    globalStore.deregisterQO(this);
    super.cleanup();
  }
  isLoaded() {
    // Important to override ObservableList because we are NOT automatically loaded
    return this._isLoaded;
  }
  injectQuery(query: Query<EntityData<Obj>>) {
    if (this.isInjected) {
      throw `Cannot inject query -- query already injected`;
    }
    if (this.unsub) {
      this.unsub();
      this.unsub = null;
      this.isExecuted = false;
    }
    this.query = query;
    this.isInjected = true;
    if (this.hasSubscribers()) this.execute();
    return this;
  }

  // It is acceptable to call this even if we don't have a query yet
  execute() {
    if (this.isExecuted) return this;

    // TODO - move this into the constructor. As it turns out, this was silly. We should have used getters rather than Awaitables
    if (this.query) {
      this.isExecuted = true;

      globalStore.registerQO(this);

      // this closure is passed to firebase and is called on snapshot changes
      this.unsub = globalStore.subscribeToQuery(
        this.query,
        (snapshot) => {
          // For some reason Firestore caching behavior really sucks.
          // Have't done a deep dive as to why, but it appears that immediately after
          // calling .get({source: server}), .onSnapshot will return fromCache:true
          // snapshots which are missing data. Madness

          this.applyQuerySnapshot(snapshot);
          if (this.allowCache || snapshot.metadata.fromCache === false) {
            this.setLoaded();
          }
        },
        (err) => {
          console.error(`QueryObservable(${this.name}).onSnapshot failed`, err);
        },
      );
    }
    return this;
  }

  // just used to bypass the cache
  async forceLoad() {
    const qs = await this.query?.get();
    if (qs) this.applyQuerySnapshot(qs);
    this.setLoaded();
    return this.value;
  }

  async load() {
    this.execute();
    if (this._isLoaded) return;
    await this._loaded;
  }
  // async awaitAuthoritativeLoad() {
  //   await this.awaitLoad();
  //   if (this._isLoadedAuthoritatively) return;

  //   try {
  //     const queryRef = await this.query!.get({ source: 'server' });
  //     this.applyQuerySnapshot(queryRef);
  //     this.setLoaded(true);
  //   } catch (e) {
  //     console.error(e);
  //   }
  // }

  // injectShared(shared: SharedQueryObservable<Obj>, subsetKey: string) {
  // throw "unimplemented";
  // if (this.isInjected) {
  //   throw `Cannot inject shared query -- ${this.sharedQuery ? 'shared' : ''} query already injected`;
  // }
  // this.sharedQuery = shared;
  // shared.subscribeSubset(subsetKey, (subsetList: QueryDocumentSnapshot<Db>[]) => {
  //   this.mergeDocs(subsetList);
  //   this.setLoaded(shared._isLoadedAuthoritatively);
  // });
  // this.isInjected = true;
  // this.isExecuted = true;

  // // consider moving execution into ConditionallyExecuteQuery
  // }

  clear() {
    this.isInjected = false;
    this.isExecuted = false;
    this._isLoaded = false;
    this._isLoadedAuthoritatively = false;
    this.query = undefined;
    // this.sharedQuery = undefined;
    this._lookup = {};
    this.unAcked = [];
    this.removed = [];
    super.clear();
  }

  applyQuerySnapshot(snapshot: QuerySnapshot<EntityData<Obj>>) {
    let changed = false;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    // console.log(`${this.name}.mergeDocs`, docs.map(doc => { const d = doc.data(); return { id: d.id, status: d.status, role: d.role, payload: d.payload } }));

    // console.warn(`QO ${this.name || ''}.applyQuerySnapshot ${JSON.stringify(snapshot.metadata)}`)
    snapshot.docChanges().forEach((docChange) => {
      const docSnapshot = docChange.doc;
      const docId = docSnapshot.id;

      let obj = this._lookup[docId];
      // console.warn(`QO ${this.name || ''}: ${docChange.type.padEnd(7, " ")} ${docChange.doc.ref.path.padEnd(56, " ")} ${(doc.data() as any).role} -> ${(doc.data() as any).payload}`)
      switch (docChange.type) {
        case 'added': {
          if (obj) {
            // console.warn(`QO ${this.name || ''}: attempt to add document already in the set:`, docId)
            obj.applySnapshot(docSnapshot);
          } else {
            const obj = this._ctor(docSnapshot);
            // TODO: re-order based on oldIndex / newIndex for modified
            const offset = this._val.length;
            this._val.push(obj);
            this._lookup[docId] = obj;
            obj.registerReferent(this, '~value');

            // TODO: Should ctx be optional be an empty obj here?

            this.fireItemListeners(obj, 'ADD', 'DATABASE', {}, offset, offset);
            changed = true;
          }
          break;
        }
        case 'modified': {
          if (obj) {
            // TODO - track how this object is loaded, and selectively suppress the .onSnapshot in the constructor to avoid duplicates
            // Should probably do this as a part of the "Store" refactor
            obj.applySnapshot(docSnapshot);
            // unclear what this will do if for some reason obj is not in the set
            const offset = this._val.findIndex((x) => x === obj);

            // TODO update the Transaction update function to keep records of the last update we sent
            // and then use that to determine the true origin of that update
            // const origin = this.determineOrigin(docSnapshot, obj._lastUpdate);
            this.fireModifyListeners(obj, 'MODIFY', 'DATABASE', {}, offset, offset);
            changed = true;
          } else {
            console.warn(`QO ${this.name || ''}: attempt to modify document which wasn't in the set`, docId);
          }
          break;
        }
        case 'removed': {
          if (obj) {
            if (globalStore.hackIgnoreActiveRemoves && !globalStore.hackIsArchived(obj.docRef)) {
              console.warn(`QO ${this.name || ''}: Ignored attempt to remove active record ${obj.prettyId()}`);
            } else {
              delete this._lookup[docId];
              this.rawRemove(obj, 'DATABASE', {});
              obj.deregisterReferent(this, '~value');
              changed = true;
            }
          } else {
            // console.warn(`QO ${this.name || ''}: attempt to remove document which wasn't in the set`, docId);
          }
          break;
        }
      }
    });

    if (changed || !this._isLoaded) {
      // TODO: Should ctx be optional be an empty obj here?
      this.fireChangeListeners('DATABASE', {});
    }
  }

  setLoaded(/*authoritative: boolean*/) {
    this._isLoaded = true;
    // if (authoritative) {
    //   this._isLoadedAuthoritatively = true;
    // }
    this._signalLoaded();
  }

  // TODO: Should ctx be optional here?
  insert(obj: Obj, origin: ItemEventOrigin = 'UNKNOWN', ctx?: ChangeContext) {
    super.insert(obj, origin, ctx || {}, true);
    this.unAcked.push(obj);
    // console.log(`QO(${this.name}).insert`, obj.prettyId(), (obj as any).status);

    if (!this._val.includes(obj)) return; // Must have gotten removed already
    const id = obj.docRef.id;
    // console.log(`QO(${this.name}).register ${obj.prettyId()} = ${id}`);
    if (this._lookup[id]) {
      throw `QueryObservable(${this.name || ''}): Duplicate detected for id: ${id} `;
    }
    // console.log('inserted with ID', id);
    this._lookup[id] = obj;
  }

  // TODO: Should ctx be optional here?
  remove(obj: Obj, origin?: ItemEventOrigin, ctx?: ChangeContext) {
    super.remove(obj, origin, ctx || {});

    // console.log(`QO(${this.name}).remove ${obj?.prettyId()}`, this._val.length)
    let objId = obj.docRef.id;
    delete this._lookup[objId];
    this.removed.push(objId); // Firestore sucks - we have to have to maintain this list of items to not add back to the set
  }

  removeWhere(pred: (val: Obj) => boolean) {
    const obj = this.find(pred);
    if (obj) {
      this.remove(obj);
    }
  }
}
