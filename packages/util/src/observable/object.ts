import { GuardedObj } from '@edvoapp/wasm-bindings';
import { EdvoError } from './edvo-error';
import { ChangeListener, IObservable } from './observable';
import ErrorStackParser from 'error-stack-parser';
import StackTraceGPS from 'stacktrace-gps';
import { RingArray } from '../debug-accumulator';

export { GuardedObj } from '@edvoapp/wasm-bindings';

type EventListenable = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener: (arg0: string, arg1: (e: any) => void, opts: AddEventListenerOptions) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeEventListener: (arg0: string, arg1: (e: any) => void) => void;
};

type RefTree = Record<string, RefTree[]>;

export const traceState = {
  level: 0,
  regex: new RegExp('.'),
};

export const debugLogState = {
  level: 4,
  // TODO: add negative matching so we don't need this silly kitchen-sink regex
  regex: new RegExp('^handle(?!MouseMove\\b|MouseEnter\\b|MouseLeave\\b)[a-zA-Z]+$'),
};

export const debugLog = new RingArray(1000);

globalThis.traceState = traceState;
globalThis['getTraceState'] = () => traceState;

globalThis.debugLogState = debugLogState;
globalThis.debugLog = debugLog;

export type ObjStat = {
  current: number;
  ever: number;
  obj: Set<GuardedObj>;
};
export type CancelFn = () => void;

GuardedObj.pretty_stack = pretty_stack;
GuardedObj.detailed_validate_error = detailed_validate_error;

export abstract class ManagedObj extends GuardedObj {
  #cleanupCallbacks?: (() => void)[];

  onCleanup(fn: () => void): CancelFn {
    let cl = (this.#cleanupCallbacks = this.#cleanupCallbacks || []);
    cl.push(fn);

    return () => {
      let i = cl.indexOf(fn);
      if (i !== -1) cl.splice(i, 1);
    };
  }

  protected cleanup() {
    super.cleanup();
    this.#fireCleanupCallbacks();
  }

  managedReference(ref: GuardedObj, referenceName: string): CancelFn {
    ref.registerReferent(this, referenceName);
    let onCleanup = this.onCleanup(() => {
      ref.deregisterReferent(this, referenceName);
    });

    // Return our cancel function
    // which will de-register this with the referent to release our claim,
    // and unregister the cleanup - so that we don't have a memory leak.
    return () => {
      onCleanup();
      ref.deregisterReferent(this, referenceName);
    };
  }

  managedSubscription<T>(upstream: GuardedObj & IObservable<T>, fn: ChangeListener<T>, notifyInitialValue?: boolean) {
    this.managedReference(upstream, '~upstream');
    this.onCleanup(upstream.subscribe(fn, notifyInitialValue));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected addManagedListener(
    element: EventListenable,
    eventName: string,
    fn: (e: any) => void,
    opts: AddEventListenerOptions = {},
  ) {
    element.addEventListener(eventName, fn, opts);
    this.#cleanupCallbacks = this.#cleanupCallbacks || [];
    this.#cleanupCallbacks.push(() => {
      element.removeEventListener(eventName, fn);
    });
  }

  #fireCleanupCallbacks() {
    this.#cleanupCallbacks?.forEach((c) => c());
  }
}

const hasWindow = typeof window !== 'undefined';

export class EdvoObj extends ManagedObj {
  static _audit: string | null = null;

  static initializeAudit() {
    if (hasWindow) {
      const audit = localStorage.getItem('auditObjects');
      EdvoObj._audit = audit;
    } else if (chrome) {
      chrome.storage.local.get('auditObjects', (result) => {
        EdvoObj._audit = result.auditObjects;
      });
    }
  }

  static enableAudits() {
    if (hasWindow) {
      localStorage.setItem('auditObjects', 'true');
    } else if (chrome) {
      chrome.storage.local.set({ auditObjects: 'true' });
    }
    globalThis.location.reload();
  }

  static disableAudits() {
    if (hasWindow) {
      localStorage.removeItem('auditObjects');
    } else if (chrome) {
      chrome.storage.local.remove('auditObjects');
    }
    globalThis.location.reload();
  }

