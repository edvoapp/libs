import { ThenFunction } from '../await_value';
import { Guarded, OwnedProperty, WeakProperty } from './memoize-weak';
import { EdvoObj, Guard, GuardedObj, ManagedObj } from './object';
import { Ticker } from './ticker';
import equal from 'fast-deep-equal';
import { race } from '../sleep';

export interface Transactable {
  get name(): string;
  addPrecommitHook: (fn: (trx: Transactable) => void | Promise<void>) => void;
  addPostCommitHook: (fn: () => void | Promise<void>) => void;
  addAbortHook: (fn: () => void) => void;
}

export class ForeachHandle extends EdvoObj {}

export type ChangeContext = {
  trx?: Transactable;
  // Ignore debounce and force the change now
  force?: true;
};

export type ChangeListener<T> = (value: T, origin: ItemEventOrigin, ctx: ChangeContext) => unknown;

export type ChangeListener2<T, D extends string> = (
  value: T,
  deps: Record<D, EdvoObj>,
  origin: ItemEventOrigin,
  ctx: ChangeContext,
) => void;

export type Unsubscriber = () => void;

export type ItemEventOrigin = 'USER' | 'DATABASE' | 'UNKNOWN';

/**
 * IObservable interface to support Observable decorators
 */
export interface IObservable<T> {
  subscribe(
    fn: ChangeListener<T>,
    notifyInitialValue?: boolean,
    ctx?: ChangeContext,
    initialOrigin?: ItemEventOrigin,
  ): Unsubscriber;
  value: T;
  get(): Promise<Exclude<T, undefined>>;
  load(): Promise<void>;
}

export type IObservableObj<T> = IObservable<T> & ManagedObj;

export type DepValues<T extends Record<string, IObservable<any> | null | undefined>> = {
  [K in keyof T]: T[K] extends IObservable<infer V>
    ? V
    : T[K] extends IObservable<infer V> | null | undefined
    ? V | null
    : null;
};

export abstract class ObservableReader<T> extends EdvoObj implements IObservableObj<T> {
  abstract subscribe(
    fn: ChangeListener<T>,
    notifyInitialValue?: boolean | undefined,
    ctx?: ChangeContext | undefined,
    initialOrigin?: ItemEventOrigin,
  ): Unsubscriber;
  abstract value: T;
  abstract get(): Promise<Exclude<T, undefined>>;
  abstract load(): Promise<void>;
  abstract mapObs<Out>(f: (arg: T) => Out | IObservableObj<Out>, deepEq?: boolean): ObservableReader<Out>;

  /**
   * awaitCondition is a helper function that allows you to wait for a condition to be truthy using a closure to check the condition.
   * It will return true if the condition matches, or false if the node is destroyed before the condition is met.
   */
  awaitCondition<R>(condition: (val: T) => R): AwaitCondPromise<R> {
    return awaitObsCondition(this, condition);
  }

  awaitTillValue<R>(cb: (value: T) => { value: R } | (undefined | null | false)): Promise<R> {
    return awaitObsCondition(this, cb).then((obj) => {
      if (!obj) throw new Error(`${this.constructor.name} was cleaned up`);
      return obj.value;
    });
  }

  awaitHasValue(): Promise<NonNullable<T>> {
    return this.awaitTillValue((v) => typeof v !== 'undefined' && v !== null && { value: v as NonNullable<T> });
  }

  awaitDefined(): Promise<Exclude<T, undefined>> {
    return this.awaitTillValue((v) => typeof v !== 'undefined' && { value: v as Exclude<T, undefined> });
  }

  awaitUndefined(): Promise<null | undefined> {
    return this.awaitTillValue(
      (v) =>
        (typeof v === 'undefined' || v === null) && {
          value: v as unknown as null | undefined,
        },
    );
  }

  abstract get subscriberCount();

