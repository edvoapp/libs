import { EdvoObj, GuardedObj } from './object';

import {
  awaitObsCondition,
  AwaitCondPromise,
  ChangeContext,
  ChangeListener,
  DepValues,
  filterInPlace,
  IObservable,
  ItemEventOrigin,
  Observable,
  ObservableReader,
  paranoidForEach,
  Unsubscriber,
} from './observable';
import { Ticker } from './ticker';

export type ItemListener<T> = (
  item: T,
  type: 'ADD' | 'REMOVE' | 'MOVE',
  origin: ItemEventOrigin,
  ctx: ChangeContext,
  offset: number,
  newOffset: number | null,
) => void;

export type ModifyListener<T> = (
  item: T,
  type: 'MODIFY',
  origin: ItemEventOrigin,
  ctx: ChangeContext,
  offset: number,
  newOffset: number | null,
) => void;

export type SubscribeItemizedListeners<Obj> = {
  ITEM_LISTENER?: ItemListener<Obj>;
  CHANGE?: ChangeListener<Obj[]>;
  MODIFY_LISTENER?: ModifyListener<Obj>;
};

export type SubscribeArgs<Obj> = SubscribeItemizedListeners<Obj> | ChangeListener<Obj[]>;

export class ObservableList<Obj> extends EdvoObj implements IObservable<Obj[]> {
  protected _listeners: {
    ITEM_LISTENER: ItemListener<Obj>[];
    CHANGE: ChangeListener<Obj[]>[];
    MODIFY_LISTENER: ModifyListener<Obj>[];
  } = {
    ITEM_LISTENER: [],
    CHANGE: [],
    MODIFY_LISTENER: [],
  };
  // _val is the list of items that exist, whether created in the DB or not. Note that the ObservableList class is intended to be agnostic from any DB implementation
  protected _val: Obj[] = [];
  name?: string;
  protected loader: () => Promise<unknown>;
  _upstream?: any;
  constructor(
    _val: Obj[] | ObservableList<Obj> = [],
    name?: string,
    public onSubscribe?: () => void,
    loader?: () => Promise<unknown>,
    ctx?: ChangeContext,
  ) {
    super();
    this.name = name;
    // this is for doing notifies, otherwise we could do constructor(protected _val: Obj[] = [])
    // _val.forEach((obj) => {
    //   this.insert(obj, 'UNKNOWN', ctx);
    // });
    this.input(_val, 'DATABASE', ctx || {});
    this.loader = loader || (() => Promise.resolve(this));
  }

  protected cleanup() {
    this._listeners.ITEM_LISTENER = [];
    this._listeners.MODIFY_LISTENER = [];
    this._listeners.CHANGE = [];

    this._val.forEach((item) => {
      if (item instanceof GuardedObj) item.deregisterReferent(this, '_val');
    });

    super.cleanup();
  }

  // HACK - replace this with a proper clone
  clone() {
    return this.mapObs((v) => v);
  }

  protected _didRequestLoad = false;
  async load() {
    this._didRequestLoad = true;
    await this.loader();
  }

  isLoaded() {
    // A plain ObservableList is always loaded.
    // IMPORTANT: Subclasses should strongly consider implementing their own isLoaded method
    return true;
  }

  get key(): string {
    if (this._key) return this._key;
    this._key = (this.name || '') + '+' + Math.random().toString().substring(2);
    return this._key;
  }

  /**
   * awaitCondition is a helper function that allows you to wait for a condition to be truthy using a closure to check the condition.
   * It will return true if the condition matches, or false if the node is destroyed before the condition is met.
   */
  awaitCondition<R>(condition: (val: Obj[]) => R): AwaitCondPromise<R> {
    return awaitObsCondition(this, condition);
  }

  static _auditFn?: (
    obs: ObservableList<any>,
    type: 'ADD' | 'REMOVE' | 'MOVE' | 'MODIFY' | 'CHANGE',
    origin: ItemEventOrigin,
    ctx?: ChangeContext,
  ) => any;
  static auditObs(
    fn: (
      obs: ObservableList<any>,
      type: 'ADD' | 'REMOVE' | 'MOVE' | 'MODIFY' | 'CHANGE',
      origin: ItemEventOrigin,
      ctx?: ChangeContext,
    ) => any,
  ) {
    this._auditFn = fn;
  }
  static clearAuditObs() {
    this._auditFn = undefined;
  }
  static _track_event(
    obs: ObservableList<any>,
    type: 'ADD' | 'REMOVE' | 'MOVE' | 'MODIFY' | 'CHANGE',
    origin: ItemEventOrigin,
    ctx?: ChangeContext,
  ) {
    if (this._auditFn) {
      let rv = this._auditFn(obs, type, origin, ctx);
      if (rv) {
        console.warn('AUDIT ObservableList', { obs, origin, ctx, rv });
      }
    }
  }

