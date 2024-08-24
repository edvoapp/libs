import { useEffect, useRef } from 'preact/hooks';
import { useState } from 'preact/hooks'; // Approved - we legitimately want to re-render when setting state

// We can easily change these to be Observables if desired. Just takes more memory
const DEBUG = true;

export interface AwaitableBase<V> {
  get_then<O>(f: ThenFunction<V, O>): Promise<O>;
}

// ALL of the classes in this module should be compatible with the following interface contract
export interface AwaitableValue<V> extends AwaitableBase<V> {
  // Do what you need to do to get the value. I'll wait
  get(): Promise<V>;

  // I'll wait for the value, but don't go to too much trouble
  passive_get(): Promise<V>;

  // If you've got a value now, let me have it huh?
  peek(): V | null;

  // Ohh you should have a value now, or you are naughty
  peek_or_throw(msg: string): V;

  // Just like passive_get, but I'm not in an async context, and I don't want to
  // risk that the async scheduler might take its sweet time
  passive_then<O>(f: ThenFunction<V, O>): Promise<O>;

  // Moved to AwaitableBase
  // get_then<O>(f: ThenFunction<V, O>): Promise<O>;

  // Overwrite whatever you have with this
  set(val: V): void;
}

export interface SpecialActivatableSync<V> {
  activate_special_sync(f: (value: V) => V, msg: string): void;
}

export type ThenFunction<I, O> = (a: I) => O;

// NowValue always has a usable value
export class NowValue<V> {
  constructor(protected _value: V) {}
  async get(): Promise<V> {
    return this._value;
  }
  async passive_get(): Promise<V> {
    return this._value;
  }
  peek(): V | null {
    return this._value;
  }
  peek_or_throw(_msg: string): V {
    return this._value;
  }
  set(value: V) {
    this._value = value;
  }
  passive_then<O>(f: ThenFunction<V, O>): Promise<O> {
    // Be EXPLICIT about when we're running this. Skip the promise if we have this
    // Using .get().then() might yield even though we have a value now
    return Promise.resolve(f(this._value));
  }
  get_then<O>(f: ThenFunction<V, O>): Promise<O> {
    return Promise.resolve(f(this._value));
  }
}
export class NowValueOnce<V> extends NowValue<V> {
  set(value: V) {
    if (this._value) throw 'NowValueOnce can only be set once';
    super.set(value);
  }
}

// AwaitValue always starts off with no value, but will have a value at some point
// which some external function will have to proactively set
export class AwaitValue<V> {
  protected _value: V | null = null;
  protected _has: Promise<void>;
  protected _signal!: Function;
  protected destroyed?: boolean;
  protected _awaitHasTimers?: any[];
  constructor() {
    this._has = new Promise((r) => {
      this._signal = r;
    });
  }

  // Wait for a value to arrive
  async get(): Promise<V> {
    if (this._value !== null) {
      return this._value;
    }
    await this._awaitHas('get', DEBUG && caller()[1]);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this._value!;
  }
  // used by subclasses which have an activation step to avoid triggering activation
  async passive_get(): Promise<V> {
    if (this._value !== null) {
      return this._value;
    }
    await this._awaitHas('passive_get', DEBUG && caller()[1]);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this._value!;
  }