  // used when an action occurs (such as changing of an observable's value) and we need to await all listeners to fire and quiesce
  @Guarded
  async setAndAwaitChange(cb: () => void | Promise<void>): Promise<T> {
    this.validate();

    const currentVal = this.value;

    let done: (v: T) => void;

    const prom = new Promise<T>((resolve) => {
      done = resolve;
    });

    const unsub = this.subscribe((val) => {
      // if the value is different, then resolve.
      if (currentVal !== val) {
        done(val);
      }
    });
    await cb();
    const v = await race(prom, 5_000, true);
    unsub();
    return v;
  }

  debounced(delay: number | ((value: T) => number | null) = 0, deepEq = false): ObservableReader<T> {
    this.validate();

    let derived = new Observable<T>(this.value, () => this.load());
    derived.managedReference(this, '~upstream');

    let timer: ReturnType<typeof setTimeout> | undefined;

    derived.onCleanup(
      this.subscribe((value, origin, ctx) => {
        this.validate();
        if (timer) clearTimeout(timer);

        if (ctx?.force) {
          derived.set(value, origin, ctx, deepEq);
          return;
        }
        let de = typeof delay === 'function' ? delay(value) : delay;
        if (de === null) {
          derived.set(value, origin, ctx, deepEq);
        } else {
          timer = setTimeout(() => {
            if (derived.alive && (!(value instanceof GuardedObj) || value.alive)) {
              derived.set(value, origin, ctx, deepEq);
            }
            timer = undefined;
          }, de);
        }
      }),
    );

    return derived;
  }
}

export class Observable<T> extends ObservableReader<T> {
  @OwnedProperty
  _val: T;
  _previousVal: T | null = null;
  private _didRequestLoad = false;
  private _isLoaded = false;
  protected loader: () => Promise<unknown>;
  protected _loading?: Promise<unknown>;

  constructor(defaultValue: T | IObservableObj<T>, loader?: () => Promise<unknown>) {
    super();
    if (isIObservable(defaultValue)) {
      this._val = defaultValue.value;
      this.input(defaultValue, 'UNKNOWN', {});
    } else {
      this._val = defaultValue;
    }
    if (defaultValue === undefined && !loader) {
      console.warn(
        `This observable will never be set to loaded because it has an initialValue of undefined and has no loader specified`,
      );
    }
    this.loader = loader || (() => this.awaitDefined());
  }
  get subscriberCount() {
    return this._listeners.length;
  }
  static _auditFn?: (obs: IObservable<any>, origin: ItemEventOrigin, ctx?: ChangeContext) => any;
  static auditObs(fn: (obs: IObservable<any>, origin: ItemEventOrigin, ctx?: ChangeContext) => any) {
    this._auditFn = fn;
  }
  static clearAuditObs() {
    this._auditFn = undefined;
  }
  static _track_event(obs: IObservable<any>, origin: ItemEventOrigin, ctx?: ChangeContext) {
    if (this._auditFn) {
      let rv = this._auditFn(obs, origin, ctx);
      if (rv) {
        console.warn('AUDIT Observable', { obs, origin, ctx, rv });
      }
    }
  }
  // Creates an observable which is derived from one or more other observables
  static calculated<T, Deps extends Record<string, IObservableObj<any> | null | undefined>>(
    fn: (values: DepValues<Deps>) => T | IObservableObj<T>,
    deps: Deps,
  ): ObservableReader<T> {
    const value = (): T | IObservableObj<T> =>
      fn(
        Object.keys(deps).reduce((acc, key) => {
          const dep = deps[key];
          if (dep) {
            acc[key as keyof Deps] = dep.value;
          }
          return acc;
        }, {} as DepValues<Deps>),
      );

    const obs = new Observable<T>(value(), () => Promise.all(Object.values(deps).map((d) => d?.load())));

    const calc = (_, origin: ItemEventOrigin, ctx: ChangeContext) => {
      obs.input(value(), origin, ctx);
    };

    Object.values(deps).forEach((dep) => {
      if (dep) {
        obs.managedReference(dep, '~upstream');
        obs.onCleanup(dep.subscribe(calc));
      }
    });

    return obs;
  }
  // similar to calculated, forEach calls a closure with the value of one or more other observables
  // Usage: handle = Observable.forEach(({a, b}) => do_something(a,b), {a: obsA, b: obsB});
  static forEach<Deps extends Record<string, IObservableObj<any> | undefined>>(
    fn: (values: DepValues<Deps>) => void,
    deps: Deps,
    callInitially?: boolean,
  ): ForeachHandle {
    const handle = new ForeachHandle();
    const calc = () => {
      fn(
        Object.keys(deps).reduce((acc, key) => {
          const dep = deps[key];
          if (dep) {
            acc[key as keyof Deps] = dep.value;
          }
          return acc;
        }, {} as DepValues<Deps>),
      );
    };

    Object.values(deps).forEach((dep) => {
      if (dep) {
        handle.managedReference(dep, '~upstream');
        handle.onCleanup(dep.subscribe(calc));
      }
    });

    if (callInitially) calc();

    return handle;
  }