  // Creates an ObservableList which is derived from one or more other observables
  static calculated<T, Deps extends Record<string, (IObservable<any> & EdvoObj) | undefined>>(
    fn: (values: DepValues<Deps>) => T[],
    deps: Deps,
  ): ObservableList<T> {
    const value = (): T[] =>
      fn(
        Object.keys(deps).reduce((acc, key) => {
          const dep = deps[key];
          if (dep) {
            acc[key as keyof Deps] = dep.value;
          }
          return acc;
        }, {} as DepValues<Deps>),
      );

    const obs = new ObservableList<T>(value(), undefined, () => Promise.all(Object.values(deps).map((d) => d?.load())));

    const calc = (_, origin: ItemEventOrigin, ctx: ChangeContext) => {
      obs.replaceAll(value(), origin, ctx);
    };

    Object.entries(deps).forEach(([dk, dep]) => {
      if (dep) {
        obs.managedReference(dep, `~${dk}`);
        obs.onCleanup(dep.subscribe(calc));
      }
    });

    return obs;
  }

  mapObsReplaceAll<Out>(f: (arg: Obj[]) => Out[], ctx: ChangeContext = {}): ObservableList<Out> {
    this.validate();
    const initialValue = f(this.value);
    // TODO:
    // * Update ObservableList to inherit from Observable
    // * In the event that initialValue is an ObservableList (or Observable) call initialValue.mapConstructor
    //    * such that Observable.mapConstructor returns new Observable, and ObservableList.mapConstructor returns FilterMapObservableList
    // Thus allowing obs.mapObs((v) new ObservableList(...v))
    const o = new ObservableList<Out>(initialValue, undefined, undefined, () => this.load());
    o.managedReference(this, '~upstream');

    let unsub = this.subscribe(() => {
      o.replaceAll(f(this.value), 'UNKNOWN', ctx);
    });

    o.onCleanup(unsub);
    return o;
  }

  ticker(): Ticker {
    this.validate();
    return new Ticker(this);
  }

  async tickOnce(): Promise<void> {
    this.validate();
    return new Promise((resolve) => {
      let unsub: () => void;
      unsub = this.subscribe(() => {
        if (unsub) {
          unsub();
        }
        resolve();
      });
    });
  }

  protected fireItemListeners(
    obj: Obj,
    op: 'ADD' | 'REMOVE' | 'MOVE',
    origin: ItemEventOrigin = 'UNKNOWN',
    ctx: ChangeContext,
    offset: number,
    newOffset: number | null,
  ) {
    this.validate();
    ObservableList._track_event(this, op, origin, ctx);
    // origin will be "USER" here
    paranoidForEach(this._listeners.ITEM_LISTENER, (l) => l(obj, op, origin, ctx, offset, newOffset));
  }
  protected fireModifyListeners(
    obj: Obj,
    op: 'MODIFY',
    origin: ItemEventOrigin = 'UNKNOWN',
    ctx: ChangeContext,
    offset: number,
    newOffset: number | null,
  ) {
    this.validate();
    // origin will be "USER" here

    ObservableList._track_event(this, 'MODIFY', origin, ctx);
    paranoidForEach(this._listeners.MODIFY_LISTENER, (l) => l(obj, op, origin, ctx, offset, newOffset));
  }

  // Fire the change listeners

  // TODO: Should both values be undefined here?
  protected fireChangeListeners(origin: ItemEventOrigin, ctx: ChangeContext) {
    this.validate();

    ObservableList._track_event(this, 'CHANGE', origin, ctx);
    paranoidForEach(this._listeners.CHANGE, (l) => l(this.value, origin, ctx));
  }

  // Fire the change listeners, with detection of when all the listeners (sync or async) are done
  // Transaction not supported for this
  protected async fireChangeListenersAsync(origin: ItemEventOrigin, ctx: ChangeContext): Promise<void> {
    this.validate();

    ObservableList._track_event(this, 'CHANGE', origin, ctx);
    await Promise.all(this._listeners.CHANGE.map((l) => l(this.value, origin, ctx)));
  }

  subscribe(
    args: SubscribeArgs<Obj>,
    _notifyInitialValue = false, // TODO - how do we handle this in ObservableList?
    ctx: ChangeContext = {},
    initialOrigin: ItemEventOrigin = 'DATABASE',
  ): Unsubscriber {
    this.validate();
    const { ITEM_LISTENER, CHANGE, MODIFY_LISTENER }: SubscribeItemizedListeners<Obj> =
      typeof args === 'function' ? { CHANGE: args } : args;

    if (this.onSubscribe) this.onSubscribe();

    const isLoaded = this.isLoaded(); // ObservableList is always loaded, but the child classes might not be

    if (ITEM_LISTENER && (isLoaded || this._val.length > 0)) {
      // console.log('ObservableList subscribe (ISLOADED)', this._val.length);
      this._val.forEach((obj, offset) => ITEM_LISTENER(obj, 'ADD', initialOrigin, ctx, offset, offset));
    }
    if (CHANGE && (isLoaded || this._val.length > 0)) CHANGE(this.value, initialOrigin, ctx);

    if (ITEM_LISTENER) this._listeners.ITEM_LISTENER.push(ITEM_LISTENER);
    if (CHANGE) this._listeners.CHANGE.push(CHANGE);
    if (MODIFY_LISTENER) this._listeners.MODIFY_LISTENER.push(MODIFY_LISTENER);

    return () => {
      filterInPlace(this._listeners.ITEM_LISTENER, (l) => l !== ITEM_LISTENER);
      filterInPlace(this._listeners.CHANGE, (l) => l !== CHANGE);
      filterInPlace(this._listeners.MODIFY_LISTENER, (l) => l !== MODIFY_LISTENER);
    };
  }