  static audit(cb: (obj: GuardedObj) => any | null): any[] {
    if (!EdvoObj._audit) {
      alert('Enabling EdvoObj audits - The page will reload');
      EdvoObj.enableAudits();
    }

    let out: any[] = [];

    //iterate over all types of live objects
    for (const [key, value] of Object.entries(EdvoObj.liveObjectsByConstructor)) {
      //iterate over all instances of this type
      for (const obj of value.obj) {
        let rv = cb(obj);
        if (rv) out.push(rv);
      }
    }

    return out;
  }
  // override this in subclasses to get information specific to that object
  debugIdentity() {
    return {
      obj: this.constructor.name,
    };
  }

  protected _managedProps: Set<string | symbol> = new Set();

  protected cleanup(): void {
    super.cleanup();

    this._managedProps?.forEach((property) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      let refs = this[property] as any;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      refs = refs ?? [];
      refs = refs instanceof Array ? refs : [refs];
      for (const r of refs) {
        if (r instanceof GuardedObj) {
          r.deregisterReferent(this, property);
        }
      }
    });

    EdvoObj.liveObjects--;
    let stat = EdvoObj.liveObjectsByConstructor[readableClassName(this)];
    stat.current--;

    if (EdvoObj._audit) stat.obj.delete(this);
  }

  /**
   * Returns a tree of all inbound references to this object
   */
  refTree(opts = { skipLeaked: false, cyclesOnly: false }): RefTree {
    return this._refTree([], opts)[0];
  }

  private _refTree(path: EdvoObj[], opts: { skipLeaked: boolean; cyclesOnly: boolean }): [RefTree, boolean] {
    let tree: RefTree = {};
    let cycle = false;
    for (const [obj, property] of this._inboundRefs) {
      const prop = property.constructor === Symbol ? property.description : property;
      let referent;
      let entry, c;
      if (obj instanceof EdvoObj) {
        if (opts.skipLeaked && obj.leaked) continue;
        referent = obj.getClassName() + '.' + prop;
        if (path.includes(obj) || this === obj) {
          entry = 'CYCLE!!!';
          cycle = true;
        } else {
          [entry, c] = obj._refTree([...path, obj], opts);
          if (opts.cyclesOnly && !c) continue;
          cycle ||= c;
        }
      } else {
        referent = obj.constructor.name + '.' + prop;
        entry = '(object)';
      }

      if (tree[referent]) {
        if (tree[referent] instanceof Array) {
          tree[referent].push(entry);
        } else {
          tree[referent] = [tree[referent], entry];
        }
      } else {
        tree[referent] = entry;
      }
    }
    return [tree, cycle];
  }

  /**
   * Returns true if any of the inbound references match the provided function
   * The tiers parameter limits the depth of the search
   */
  refCheck(
    fn: (obj: EdvoObj | Object, property: string, rawProperty: string | Symbol) => boolean,
    tiers = Infinity,
  ): boolean {
    return this._refCheck([], fn, tiers);
  }

  private _refCheck(
    path: EdvoObj[],
    fn: (obj: EdvoObj | Object, property: string, rawProperty: string | Symbol) => boolean,
    tiers: number,
  ): boolean {
    if (tiers === 0) return false;
    for (const [obj, property] of this._inboundRefs) {
      const prop = property.constructor === Symbol ? property.description ?? property.toString() : property.toString();

      if (fn(obj, prop, property)) return true;

      if (obj instanceof EdvoObj) {
        if (path.includes(obj) || this === obj) continue; // Cycle
        if (obj._refCheck([...path, this], fn, tiers - 1)) return true;
      }
    }
    return false;
  }

  /**
   * Returns true if this object is part of a reference cycle
   */
  refCycle(skipLeaked = true): boolean {
    return this._refCycle([this], skipLeaked);
  }

  private _refCycle(path: EdvoObj[], skipLeaked: boolean): boolean {
    for (const [obj] of this._inboundRefs) {
      if (obj instanceof EdvoObj) {
        if (skipLeaked && obj.leaked) continue;

        if (path[0] === obj) return true; // Self-Cycle
        if (!path.includes(obj)) {
          if (obj._refCycle([...path, this], skipLeaked)) return true;
        }
      }
    }
    return false;
  }

  static totalObjectsEver = 0;
  static liveObjects = 0;
  static liveObjectsByConstructor: Record<string, ObjStat> = {};

  creator: Error;

  constructor() {
    super();
    EdvoObj.totalObjectsEver++;
    EdvoObj.liveObjects++;

    this.creator = new Error();
    const name = readableClassName(this);
    const stat = (EdvoObj.liveObjectsByConstructor[name] ??= {
      current: 0,
      ever: 0,
      obj: new Set(),
    });
    stat.current++;
    stat.ever++;
    if (EdvoObj._audit) stat.obj.add(this); // Debug
  }

  setProperty<T>(property: string | symbol, ref: T | T[] | null) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const prev = this[property] as T | T[];

    // no-op if the reference is the same
    if (prev === ref) return;

    // Always register the new ref first to avoid obscure cases deregistering the prev kills the ref

    let refs = ref ?? [];
    refs = refs instanceof Array ? refs : [refs];
    for (const r of refs) {
      if (r instanceof GuardedObj) {
        r.registerReferent(this, property);
        this._managedProps.add(property);
      }
    }

    // Set the new value before deregistering the old one
    // to ensure the value is always alive
    this[property] = ref;

    let prevs = prev ?? [];
    prevs = prevs instanceof Array ? prevs : [prevs];
    for (const r of prevs) {
      if (r instanceof GuardedObj) {
        r.deregisterReferent(this, property);
      }
    }
  }

  equals(other: EdvoObj) {
    return this === other;
  }

  /**
   * Runs a function after a set delay (or idle task), ensuring that the object is alive until the function is run
   */
  defer(fn: (arg0: this) => any, delay = 0): () => void {
    let stack = new Error();
    let guard = Guard.unsafe(this);

    const t = setTimeout(() => {
      fn(this);
      guard.release(stack);
    }, delay);

    return () => {
      clearTimeout(t);
      guard.release(stack);
    };
  }

  /**
   * Creates a debouncer for the provided closure which will:
   *  - call the closure after a set idle time with this object as the argument
   *  - ensure the object is alive until the closure is run
   *
   * Note that if the debouncer is called after the object is destroyed,
   * it will throw an error when it attempts to take the guard
   *
   * delay defaults to 900ms
   */
  debounce<T extends any[]>(fn: (...args: T) => void | Promise<void>, delay = 900): (...args: T) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let stack = new Error();
    let guard: Guard;

    return (...args: T) => {
      if (!this.alive) return;
      const later = async () => {
        timeoutId = null;
        await fn.apply(this, args);
        guard.release(stack);
      };

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      } else {
        // Take the guard when we start the debounce
        guard = Guard.unsafe(this);
      }

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      timeoutId = setTimeout(later, delay);
    };
  }

  traceError(...args: any[]) {
    // TODO send telemetry
    console.error(...args);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected trace(level: number, message: string | (() => any[])) {
    // Store the trace
    if (level > debugLogState.level && level > traceState.level) return;
    const val = [
      `${this.constructor.name} [${this.key}] ${level}:`,
      ...(typeof message === 'function' ? message() : [message]),
    ];

    if (level < debugLogState.level) {
      if (val.find((v) => debugLogState.regex.test(v)) && !val.includes('(skipped)')) {
        debugLog.push(val.map((m) => debugSanitize(m)));
      }
    }

    if (level > traceState.level) return;
    if (!val.find((v) => traceState.regex.test(v))) return;

    const stackTrace = new Error().stack?.split('\n');
    // TODO: we can use the above to get nice stack traces of our trace logs, instead of just seeing object.ts
    // but, it seems like Webpack does some weird mangling, so the actual traces are quite useless
    // but, the below will at least give us the function call that caused the trace, so thats kinda nice.
    // but, of course, its also not perfect because webpack does weird things with loops and promises
    // so, im just gonna keep this here until we can improve
    // const label = stackTrace?.[2].trim().split(' ')[1];

    console.log(...val);
  }

  getClassName(): string {
    return this.constructor.name;
  }

  skipLeakDetection?: boolean;

  detectCycle(): void {
    // Path is an array of object, and the property name that led to that object from the previous object

    const dfs = (
      node: EdvoObj,
      propertyName: string | Symbol | undefined,
      path: [EdvoObj, string | Symbol | undefined][],
    ) => {
      let cycle = path.find(([n]) => node === n);
      if (cycle) {
        const nodeProp: [EdvoObj, string | Symbol | undefined] = [node, propertyName];
        const cyclepath = [nodeProp, ...path];
        console.log(
          'Cycle detected: ' + cyclepath.map(([n, p]) => (n.getClassName() + p ? '.' + String(p) : '')).join(' -> '),
          'at',
          cycle,
        );
        return true;
      }

      path = [[node, propertyName], ...path];
      console.log('dfs', node.getClassName(), propertyName, path);
      for (const ref of node._inboundRefs) {
        if (ref[0] instanceof EdvoObj && !ref[0].skipLeakDetection) {
          if (dfs(ref[0], ref[1], path)) return true;
        }
      }
      return false;
    };

    dfs(this, '', []);
  }
}