  // note: only used for testing because sometimes an observable value is not immediately updated
  waitForUpdate() {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, 1);
    });
  }

  static fromObservables<T>(getval: () => T, obsList: (IObservableObj<any> | null | undefined)[]): ObservableReader<T> {
    const obs = new Observable(getval(), () => Promise.all(obsList.map((obs) => obs?.load())));
    const recalc = (_: any, origin: ItemEventOrigin, ctx: ChangeContext) => obs.set(getval(), origin, ctx);
    obsList.forEach((o) => {
      if (o) {
        obs.managedReference(o, '~upstream');
        obs.onCleanup(o.subscribe(recalc));
      }
    });
    return obs;
  }

  /**
   * Wait for the provided loader to complete, or for the value to be defined
   */
  async load() {
    this.validate();
    if (this._isLoaded) return;
    if (!this._loading) {
      this._didRequestLoad = true;
      // TODO - Think about how we want to manage the lifetime while loading
      this._loading = Guard.while(this, (self) => self.loader());
    }
    await this._loading;
    this._loading = undefined;
    this._isLoaded = true;
  }

  isLoaded() {
    this.validate();
    return this._isLoaded;
  }

  subscribe(
    fn: ChangeListener<T>,
    notifyInitialValue?: boolean,
    ctx: ChangeContext = {},
    initialOrigin?: ItemEventOrigin,
  ): Unsubscriber {
    this.validate();
    if (notifyInitialValue) {
      fn(this.value, initialOrigin ?? 'UNKNOWN', ctx);
    }
    this._listeners.push(fn);

    return () => {
      filterInPlace(this._listeners, (l) => l !== fn);
    };
  }

  protected _listeners: ChangeListener<T>[] = [];
  protected _inputUnsub?: () => void;

  protected cleanup(): void {
    this._inputUnsub?.();
    super.cleanup();
  }

  ticker(): Ticker {
    this.validate();
    return new Ticker(this);
  }

  async tickOnce(): Promise<void> {
    this.validate();
    return new Promise((resolve) => {
      let unsub = this.subscribe(() => {
        if (unsub) {
          unsub();
        }
        resolve();
      });
    });
  }

  // If we use this approach, we should consolidate it with .value and .get not have a separate other accessor
  // get read(): T {
  //   const value = this.getValue();
  //   const context = ComputedContext.GetContext();
  //   if (context) {
  //     const unsubscribe = this.subscribe(context.update);
  //     context.subscriptions[this.key] = unsubscribe;
  //   }
  //   return value;
  // }
  notify(/*value: T, oldValue: T,*/ origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext) {
    this.validate();
    Observable._track_event(this, origin, ctx);
    paranoidForEach(this._listeners, (l) => {
      l(this.value, origin, ctx);
    });
  }

  // Baby steps toward unifying Observables and Awaitables
  // TODO - do the rest

  /**
   * Call the callback as soon as this Observable has a non-undefined value
   */
  get_then<O>(f: ThenFunction<T, O>): Promise<O> {
    this.validate();
    // In Rust you could do this with a blanket implementation for all Observable<Option<T>>
    if (this._isLoaded) {
      return Promise.resolve(f(this._val));
    }

    return this.load().then(() => f(this._val));
  }

  /**
   * MapObs maps one Observable to another
   * Every time this Observable's value changes, reevaluate the closure to determine what value should be in the downstream Observable.
   * In the event that the closure itself returns an (intermediate) observable, a subscription will be created to feed the downstream observable.
   * for a given Observable, mapObs may be called only once, and yield a single downstream observable which is directly usable, BUT will be
   * stable against different intermediate observables if any. The unsubscription to the old intermediate, and subscription to the new intermediate is handle automatically.
   *
   * Basic usage - Closure returns a value
   * ```
   * let a = new Observable(1);
   * let b = a.mapObs((v: number) : number => v + 1);
   * assert(b.value, 2);
   * a.set(2);
   * assert(b.value, 3);
   * ```
   *
   * Advanced usage - Closure returns an observable
   * ```
   * type T = number;
   * type B = { foo: Observable<T> };
   * let a = new Observable<T>(1);
   * let b = new Observable<B | null | undefined>( undefined );
   * let c = b.mapObs((b: B) : Observable<T> | null | undefined => {
   *      return b ? b.foo : b // if b is null, return null. If b is undefined, return undefined. Otherwise return Observable<T>
   *   });
   *
   * assert(c.value, undefined);
   * b.set({ foo: a });
   * assert(c.value, 1);
   * a.set(2)
   * assert(c.value, 2);
   * b.set(null)
   * assert(c.value, null);
   * ```
   */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapObs<Out>(f: (arg: T) => Out | ObservableReader<Out>, deepEq = false): ObservableReader<Out> {
    return mapObs(this, f, deepEq);
  }
  // mapObsAsync<Out extends undefined, I extends Out | undefined = any>(
  //   f: (arg: T) => Promise<Out | Observable<I>>,
  //   deepEq = false,
  // ): Observable<Out> {
  //   return this.mapObs((v) => {
  //     const obs = new Observable<Out>(undefined);
  //     f(v).then((out) => {
  //       obs.set(out);
  //     });
  //     return obs;
  //   });
  // }

  /**
   * input is almost exactly the same as set, _except_ that it accepts a T OR an Observable<T>
   * And it manages the subscription for any Observable<T> both coming and going.
   */
  _lastInputObs?: any;
  input(v: T | IObservableObj<T>, origin: ItemEventOrigin, ctx: ChangeContext, deepEq = false) {
    this.validate();

    if (isIObservable(v)) {
      v.validate();

      // Don't call _inputUnsub if we're already subscribed to this exact Observable.
      // It's unnecessary thrashing, and by canceling the previous managedReference
      // we might cause `v` to be destroyed right before we subscribe to it
      if (v === this._lastInputObs) return;

      this._lastInputObs = v;

      const unRef = this.managedReference(v, '~upstream');

      // Unsubscribe from the previous observable
      if (this._inputUnsub) this._inputUnsub();

      // I think it's safe to call the upstream loader multiple times.
      // Either way we need to unset the old loader in case we were previously subscribed to a different Observable
      this.loader = () => v.load();
      if (this._didRequestLoad) {
        void v.load();
      }

      const unsub = v.subscribe(
        (value, _origin, ctx) => {
          this.validate();
          this.set(value, _origin, ctx, deepEq);
        },
        true,
        undefined,
        origin, // Set the initial value with the input origin
      );

      // we need to be able to fully detatch from the old observable
      // including unsubscribing from it, and removing our registered reference to it
      this._inputUnsub = () => {
        unsub();
        unRef();
      };
    } else {
      // Unsubscribe from the previous observable
      if (this._inputUnsub) this._inputUnsub();
      delete this._lastInputObs;

      this.set(v, origin, ctx, false);
    }
  }

  /**
   * Call the callback as soon as this Observable has a non-undefined value
   */
  // once(): Promise<T> {
  //   this.validate();
  //   return new Promise((resolve) => {
  //     // Subscribe to myself
  //     // TODO Needs to be updated to manage its reference
  //     const unsub = this.subscribe(() => {
  //       this.validate();
  //       unsub();
  //       resolve(this._val);
  //     });

  //   });
  // }

  /**
   * Resolve the promise when this Observable has a non-undefined value
   */
  @Guarded
  async get(): Promise<Exclude<T, undefined>> {
    this.validate();
    await this.load();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - We politely insist that any nonstandard loader not resolve until the value here is at least defined. (null or otherwise)
    return this._val;
  }

  // async toValue(): Promise<Exclude<T, undefined>> {
  //   this.validate();
  //   await this.load();
  //   let val = this._val;
  //   // this.destroy();

  //   // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //   // @ts-ignore - We politely insist that any nonstandard loader not resolve until the value here is at least defined. (null or otherwise)
  //   return val;
  // }

  get value(): T {
    this.validate();
    return this._val;
  }

  get previousValue(): T | null {
    this.validate();
    return this._previousVal;
  }

  protected getValue(): T {
    this.validate();
    return this._val;
  }

  // TODO: Should ctx be optional here?
  set(value: T, origin: ItemEventOrigin = 'UNKNOWN', ctx?: ChangeContext, deepEq = false) {
    this.validate();

    const changed = deepEq ? !equal(value, this._val) : value !== this._val;
    this._previousVal = this._val;
    this._val = value;
    if (changed) this.notify(origin, ctx || {});
  }

  setValueQuiet(value: T) {
    this.validate();
    this._val = value;
  }
}