  async get(): Promise<Obj[]> {
    this.validate();
    await this.load();
    return this._val;
  }

  async setAndAwaitChange(cb: () => void | Promise<void>): Promise<Obj[]> {
    this.validate();

    const currentVal = [...this.value];

    let done: (v: Obj[]) => void;

    const prom = new Promise<Obj[]>((resolve) => {
      done = resolve;
    });

    const unsub = this.subscribe({
      CHANGE: (val) => {
        if (currentVal.length !== val.length) return done(val);

        // silly deep-equal
        for (let i = 0; i < currentVal.length; i++) {
          const currentItem = currentVal[i];
          const item = val[i];
          if (currentItem !== item) {
            return done(val);
          }
        }
      },
    });

    await cb();
    const v = await prom;
    unsub();
    return v;
  }

  async awaitItemsInList(): Promise<Obj[]> {
    this.validate();
    await this.load();
    if (this._val.length) return this._val;

    return new Promise((resolve) => {
      const unsub = this.subscribe((value) => {
        if (value.length) {
          unsub();
          resolve(value);
        }
      });
    });
  }

  want(): this {
    this.validate();
    void this.load();
    return this;
  }

  async toArray() {
    this.validate();
    await this.load();
    const val = this._val;
    // this.destroy();
    return val;
  }

  get value(): Obj[] {
    this.validate();
    return this._val;
  }

  get length() {
    this.validate();
    return this._val.length;
  }

  protected getValue(): Obj[] {
    this.validate();
    return this._val;
  }

  idx(i: number): Obj | undefined {
    this.validate();
    return this._val[i] || undefined;
  }

  first(): Obj | undefined {
    this.validate();
    return this._val[0];
  }

  firstObs(): ObservableReader<Obj | null | undefined> {
    this.validate();

    // At this point, an empty list could mean that we are loaded or not loaded
    const obs = new Observable<Obj | null | undefined>(undefined, () => this.load());

    obs.managedReference(this, '~upstream');
    let unsub = this.subscribe(
      {
        // CHANGE automatically gets called on subscribe if it's loaded OR non zero length
        CHANGE: (value, origin, ctx) => {
          // It's ok if the list is empty - that just means that we KNOW we have nothing ( and thus null, not undefined )
          obs.set(value.length ? value[0] : null, origin, ctx);
        },
      },
      // false,
      // ctx,  // Do we actually ever want to pass a context argument to .firstObs() ?
    );

    obs.onCleanup(unsub);
    return obs;
  }

  // Use a closure to choose one of the list items to return via a single Observable
  chooseObs(
    fn: (v: Obj[]) => Obj | null | undefined,
    deps: ObservableReader<any>[] = [],
  ): ObservableReader<Obj | null | undefined> {
    this.validate();

    // Create the output observable
    const obs = new Observable<Obj | null | undefined>(undefined, () => this.load());

    // Subscribe to changes in the upstream observable
    // (unsubscribing when the downstream is destroyed)
    obs.onCleanup(
      this.subscribe({
        CHANGE: (value, origin, ctx) => {
          obs.set(fn(value) || null, origin, ctx);
        },
        MODIFY_LISTENER: (value, type, origin, ctx) => {
          // Re-evaluate when item is modified
          obs.set(fn(this.value) || null, origin, ctx);
        },
      }),
    );
    obs.managedReference(this, '~upstream');

    let i = 0;
    // cause each dependency to be loaded, and subscribe
    // (also unsubing on obs destroy)
    deps.forEach((d) => {
      // TODO should probably move this to ths obs loader closure
      void d.load();

      obs.managedReference(d, `~dep${i}`);
      obs.onCleanup(
        d.subscribe((_, origin, ctx) => {
          // Reevaluate when any of the deps change
          obs.set(fn(this.value) || null, origin, ctx);
        }),
      );
    });

    return obs;
  }

  reduceObs<Out>(
    reduceFn: (acc: Out, obj: Obj, idx: number) => Out,
    initialValue: () => Out,
    deepEq = false,
  ): Observable<Out> {
    this.validate();
    const out = new Observable<Out>(initialValue(), () => this.load());
    out.managedReference(this, '~upstream');

    out.onCleanup(
      this.subscribe({
        CHANGE: async (value, origin, ctx) => {
          this.validate();
          // if we changed, just recompute the out
          const val = initialValue();
          out.set(value.reduce(reduceFn, val), 'UNKNOWN', {}, deepEq);
        },
      }),
    );

    return out;
  }