  peek(): V | null {
    return this._value;
  }
  peek_or_throw(msg: string): V {
    if (!this._value) {
      console.error(`peek_or_throw FAILED: ${msg}`);
      throw `peek_or_throw FAILED: ${msg}`;
    }
    return this._value;
  }
  set(val: V) {
    this._value = val;
    this._signal();
  }
  // Wait for a value, without triggering anything else to be done
  passive_then<O>(f: ThenFunction<V, O>, callerInfo?: string): Promise<O> {
    // DO NOT CALL .get.then, because it might yield
    if (this._value !== null) {
      return Promise.resolve(f(this._value));
    } else {
      return this._awaitHas('passive_then', DEBUG && (callerInfo ? `${callerInfo}: ` : '') + caller()[1]).then(() => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return f(this._value!);
      });
    }
  }
  get_then<O>(f: ThenFunction<V, O>, callerInfo?: string): Promise<O> {
    // DO NOT CALL .get.then, because it might yield
    if (this._value !== null) {
      return Promise.resolve(f(this._value));
    }

    return this._awaitHas('get_then', DEBUG && (callerInfo ? `${callerInfo}: ` : '') + caller()[1]).then(() => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return f(this._value!);
    });
  }
  protected async _awaitHas(method: string, callInfo?: string): Promise<void> {
    if (DEBUG) {
      let timedout = false;
      const id = setTimeout(() => {
        // Don't fail, just warn
        timedout = true;
        console.warn(
          `${this.constructor.name}.${method}`,
          callInfo ? `(${callInfo})` : '',
          'did not have a value after 5 Seconds',
        );
      }, 5000);
      this._awaitHasTimers = this._awaitHasTimers || [];
      this._awaitHasTimers.push(id);

      await this._has;
      if (timedout) {
        console.warn(this.constructor.name + '.' + method + ' timed out after 5 seconds but still got a value');
      }
      this._awaitHasTimers = this._awaitHasTimers.filter((t) => t !== id);
      clearTimeout(id);
    } else {
      await this._has;
    }
  }
}

export class AwaitValueOnce<V> extends AwaitValue<V> {
  set(value: V) {
    if (this._value) throw 'AwaitValueOnce can only be set once';
    super.set(value);
  }
}

// Like AwaitValue, but with a getter function to self-serve the getting of the value
export class LazyGetterAsync<V> extends AwaitValue<V> {
  protected _fired_getter = false;
  constructor(protected _getter: () => Promise<V>) {
    super();
  }
  // Override the parent class to perform the activation step before awaiting the value
  async get(): Promise<V> {
    if (this._value) return this._value;

    // no value yet

    if (this._fired_getter) {
      // We've started activating, but haven't finished yet
      await this._awaitHas('get', DEBUG && caller()[1]);
    } else {
      this._fired_getter = true; // Set this now in case the await yields
      await this._awaitGetter();
    }

    return this._value!;
  }
  set(_value: V) {
    throw 'LazyGetterAsync does not allow set';
  }
  get_then<O>(f: ThenFunction<V, O>): Promise<O> {
    // DO NOT CALL .get.then, because it might yield
    if (this._value !== null) return Promise.resolve(f(this._value));

    if (this._fired_getter) {
      // We've started activating, but haven't finished yet
      return this._awaitHas('get_then', DEBUG && caller()[1]).then(() => f(this._value!));
    } else {
      this._fired_getter = true; // Set this now in case the await yields
      return this._awaitGetter().then(() => f(this._value!));
    }
  }
  protected async _awaitGetter(): Promise<void> {
    if (DEBUG) {
      let timedOut = false;
      const id = setTimeout(() => {
        // Don't fail, just warn
        timedOut = true;
        console.warn(this.constructor.name + ' getter took > 5 Seconds');
      }, 5000);

      const v = await this._getter();
      if (timedOut) {
        console.warn(this.constructor.name + ' successfully returned a value after more than 5 seconds');
      }
      clearTimeout(id);
      if (v) {
        this._value = v;
      }
    } else {
      this._value = await this._getter();
    }
    this._signal();
  }
}