// Initialize audit.
EdvoObj.initializeAudit();

type Maybe<T> = T | null | undefined;
type GuardInput = GuardedObj | Maybe<GuardedObj>[] | Record<string, Maybe<GuardedObj>>;

/** Keeps an EdvoObj alive until it is released */
export class Guard {
  private list: GuardedObj[] = [];

  private constructor(input: GuardInput) {
    this.add(input);
  }

  static unsafe(input: GuardInput) {
    return new Guard(input);
  }

  release(debugStack?: Error) {
    for (const obj of this.list) {
      obj.deregisterReferent(this, '', debugStack);
    }
  }

  private add(input: GuardInput) {
    if (input instanceof GuardedObj) {
      input.registerReferent(this, '');
      this.list.push(input);
    } else if (Array.isArray(input)) {
      for (const obj of input) {
        if (obj instanceof GuardedObj) this.add(obj);
      }
    } else {
      const objects = Object.values(input);
      for (const obj of objects) {
        if (obj) this.add(obj);
      }
    }
  }

  static while<T, Deps extends GuardInput>(deps: Deps, fn: (values: Deps) => T): T {
    const guard = Guard.unsafe(deps);

    let result: T;
    try {
      result = fn(deps);
    } catch (e) {
      guard.release();
      throw e;
    }
    if (result instanceof Promise) {
      return result.finally(() => guard.release()) as unknown as T;
    } else {
      guard.release();
      return result;
    }
  }
}