  mapObs<Out>(mapFn: (obj: Obj, idx: number) => Out, name = 'mapObs'): ObservableList<Out> {
    this.validate();
    const outList = new ObservableList<Out>([], name, undefined, () => this.load());
    outList._upstream = this;

    let changed = false;
    let firstChange = false;
    let inMap: Obj[] = [];
    let outMap: Out[] = [];

    outList.managedReference(this, '~upstream');
    outList.onCleanup(
      this.subscribe({
        ITEM_LISTENER: (item, op, origin, ctx, offset) => {
          this.validate();
          if (op == 'ADD') {
            const output = mapFn(item, offset);
            if (inMap.indexOf(item) > -1) {
              console.log('LOOK AREADY IN LIST BEFORE ADD - DUPE!');
            }
            inMap.push(item);
            outMap.push(output);
            if (output instanceof GuardedObj) {
              output.registerReferent(outList, '_val');
            }
            outList.rawInsert(output, origin, ctx, undefined, offset);
            changed = true;
          } else if (op === 'REMOVE') {
            const offset = inMap.indexOf(item);
            const output = outMap[offset];

            inMap.splice(offset, 1);
            outMap.splice(offset, 1);

            if (inMap.indexOf(item) > -1) {
              console.log('LOOK STILL IN LIST AFTER REMOVE - DUPE!');
            }
            if (output instanceof GuardedObj) output.deregisterReferent(outList, '_val');
            outList.rawRemove(output, origin, ctx);
            changed = true;
          }
        },
        CHANGE: async (value, origin, ctx) => {
          this.validate();
          if (changed || !firstChange) {
            firstChange = true;
            changed = false;
            if (outList.alive) await outList.notifyAsync(origin, ctx);
          }
        },
      }),
    );

    return outList;
  }

  filterObs(
    filterFn: (obj: Obj) => boolean,
    name = 'filterObs',
    _loader?: () => Promise<void>,
    reevaluate_on_modify?: boolean, // HACK
  ): FilteredObservableList<Obj> {
    this.validate();
    return new FilteredObservableList<Obj>(this, filterFn, name, _loader, reevaluate_on_modify);
  }

  filterMapObs<Out>(f: (arg: Obj) => Out | void, name = 'filterMapObs'): FilterMapObservableList<Obj, Out> {
    this.validate();
    return new FilterMapObservableList<Obj, Out>(this, f, name);
  }

  hasSubscribers(): boolean {
    this.validate();
    return (
      this._listeners.ITEM_LISTENER.length !== 0 ||
      this._listeners.MODIFY_LISTENER.length !== 0 ||
      this._listeners.CHANGE.length !== 0
    );
  }

  clear(origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext = {}) {
    this.validate();
    if (this._val.length === 0) return;

    const oldTailIdx = this._val.length - 1;
    this._val.reverse().forEach((obj, rIndex) => {
      this.fireItemListeners(obj, 'REMOVE', origin, ctx, oldTailIdx - rIndex, null);
    });
    this._val = [];
    this.fireChangeListeners(origin, ctx);
  }

  replaceAll(newlist: Obj[], origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext = {}) {
    this.validate();

    let mylist = this._val;
    let newlen = newlist.length;

    // https://jsfiddle.net/m3dohn8j/20/

    let newOffset = 0;
    for (; newOffset < newlen; newOffset++) {
      let obj = newlist[newOffset];
      let oldOffset = mylist.findIndex((o) => o === obj);

      if (oldOffset > -1) {
        if (newOffset === oldOffset) {
          // right where it needs to be
        } else {
          if (oldOffset < newOffset) throw "sanity error - shouldn't get here";
          this.rawMove(origin, ctx, oldOffset, newOffset);
        }
      } else {
        this.rawInsert(obj, origin, ctx, false, newOffset);
        if (obj instanceof GuardedObj) {
          obj.registerReferent(this, '_val');
        }
      }
    }

    let last_remaining = newOffset - 1;
    let remove_offset = mylist.length - 1;

    // Now remove the tail
    for (; remove_offset > last_remaining; remove_offset--) {
      const obj = this.rawRemoveOffset(remove_offset, origin, ctx);
      if (obj instanceof GuardedObj) {
        obj.deregisterReferent(this, '_val');
      }
    }

    this.fireChangeListeners(origin, ctx);
  }

  /**
   * input is almost exactly the same as replaceAll, _except_ that it accepts a T[] OR an ObservableList<T>
   * And it manages the subscription for any ObservableList<T> both coming and going.
   */
  _lastInputObs?: any;
  protected _inputUnsub?: () => void;
  input(v: Obj[] | ObservableList<Obj>, origin: ItemEventOrigin, ctx: ChangeContext) {
    this.validate();

    if (v instanceof ObservableList) {
      v.validate();

      // Don't call _inputUnsub if we're already subscribed to this exact ObservableList.
      // It's unnecessary thrashing, and by canceling the previous managedReference
      // we might cause `v` to be destroyed right before we subscribe to it
      if (v === this._lastInputObs) return;

      this._lastInputObs = v;

      const unRef = this.managedReference(v, '~upstream');

      // Unsubscribe from the previous ObservableList
      if (this._inputUnsub) this._inputUnsub();

      // I think it's safe to call the upstream loader multiple times.
      // Either way we need to unset the old loader in case we were previously subscribed to a different ObservableList
      this.loader = () => v.load();
      if (this._didRequestLoad) {
        void v.load();
      }

      const unsub = v.subscribe(
        (value, _origin, ctx) => {
          this.validate();
          this.replaceAll(value, _origin, ctx);
        },
        true,
        undefined,
        origin, // Set the initial value with the input origin
      );

      // we need to be able to fully detatch from the old ObservableList
      // including unsubscribing from it, and removing our registered reference to it
      this._inputUnsub = () => {
        unsub();
        unRef();
      };
    } else {
      // Unsubscribe from the previous ObservableList
      if (this._inputUnsub) this._inputUnsub();
      delete this._lastInputObs;

      this.replaceAll(v, origin, ctx);
    }
  }

