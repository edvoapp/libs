import { Model } from '@edvoapp/common';
import { ChangeContext, EdvoObj, ItemEventOrigin, Observable, ObservableReader } from '@edvoapp/util';

export type Updatable = Model.Property | Model.Backref | Model.Edge;

export type Unsubscriber = () => void;

type ItemListener = (item: Updatable, op: 'ADD' | 'REMOVE', ctx: ChangeContext) => void;

export class UpdatablesSet extends EdvoObj {
  allSet = new Set<Updatable>();
  activeSet = new Set<Updatable>();
  protected _listeners: {
    ITEM_LISTENER: ItemListener[];
  } = {
    ITEM_LISTENER: [],
  };
  loaders: (() => Promise<void>)[] = [];
  constructor(
    initialList: (
      | Updatable
      | ObservableReader<Model.Edge | null | undefined>
      | ObservableReader<Model.Backref | null | undefined>
      | ObservableReader<Model.Property | null | undefined>
    )[],
    loader?: () => Promise<void>,
  ) {
    super();

    if (loader) this.loaders.push(loader);
    initialList.forEach((item) => {
      // Track the previous value of this slot in case val is falsy
      let prevSlotVal: Updatable | null = null;
      if (item instanceof ObservableReader) {
        this.loaders.push(() => item.load());
        this.onCleanup(
          item.subscribe((val) => {
            if (val) {
              prevSlotVal = val;
              this.add(val);
            } else if (prevSlotVal) {
              this.remove(prevSlotVal);
              prevSlotVal = null;
            }
          }, true),
        );
      } else {
        this.add(item);
      }
    });

    void this.load();
  }
  subscribe(fn: ItemListener): Unsubscriber {
    this._listeners.ITEM_LISTENER.push(fn);
    return () => {
      this._listeners.ITEM_LISTENER = this._listeners.ITEM_LISTENER.filter((l) => l !== fn);
    };
  }
  get value(): Updatable[] {
    return [...this.activeSet];
  }
  async get(): Promise<(Model.Property | Model.Backref | Model.Edge)[]> {
    await this.load();
    return [...this.activeSet];
  }
  private _loaded = false;
  private _loading?: Promise<void>;
  get loading() {
    return !!this._loading;
  }
  get loaded() {
    return !!this._loaded;
  }
  async load(): Promise<void> {
    if (this._loaded) return;
    if (this._loading) return this._loading;
    let res: () => void;
    this._loading = new Promise((r) => {
      res = r;
    });
    await Promise.all(this.loaders.map((l) => l()));
    this._loaded = true;
    res!();
  }
  /**
   * Add an item to the UpdatablesList. The item will be added to the active set only after the privs have loaded for that updatable
   */
  add(item: Updatable) {
    if (this.allSet.has(item)) return;
    this.allSet.add(item);
    item.registerReferent(this, '~updatable');

    void item.privs.value.load().then(() => {
      let me = this.upgrade();
      if (me && me.allSet.has(item)) {
        me.activeSet.add(item);
        me.fireItemListeners(item, 'ADD', {});
      }
    });
  }
  remove(item: Updatable) {
    this.allSet.delete(item);
    this.activeSet.delete(item);
    this.fireItemListeners(item, 'REMOVE', {});
    item.deregisterReferent(this, '~updatable');
  }
  //   clear() {
  //     this.allSet.clear();
  //     this.activeSet.forEach((item) => {
  //       this.fireItemListeners(item, 'REMOVE', {});
  //     });
  //     this.activeSet.clear();
  //   }

  protected fireItemListeners(item: Updatable, op: 'ADD' | 'REMOVE', ctx: ChangeContext) {
    this.validate();
    // origin will be "USER" here
    this._listeners.ITEM_LISTENER.forEach((l) => l(item, op, ctx));
  }

  forEach(fn: (item: Updatable) => void) {
    this.activeSet.forEach(fn);
  }
}