// const skipKeys = ['_inboundRefs', '_children'];
// function getPropertyNameAndOffset(node: EdvoObj, ref: EdvoObj): string {
//   return Object.entries(ref).reduce((acc, [k, v]) => {
//     if (skipKeys.includes(k)) return acc; // Skip if it's the '_inboundRefs' property

//     if (v instanceof Array) {
//       const index = v.indexOf(node);
//       if (index !== -1) return `${k}[${index}]`; // Found in array, return property name with index
//     } else if (v === node) {
//       return k;
//     }

//     return acc; // Continue searching
//   }, '_unknown_'); // Default value if not found
// }

declare global {
  export interface Window {
    edvoObj: any;
  }

  var edvoObj: any;
}
globalThis.edvoObj = EdvoObj;

function readableClassName(obj: Object): string {
  // @ts-expect-error shuddup
  return readableClassNameRecurse(obj.__proto__).join('.');
}

function readableClassNameRecurse(obj: Object): string[] {
  const name = obj.constructor.name;
  if (name.startsWith('Edvo')) return [];

  // @ts-expect-error shuddup
  const proto = obj.__proto__ as Object | null;

  if (proto) {
    return [...readableClassNameRecurse(proto), name];
  }

  return [name];
}

let gps: StackTraceGPS | null = null;

export async function pretty_stack_sourcemapped(error: Error, frames = 10, skip = 0) {
  gps ??= new StackTraceGPS();

  const stack_frames = await Promise.all(
    ErrorStackParser.parse(error)
      .slice(skip, frames + skip)
      .map((s) => gps!.pinpoint(s).catch(() => s)),
  );

  // map filename line number and function name
  const lines = stack_frames.map(
    (s) =>
      pretty_filename(s.fileName ?? 'unknown') +
      ':' +
      (s.lineNumber ?? '??') +
      ':' +
      (s.columnNumber ?? '??') +
      ' ' +
      (s.functionName ?? '-'),
  );

  return lines.join('\n');
}

export function pretty_stack(error: Error, frames = 10, skip = 0) {
  const stack_frames = ErrorStackParser.parse(error).slice(skip, frames + skip);
  const lines = stack_frames.map(
    (s) =>
      pretty_filename(s.fileName ?? 'unknown') +
      ':' +
      (s.lineNumber ?? '??') +
      ':' +
      (s.columnNumber ?? '??') +
      ' ' +
      (s.functionName ?? '-'),
  );

  return lines.join('\n');
}