  replace(remove: Obj[], insert: Obj[], origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext = {}) {
    this.validate();
    // Lets not assume that the items to be removed are actually in the set
    let removedItems: Obj[] = [];
    this._val = this._val.filter((v) => {
      if (remove.includes(v)) {
        removedItems.push(v);
        return false; // remove
      }
      return true; // preserve
    });

    this._val.push(...insert);

    // HACK - TODO send a proper offset
    removedItems.forEach((r) =>
      this._listeners.ITEM_LISTENER.forEach(
        (l) => l(r, 'REMOVE', origin, ctx, -Infinity, null), // HACK - TODO send a proper offset
      ),
    );
    insert.forEach((i) =>
      this._listeners.ITEM_LISTENER.forEach(
        (l) => l(i, 'ADD', origin, ctx, Infinity, null), // HACK - TODO send a proper offset
      ),
    );

    this._listeners.CHANGE.forEach((l) => l(this.value, origin, ctx));
  }

  insert(obj: Obj, origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext = {}, dedupe?: boolean) {
    if (obj instanceof GuardedObj) obj.registerReferent(this, '_val');

    this.rawInsert(obj, origin, ctx, dedupe);
    this.fireChangeListeners(origin, ctx);
  }

  unshift(obj: Obj, origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext, dedupe?: boolean) {
    this.validate();
    if (dedupe && this.contains(obj)) return;
    this._val.unshift(obj);

    this.fireItemListeners(obj, 'ADD', origin, ctx, 0, 0);
    this.fireChangeListeners(origin, ctx);
  }

  protected rawInsert(obj: Obj, origin: ItemEventOrigin, ctx: ChangeContext, dedupe?: boolean, offset?: number) {
    this.validate();
    if (dedupe && this.contains(obj)) return;
    offset ??= this._val.length;

    this._val.splice(offset, 0, obj);

    this.fireItemListeners(obj, 'ADD', origin, ctx, offset, offset);
  }

  protected rawMove(origin: ItemEventOrigin, ctx: ChangeContext, currentOffset: number, newOffset: number) {
    // get current index

    if (newOffset > this._val.length) {
      console.error('move at this offset would result in sparsity', this._val, newOffset);
      throw new Error('sanity error - move at this offset would result in sparsity');
    }

    // then remove it from its original spot
    const [obj] = this._val.splice(currentOffset, 1);
    // then add it back in its new spot
    this._val.splice(newOffset, 0, obj);

    this.fireItemListeners(obj, 'MOVE', origin, ctx, currentOffset, newOffset);
  }

  notify(origin: ItemEventOrigin, ctx: ChangeContext) {
    this.validate();
    this.fireChangeListeners(origin, ctx);
  }

  async notifyAsync(origin: ItemEventOrigin, ctx: ChangeContext): Promise<void> {
    this.validate();
    return this.fireChangeListenersAsync(origin, ctx);
  }

  contains(obj: Obj) {
    this.validate();
    return this._val.includes(obj);
  }

  containsBy(pred: (val: Obj, index: number, arr: Obj[]) => boolean) {
    this.validate();
    return !!this._val.find(pred);
  }

  removeIdx(idx: number, ctx: ChangeContext) {
    this.validate();
    const val = this.idx(idx);
    if (val) return this.remove(val, 'UNKNOWN', ctx);
  }

  remove(val: Obj, origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext = {}) {
    if (val instanceof GuardedObj) val.deregisterReferent(this, '_val');
    this.rawRemove(val, origin, ctx);
    this.fireChangeListeners(origin, ctx);
  }

  protected rawRemove(val: Obj, origin: ItemEventOrigin, ctx: ChangeContext) {
    this.validate();
    if (!this._val.includes(val)) {
      // throw new Error('Value not present');
      return;
    }
    const offset = this._val.findIndex((v) => v === val);
    if (offset < 0) {
      console.warn('Attempt to remove ObservableList Item not in the set');
      return;
    }

    this._val.splice(offset, 1);
    this.fireItemListeners(val, 'REMOVE', origin, ctx, offset, null);
  }
  protected rawRemoveOffset(offset: number, origin: ItemEventOrigin, ctx: ChangeContext) {
    if (offset < 0) {
      console.warn('Attempt to remove ObservableList Item not in the set');
      return;
    }
    let obj = this._val[offset];
    this._val.splice(offset, 1);
    this.fireItemListeners(obj, 'REMOVE', origin, ctx, offset, null);
    return obj;
  }