function isIObservable<T>(arg: any): arg is IObservable<T> {
  return (
    arg instanceof Object &&
    arg.load &&
    typeof arg.load === 'function' &&
    arg.subscribe &&
    typeof arg.subscribe === 'function'
  );
}

export function filterInPlace<T>(array: Array<T>, filterFunction: (arg0: T) => boolean) {
  let i = 0;
  while (i < array.length) {
    if (!filterFunction(array[i])) {
      array.splice(i, 1);
    } else {
      i++;
    }
  }
}

/**
 * Loop over an array which might be changing in length.
 *
 * Based on my testing, the native Array.forEach actually does this just fine (but Array.map does not!)
 * But do you *really* trust all javascript interpreters to behave exactly the same on this?
 * I sure as hell don't >_>
 */
export function paranoidForEach<T>(array: Array<T>, fn: (v: T) => void) {
  const arrayCopy = [...array];

  // Iterate over the copy
  arrayCopy.forEach((item, index) => {
    // Check if the item is still present in the original array
    if (array.includes(item)) {
      fn(item);
    }
  });
}

export type Falsy = 0 | '' | false | null | undefined | never;
export type Truthy<T> = Exclude<T, Falsy>;
export type AwaitCondPromise<T> = Promise<false | Truthy<T>>;