export async function pretty_stack_with_snippets(error: Error, frames = 10, skip = 0) {
  const stack_frames = ErrorStackParser.parse(error).slice(skip, frames + skip);
  const lines = await Promise.all(
    stack_frames.map(async (s) => {
      const snippet = await get_file_snippet(s, 100, 1);
      return (
        pretty_filename(s.fileName ?? 'unknown') +
        ':' +
        (s.lineNumber ?? '??') +
        ':' +
        (s.columnNumber ?? '??') +
        ' ' +
        (s.functionName ?? '-') +
        ' ~ ' +
        snippet
      );
    }),
  );

  return lines.join('\n');
}

export async function detailed_validate_error(obj: GuardedObj, e: Error) {
  // TODO reenable this after we fix the sourcemaps
  // let caller = await pretty_stack_sourcemapped(new Error(''), 10, 1);
  let caller = await pretty_stack_with_snippets(e, 10, 1);

  let destroyedAt = obj.destroystack
    ? // ? await pretty_stack_sourcemapped(this.destroystack, 10, 0)   // TODO reenable this after we fix the sourcemaps
      await pretty_stack_with_snippets(obj.destroystack, 10, 0)
    : 'unknown';

  // Ideally we'd update the message of the existing toast, but the EdvoError object seems not to pass through to the window.error handler
  // so I can't use an observable. There's probably a different way that achieves this
  throw new EdvoError(
    `Used destroyed ${obj.constructor.name}(${obj.key}) at:\n${caller}\n\ndestroyed:\n${destroyedAt}`,
  );
}

async function get_file_snippet(stackframe: ErrorStackParser.StackFrame, maxChars = 100, maxLines = 2) {
  const { fileName, lineNumber, columnNumber } = stackframe;
  if (!fileName || !lineNumber || !columnNumber) return null;

  const response = await fetch(fileName);
  const text = await response.text();
  const lines = text.split('\n');

  // return the content of the line at the stackframe's line number and column number
  let linesUsed = 0;
  let snippet = '';
  let characterOffset = columnNumber - 1;

  // iterate over the lines starting at the given lineNumber / columnNumber
  // break the loop when we have enough lines or characters
  for (let i = lineNumber - 1; i < lines.length; i++) {
    const line = lines[i];

    const remainingChars = Math.max(0, maxChars - snippet.length);
    snippet += line.slice(characterOffset, remainingChars);
    linesUsed++;
    if (linesUsed >= maxLines) break;
    snippet += '\n';

    // subsequent lines start at 0
    characterOffset = 0;
  }

  return snippet;
}

function pretty_filename(filename: string) {
  // these should look like e/util/observable/object.ts
  // but only matching based on edvo/monorepo/packages with an optional dist
  // http://localhost:4000/@fs/Users/daniel/edvo/monorepo/packages/util/dist/observable/object.js
  // http://localhost:4000/@fs/Users/rasheedbustamam/Documents/coding/monorepo/packages/ui/dist/index.js?t=1712609558939:6422:7

  let edvofile = /monorepo\/packages\/(.+\.[tj]s)/.exec(filename);

  if (edvofile) {
    return edvofile[1];
  }

  // these should look like vite/deps/chunk.js
  // http://localhost:4000/node_modules/.vite/deps/chunk-2EF4MATZ.js?v=8f8859a1:78
  let vitefile = /node_modules\/\.vite\/deps\/(.*.[tj]s)/.exec(filename);
  if (vitefile) {
    return 'vite/' + vitefile[1];
  }

  return filename;
}

const MAX_DEPTH = 2;

function debugSanitize(item: EdvoObj | unknown, path: unknown[] = []): any {
  if (path.includes(item)) {
    return '(cycle)';
  }

  if (path.length > MAX_DEPTH - 1) {
    return '(skipped)';
  }

  path = path.concat(item);

  if (item instanceof EdvoObj) {
    // If the item is an instance of EdvoObj, return its debug identity.
    return item.debugIdentity();
  } else if (Array.isArray(item)) {
    // note that if item is an Array of Arrays, this type checking is actually wrong, but it should be fine.
    return item.map((v) => debugSanitize(v, path));
  } else if (item instanceof Object) {
    // If the item is a plain object, recursively check each key.
    let result = {};
    for (const key in item) {
      if (item.hasOwnProperty(key)) {
        result[key] = debugSanitize(item[key], path);
      }
    }
    return result;
  } else {
    // For all other cases, return the item unchanged.
    return item;
  }
}