  removeWhere(pred: (val: Obj) => boolean, origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext = {}) {
    this.validate();
    let val = this.find(pred);
    if (val) {
      this.remove(val, origin, ctx);
    }
  }

  slice(start?: number, end?: number) {
    this.validate();
    return this._val.slice(start, end);
  }

  map<Out>(f: (obj: Obj, idx: number) => Out): Out[] {
    this.validate();
    return this._val.map((obj, idx) => f.call(undefined, obj, idx));
  }

  forEach(f: (obj: Obj, idx: number) => void) {
    this.validate();
    this._val.forEach((obj, idx) => f.call(undefined, obj, idx));
  }

  // NOTE: our sort does NOT mutate (like a JS sort)
  sort(fn?: (a: Obj, b: Obj) => number) {
    this.validate();
    return [...this._val].sort(fn);
  }

  // HACK - TODO make SortedObservableList its own thing
  sortObs(
    fn: (a: Obj, b: Obj) => number,
    // itemSub = (item: Obj) => Observable<any>,
    name?: string,
  ): ObservableList<Obj> {
    this.validate();
    const sortedList = new ObservableList<Obj>([], name, undefined, () => this.load());

    sortedList.managedReference(this, '~upstream');
    sortedList.onCleanup(
      this.subscribe({
        ITEM_LISTENER: (obj, op, origin, ctx, offset, newOffset) => {
          this.validate();
          if (op === 'REMOVE') {
            sortedList.rawRemove(obj, origin, ctx);
            return;
          }

          // const tempSorted = [...this.value].sort(fn);
          if (op === 'ADD') {
            // fn(a,b) = a - b
            // [1, 3] + 2                           1 - 2 = -1 > 0 = false
            //                                      3 - 1 = 1 > 0 = true
            let offset = sortedList._val.findIndex((el) => fn(el, obj) > 0);
            if (offset === -1) offset = sortedList.length;
            sortedList.rawInsert(obj, origin, ctx, false, offset);
            // this._itemSubs.push(itemSub.(obj).subscribe(() => this.moveItem(item)))
          }

          if (op === 'MOVE') {
            console.warn('sortObs ITEM_LISTENER - UNHANDLED MOVE OP');
            // let newOffset = sortedList._val.findIndex((el) => fn(el, obj) > 0);
            // if (newOffset === -1) newOffset = sortedList.length;
            // if (newOffset) sortedList.rawMove(origin, ctx, offset, newOffset);
            // else console.error('Got a move without a new offset');
            // if (newOffset) this.rawMove(origin, ctx, offset, newOffset);
          }
        },
        MODIFY_LISTENER: (obj, op, origin, ctx) => {
          this.validate();
          const currentOffset = sortedList._val.findIndex((v) => v === obj);
          if (currentOffset < 0) {
            console.warn('Attempt to move ObservableList Item not in the set');
            return;
          }

          // get new index
          let newOffset = sortedList._val.findIndex((el) => {
            return el !== obj && fn(el, obj) > 0;
          });
          if (newOffset === -1) newOffset = sortedList.length;

          // if it moved up in the list, then removing it from earlier in the list will shift its index back one
          if (newOffset > currentOffset) {
            newOffset -= 1;
          }
          if (newOffset !== currentOffset) {
            // if the numbers are different, then execute the move
            sortedList.rawMove(origin, ctx, currentOffset, newOffset);
            sortedList.notify(origin, ctx);
          }
        },
        CHANGE: async (value, origin, ctx) => {
          this.validate();

          // tempSorted.forEach((obj, newIndex) => {
          //   const oldIndex = sortedList.value.indexOf(obj);
          //   if (oldIndex === -1) {
          //     // not present
          //     sortedList.rawInsert(obj, origin, ctx, newIndex);
          //     // if(newIndex <= oldIndex)
          //   } else {
          //     if (oldIndex !== newIndex)
          //       sortedList.rawMove(origin, ctx, oldIndex, newIndex);
          //   }
          // });

          // // TODO - avoid using replaceAll, as it causes the viewmodel tree to thrash
          // // sortedList.replaceAll([...value].sort(fn));

          await sortedList.notifyAsync(origin, ctx);
        },
      }),
    );

    return sortedList;
  }

  filter(predicate: (value: Obj, index: number, obj: Obj[]) => boolean): Obj[] {
    this.validate();
    return this._val.filter(predicate);
  }

  find(predicate: (value: Obj, index: number, obj: Obj[]) => boolean): Obj | undefined {
    this.validate();
    return this._val.find(predicate);
  }
}