// Similar to awaitValue, except that it starts out with a value which is considered "not activated"
// And includes an activation function which is called on-demand when the value is "gotten"
//
// Calling .peek, .passive_get, .passive_get_sync, or .then will provide the value without activating it
// Calling .get will cause the activator function to be called, unless it was specially activated using .activate_special
export class ActivatableAsync<V> extends AwaitValue<V> {
  private _activating = false;
  private _activated = false;
  constructor(protected _value: V, protected _activator: (value: V) => Promise<void>) {
    super();
  }
  async activate(): Promise<void> {
    if (this._activated) return;
    if (this._activating) {
      // We've started activating, but haven't finished yet
      await this._awaitHas('get', DEBUG && caller()[1]);
    } else {
      this._activating = true; // Set this now in case the await yields
      await this._awaitActivator();
      this._activated = true;
    }
  }
  map<T>(fn: (arg0: V) => T): ActivatableAsync<T> {
    return new ActivatableAsync(fn(this._value), async () => {
      await this.activate();
    });
  }
  // Override the parent class to perform the activation step before awaiting the value
  async get(): Promise<V> {
    if (this._activated) return this._value;
    await this.activate();
    return this._value;
  }
  get_then<O>(f: ThenFunction<V, O>): Promise<O> {
    // DO NOT CALL .get.then, because it might yield
    if (this._value !== null) return Promise.resolve(f(this._value));
    return this.activate().then(() => f(this._value));
  }
  set(_value: V) {
    throw 'ActivatableAsync does not allow set';
  }
  // Get the value without activating
  value(): V {
    return this._value;
  }
  // come up with a better name
  activate_and_get_nowait(): V {
    // activate it, but don't wait
    void this.activate();
    return this._value;
  }
  protected async _awaitActivator(): Promise<void> {
    if (DEBUG) {
      const timer = setTimeout(() => {
        console.warn(this.constructor.name + ' activator took > 5 Seconds');
      }, 5000);
      await this._activator(this._value);
      clearTimeout(timer);
    } else {
      await this._activator(this._value);
    }
    this._signal();
  }
}

// ActivatableSync<T> is just like ActivatableAsync<T> except that its activation function is synchronous
// As such, it also offers a get_sync method which can activate and return the object syncrhonously
export class ActivatableSync<V> extends AwaitValue<V> {
  protected _fired_activator = false;
  protected _value: V;
  constructor(value: V, protected activator: (value: V) => void) {
    super();
    this._value = value;
  }
  // Interface compatibility. Our activation function is synchronous, but we still want to provide an async interface
  async get(): Promise<V> {
    return this.get_sync();
  }
  // Call the activator if not already activated, and then immediately return the value
  // because our activator is synchronous
  get_sync(): V {
    this.activate_sync();
    return this._value;
  }
  set(_value: V) {
    throw 'ActivatableSync does not allow set';
  }
  activate_sync() {
    if (this._fired_activator) return;
    this._fired_activator = true;
    this.activator(this._value);
    this._signal(); // In case we have any thens waiting
  }
  async activate(): Promise<void> {
    this.activate_sync();
  }
  // Get the value without activating
  value(): V {
    return this._value;
  }
}

// common/dist/entities/Edge.js:121:42
const stackItemRe = new RegExp(/(?:(.+?)@|at (.+?)) \((.*?)\).*/);
function caller(skipFrames = 1): [string, string] {
  const stack = new Error().stack;
  if (!stack) return ['Unknown', 'Unknown'];

  let line = stack.split('\n')[skipFrames + 2];
  if (line) {
    const match = stackItemRe.exec(line);
    if (match) {
      const fun = match[2] || match[1];
      const file = match[3];
      return [fun, file];
    }
  }
  return ['Unknown', 'Unknown'];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useAwaitable<V>(awaitable: AwaitableBase<V> | null | undefined, deps: ReadonlyArray<any>): V | null {
  const [value, setValue] = useState<V | null>(null); // Approved - We expressly want to re-render

  useEffect(() => {
    if (value !== null) setValue(null);
    if (awaitable) void awaitable.get_then((value) => setValue(value));
  }, deps);

  return value;
}

// TODO - reconcile the "proactive form" of Awaitable things above versus the "standard form" of awaitable things (IE promises) below
// .then is semantically equivalent to .passive_then
// .get_then triggers something, and .then / .passive_then merely wait for something that was already happening
//
// Perhaps all instances of useAwaitable(foo) could be transitioned to useAwait(() = foo.get())

export function useAwait<V>(promiseBuilder: void | (() => Promise<V>), deps: ReadonlyArray<unknown>): V | void {
  const [value, setValue] = useState<V | undefined>(undefined); // Approved - We expressly want to re-render

  useEffect(() => {
    let canceled = false;
    if (promiseBuilder) {
      void promiseBuilder().then((value) => {
        if (!canceled) setValue(value);
      });
    }
    return () => {
      canceled = true;
      // Reset
      setValue(undefined);
    };
  }, deps);

  return value;
}