/**
 * awaitCondition is a helper function that allows you to wait for a
 * condition to be truthy using a closure to check the condition.
 * It will return true if the condition matches, or false if the node
 * is destroyed before the condition is met.
 */
export const awaitObsCondition = <T, R>(obs: IObservableObj<T>, condition: (val: T) => R): AwaitCondPromise<R> => {
  obs.validate();
  const res = condition(obs.value);
  if (res) return Promise.resolve(res as Truthy<R>);

  return new Promise<Truthy<R> | false>((resolve) => {
    const cancelCleanup = obs.onCleanup(() => {
      resolve(false);
    });
    const unsub = obs.subscribe((val) => {
      const res = condition(val);
      if (!res) return;

      unsub();
      cancelCleanup();
      resolve(res as Truthy<R>);
    });
  });
};

export function mapObs<T, Out>(
  obs: IObservableObj<T>,
  f: (arg: T) => Out | IObservableObj<Out>,
  deepEq = false,
): ObservableReader<Out> {
  obs.validate();
  const derived = new Observable<Out>(f(obs.value), () => obs.load());

  derived.managedReference(obs, '~upstream');

  derived.onCleanup(
    obs.subscribe((value, origin, ctx) => {
      obs.validate();
      derived.input(f(value), origin, ctx, deepEq); // Think about what to do with oldValue and origin here
    }),
  );

  return derived;
}

export function promiseToObs<T>(promise: Promise<T>): ObservableReader<T | undefined> {
  const obs = new Observable<T | undefined>(undefined);
  void promise.then((value) => obs.set(value));
  return obs;
}