export class FilteredObservableList<Obj> extends ObservableList<Obj> {
  private _changed = false;
  private _isLoaded = false;
  private _firstChange = false;
  constructor(
    readonly upstream_list: ObservableList<Obj>,
    readonly filterFn: (obj: Obj) => boolean,
    readonly name?: string,
    _loader?: () => Promise<void>,
    reevaluate_on_modify = false,
  ) {
    super();
    // Chain the loaders.  When you ask me to load, I will ask my upstream list to load.
    // I will wait to tell you I am loaded until my upstream list is loaded.
    // Each loader might trigger (execute) certain things, or those things might already be triggered.
    // Each loader might return immediately, or it might wait for the result of that triggered thing
    this.loader = async () => {
      await upstream_list.load();
      await _loader?.();
    };

    // let ul : ObservableList<number> = new ObservableList([1,2,3,4,5]);
    // let this_list : FilteredObservableList<number> = ul.filterObs((v) => v < 4);
    // assert(b.value, [1,2,3])

    this.managedReference(upstream_list, '~upstream');
    this._upstream = upstream_list;
    this.onCleanup(
      upstream_list.subscribe({
        ITEM_LISTENER: (item, op, origin, ctx, oldOffset, newOffset) => {
          this.validate();
          if (op == 'ADD' && filterFn(item)) {
            this.rawInsert(item, origin, ctx);
            this._changed = true;
          }
          if (op === 'REMOVE') {
            this.rawRemove(item, origin, ctx);
            this._changed = true;
          }

          if (op === 'MOVE') {
            // if (newOffset) this.rawMove(origin, ctx, oldOffset, newOffset);
            // else console.error('Got a move without a new offset');
            this._changed = true;
          }
        },
        MODIFY_LISTENER: (item, op, origin, ctx, oldOffset, newOffset) => {
          this.validate();

          // HACK
          if (reevaluate_on_modify) this.reevaluate(origin, ctx);

          // Only fire our modify listeners if the item is in our list
          if (this._val.includes(item)) {
            this.fireModifyListeners(item, 'MODIFY', origin, ctx, oldOffset, newOffset);
          }
        },
        CHANGE: async (value, origin, ctx) => {
          this.validate();
          if (this._changed || !this._firstChange) {
            this._firstChange = true;
            this._changed = false;
            this._isLoaded = true; // Got our first change = we're loaded
            await this.notifyAsync(origin, ctx);
          }
        },
      }),
    );
  }
  reevaluate(origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext = {}) {
    this.validate();
    let changed = false;
    this.upstream_list.forEach((i) => {
      const present = this._val.includes(i);
      const ok = this.filterFn(i);

      if (ok && !present) {
        this.rawInsert(i, origin, ctx);
        changed = true;
      } else if (present && !ok) {
        this.rawRemove(i, origin, ctx);
        changed = true;
      }

      if (changed) this.notify(origin, ctx);
    });
  }
  async load() {
    this.validate();
    if (!this._isLoaded) {
      this._didRequestLoad = true;
      await this.loader();
      this._isLoaded = true;
    }
  }
  isLoaded() {
    this.validate();
    // important to overload this. The ObservableList base class is passive, so it's always "loaded"
    return this._isLoaded;
  }
}

export class FilterMapObservableList<InputObj, OutputObj> extends ObservableList<OutputObj> {
  private _changed = false;
  private _isLoaded = false;
  private inMap: InputObj[] = [];
  private outMap: OutputObj[] = [];
  private filterMapFn: (obj: InputObj) => OutputObj | void;

  constructor(
    readonly list: ObservableList<InputObj>,
    filterMapFn: (obj: InputObj) => OutputObj | void,
    readonly name?: string,
  ) {
    super();
    this.loader = () => list.load();
    this.filterMapFn = filterMapFn;

    this.managedReference(list, '~upstream');
    this.onCleanup(
      list.subscribe({
        ITEM_LISTENER: (item, op, origin, ctx) => {
          this.validate();
          if (op == 'ADD') {
            const output = filterMapFn(item);
            if (output !== undefined) {
              this.inMap.push(item);
              this.outMap.push(output);
              this.rawInsert(output, origin, ctx);
              this._changed = true;
            }
          } else if (op === 'REMOVE') {
            const offset = this.inMap.indexOf(item);
            const output = this.outMap[offset];

            this.inMap.splice(offset, 1);
            this.outMap.splice(offset, 1);
            this.rawRemove(output, origin, ctx);
            this._changed = true;
          }
        },
        CHANGE: async (value, origin, ctx) => {
          this.validate();
          this._isLoaded = true; // Got our first change = we're loaded
          await this.notifyAsync(origin, ctx);
        },
      }),
    );
  }

  reevaluate(origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext = {}) {
    this.validate();
    let changed = false;

    // Review the input list
    this.list.forEach((item) => {
      const offset = this.inMap.indexOf(item);
      const output = this.filterMapFn(item);

      if (offset > -1) {
        // It is present
        const oldItem = this.outMap[offset];

        if (output) {
          // and we want it to be (and maybe the output object changed? Kinda weird)
          if (oldItem != output) {
            // TODO consider throwing a modified event or an add/remove later
            this.outMap[offset] = output;
            this._val[offset] = output;
            changed = true;
          }
        } else {
          // we don't want it
          this.inMap.splice(offset, 1);
          this.outMap.splice(offset, 1);
          this.rawRemove(oldItem, origin, ctx);

          changed = true;
        }
      } else {
        // not present
        if (output) {
          //and we want it to be present
          this.inMap.push(item);
          this.outMap.push(output);
          this.rawInsert(output, origin, ctx);

          changed = true;
        }
      }

      if (changed) this.notify(origin, ctx);
    });
  }

