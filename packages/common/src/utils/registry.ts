import {
  SubscribeArgs,
  Unsubscriber,
  ChangeContext,
  SubscribeItemizedListeners,
  ItemListener,
  ChangeListener,
  ModifyListener,
  ItemEventOrigin,
  EdvoObj,
} from '@edvoapp/util';

export class Registry<Obj extends EdvoObj> {
  items: Record<string, Obj> = {};
  _val: Obj[] = [];
  protected _listeners: {
    ITEM_LISTENER: ItemListener<Obj>[];
    CHANGE: ChangeListener<Obj[]>[];
    MODIFY_LISTENER: ModifyListener<Obj>[];
  } = {
    ITEM_LISTENER: [],
    CHANGE: [],
    MODIFY_LISTENER: [],
  };
  constructor(public onSubscribe?: () => void) {}
  add_or_throw(k: string, v: Obj, msg: string, origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext = {}) {
    if (!this.add(k, v, origin, ctx)) {
      throw `Duplicate entry (${msg})`;
    }
  }
  add(k: string, v: Obj, origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext = {}): boolean {
    const existing = this.items[k];
    if (existing?.alive) {
      return false; // decline to add the item to the registry
    }

    if (existing) {
      this.items[k] = v;
      this.rawRemove(existing, origin, ctx);
      this.rawInsert(v, origin, ctx, false);
      this.fireChangeListeners(origin, ctx);
    } else {
      this.items[k] = v;
      this.insert(v, origin, ctx);
    }
    return true;
  }
  get(k: string): Obj | null {
    const entry = this.items[k];
    if (!entry || entry.destroyed) return null;
    return entry;
  }

  validate() {
    // do something
  }

  contains(obj: Obj) {
    this.validate();
    return this._val.includes(obj);
  }

  insert(obj: Obj, origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext = {}, dedupe?: boolean) {
    this.rawInsert(obj, origin, ctx, dedupe);
    this.fireChangeListeners(origin, ctx);
  }

  protected rawInsert(obj: Obj, origin: ItemEventOrigin, ctx: ChangeContext, dedupe?: boolean, offset?: number) {
    if (dedupe && this.contains(obj)) return;
    offset ??= this._val.length;

    this._val.splice(offset, 0, obj);

    this.fireItemListeners(obj, 'ADD', origin, ctx, offset, offset);
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

  protected fireItemListeners(
    obj: Obj,
    op: 'ADD' | 'REMOVE' | 'MOVE',
    origin: ItemEventOrigin = 'UNKNOWN',
    ctx: ChangeContext,
    offset: number,
    newOffset: number | null,
  ) {
    this.validate();
    // origin will be "USER" here
    this._listeners.ITEM_LISTENER.forEach((l) => l(obj, op, origin, ctx, offset, newOffset));
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
    this._listeners.MODIFY_LISTENER.forEach((l) => l(obj, op, origin, ctx, offset, newOffset));
  }

  // Fire the change listeners

  // TODO: Should both values be undefined here?
  protected fireChangeListeners(origin: ItemEventOrigin, ctx: ChangeContext) {
    this.validate();
    this._listeners.CHANGE.forEach((l) => l(this.value, origin, ctx));
  }

  remove(k: string, origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext = {}) {
    const val = this.items[k];
    delete this.items[k];
    this.rawRemove(val, origin, ctx);
    this.fireChangeListeners(origin, ctx);
  }
  get value() {
    return this._val;
  }
  clear(origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext = {}) {
    this.items = {};
    if (this._val.length === 0) return;

    const oldTailIdx = this._val.length - 1;
    this._val.reverse().forEach((obj, rIndex) => {
      this.fireItemListeners(obj, 'REMOVE', origin, ctx, oldTailIdx - rIndex, null);
    });
    this._val = [];
    this.fireChangeListeners(origin, ctx);
  }
  subscribe(
    args: SubscribeArgs<Obj>,
    _notifyInitialValue = false, // TODO - how do we handle this in ObservableList?
    ctx: ChangeContext = {},
  ): Unsubscriber {
    const { ITEM_LISTENER, CHANGE, MODIFY_LISTENER }: SubscribeItemizedListeners<Obj> =
      typeof args === 'function' ? { CHANGE: args } : args;

    if (this.onSubscribe) this.onSubscribe();
    if (ITEM_LISTENER && this._val.length > 0) {
      // console.log('ObservableList subscribe (ISLOADED)', this._val.length);
      this._val.forEach((obj, offset) => ITEM_LISTENER(obj, 'ADD', 'DATABASE', ctx, offset, offset));
    }
    if (CHANGE && this._val.length > 0) CHANGE(this.value, 'DATABASE', ctx);

    if (ITEM_LISTENER) this._listeners.ITEM_LISTENER.push(ITEM_LISTENER);
    if (CHANGE) this._listeners.CHANGE.push(CHANGE);
    if (MODIFY_LISTENER) this._listeners.MODIFY_LISTENER.push(MODIFY_LISTENER);

    return () => {
      this._listeners.ITEM_LISTENER = this._listeners.ITEM_LISTENER.filter((l) => l !== ITEM_LISTENER);
      this._listeners.CHANGE = this._listeners.CHANGE.filter((l) => l !== CHANGE);
      this._listeners.MODIFY_LISTENER = this._listeners.MODIFY_LISTENER.filter((l) => l !== MODIFY_LISTENER);
    };
  }
}

// This one does not, but requires ESNext
// export class Registry<T extends object>{
//     items: Record<string, WeakRef<T>>
//     constructor() {
//         this.items = {}
//         setInterval(() => { this.flush() }, 120000);
//     }
//     flush() {
//         Object.entries(this.items).forEach(([k, v]) => {
//             if (!v.deref()) {
//                 delete this.items[k]
//             }
//         });
//     }
//     add_or_throw(k: string, v: T) {
//         if (!this.add(k, v)) {
//             throw "Duplicate entry"
//         }
//     }
//     add(k: string, v: T): boolean {
//         const existing = this.items[k];
//         if (existing) {
//             // We have an entry. Is the object still resident?
//             if (existing.deref()) {
//                 return false; // decline to add the item to the registry
//             }
//             // no longer resident. overwrite the entry below
//         }

//         this.items[k] = new WeakRef(v);
//         return true
//     }
//     get(k: string): T | null {
//         const entry = this.items[k];
//         if (!entry) return null;

//         // We have an entry. Is the object still resident?
//         const ref = entry.deref();
//         if (ref) return ref; // yup

//         // no longer resident. delete the entry
//         delete this.items[k]

//         return null
//     }
// }