  isLoaded() {
    this.validate();
    // important to overload this. The ObservableList base class is passive, so it's always "loaded"
    return this._isLoaded;
  }
}

export class AsyncFilterMapObservableList<InputObj, OutputObj> extends ObservableList<OutputObj> {
  private _changed = false;
  private _isLoaded = false;
  private inMap: InputObj[] = [];
  private outMap: OutputObj[] = [];
  private pendingFilters: Promise<void>[] = [];
  constructor(
    readonly list: ObservableList<InputObj>,
    filterMapFn: (obj: InputObj) => Promise<OutputObj | void> | OutputObj | void,
    readonly name?: string,
  ) {
    super();
    this.loader = () => list.load();

    this.managedReference(list, '~upstream');
    this.onCleanup(
      list.subscribe({
        ITEM_LISTENER: (item, op, origin, ctx) => {
          this.validate();
          if (op == 'ADD') {
            this.pendingFilters.push(
              (async () => {
                const output = await filterMapFn(item);
                if (output !== undefined) {
                  this.inMap.push(item);
                  this.outMap.push(output);
                  this.rawInsert(output, origin, ctx);
                  this._changed = true;
                }
              })(),
            );
          } else if (op === 'REMOVE') {
            const offset = this.inMap.indexOf(item);
            const output = this.outMap[offset];

            this.inMap.splice(offset, 1);
            this.outMap.splice(offset, 1);
            this.rawRemove(output, origin, ctx);
            this._changed = true;
            // TODO: figure out what to do here
            // } else if (op === 'MODIFY') {
            //   const offset = this.inMap.indexOf(item);
            //   const output = this.outMap[offset];
            //
            //   this.inMap.splice(offset, 1);
            //   this.outMap.splice(offset, 1);
            //   this.rawRemove(output, origin, ctx);
            //   this.pendingFilters.push(
            //     (async () => {
            //       const output = await filterMapFn(item);
            //       if (output !== undefined) {
            //         this.inMap.push(item);
            //         this.outMap.push(output);
            //         this.rawInsert(output, origin, ctx);
            //         this._changed = true;
            //       }
            //     })(),
            //   );
            //   this._changed = true;
          }
        },
        CHANGE: async (value, origin, ctx) => {
          this.validate();
          // TODO: consider if we need to be checking _changed or not
          await Promise.all(this.pendingFilters.splice(0));
          this._isLoaded = true; // Got our first change = we're loaded
          await this.notifyAsync(origin, ctx);
        },
      }),
    );
  }
  reevaluate(origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext = {}) {
    // TODO - actually implement this
    // this.validate();
    // let changed = false;
    // this.list.forEach((i) => {
    //   const present = this._val.includes(i);
    //   const ok = this.filterFn(i);
    //   if (ok && !present) {
    //     this.rawInsert(i, origin, ctx);
    //     changed = true;
    //   } else if (present && !ok) {
    //     this.rawRemove(i, origin, ctx);
    //     changed = true;
    //   }
    //   if (changed) this.notify(origin, ctx);
    // });
  }
  isLoaded() {
    this.validate();
    // important to overload this. The ObservableList base class is passive, so it's always "loaded"
    return this._isLoaded;
  }
}

export function mapObsList<In, Out>(
  obs: IObservable<In> & GuardedObj,
  f: (arg: In) => Out[] | ObservableList<Out> | void,
): ObservableList<Out> {
  obs.validate();
  const derived = new ObservableList<Out>(f(obs.value) ?? [], undefined, undefined, () => obs.load());

  derived.managedReference(obs, '~upstream');

  derived.onCleanup(
    obs.subscribe((value, origin, ctx) => {
      obs.validate();
      derived.input(f(value) ?? [], origin, ctx); // Think about what to do with oldValue and origin here
    }),
  );

  return derived;
}

/** takes an ObservableList<Obj> and a function that maps an Observable<T> */
// Doesn't work yet
// export function listMapObsReduce<Obj, T, Acc>(
//   list: ObservableList<Obj>,
//   f: (arg: Obj) => Observable<T>,
//   reducer: (acc: Acc, val: T) => Acc,
//   initialValue: Acc,
// ): Observable<Acc> {
//   list.validate();
//   const out = new Observable<Acc>(initialValue, () => list.load());
// out.managedReference(list, '~upstream');
// Plan: First lets build an Observable list of T
// Then we can reduce that list

// const unsub = list.subscribe({
//   ITEM_LISTENER: (item, op, origin, ctx, offset) => {
//     if (op === 'ADD') {
//       const obs = f(item);
//       const CancelFn = obs.managedReference(list, `~upstream`);

//       const unsubFn = obs.subscribe((value, origin, ctx) => {
//         out.set(list.value.map(f).reduce(reducer, initialValue), origin, ctx);
//       });
//     }
//   },
//   CHANGE: async (value, origin, ctx) => {
//     out.set(list.value.map(f).reduce(reducer, initialValue), origin, ctx);
//   },
// });
// }
